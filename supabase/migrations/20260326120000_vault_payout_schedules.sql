/*
  # Vault scheduled payouts (vault-funded schedule, fees from main wallet)

  Mirrors payout plan fee math (see lib/payout-fee-calculator.ts).
  - Gross total is deducted from the vault via plan_transactions (withdrawal).
  - Fees are deducted from the user's main wallet (like deduct_plan_fee_on_insert).
*/

-- Fee computation matching calculatePayoutFees (non-custom)
CREATE OR REPLACE FUNCTION public.compute_payout_schedule_fees(
  p_total_amount numeric,
  p_num_payouts int
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_processing numeric;
  v_transaction numeric;
  v_stamp numeric;
  v_fees_no_stamp numeric;
  v_net_if_no_stamp numeric;
  v_per_if_no_stamp numeric;
  v_total_fees numeric;
  v_net numeric;
  v_per numeric;
BEGIN
  IF p_num_payouts < 1 OR p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RETURN jsonb_build_object(
      'processing_fee', 0,
      'stamp_duty', 0,
      'transaction_fee', 0,
      'total_fees', 0,
      'net_payout_amount', COALESCE(p_total_amount, 0),
      'per_payout_amount', 0,
      'fee_percentage', 1.5
    );
  END IF;

  v_processing := floor(least(p_total_amount * (1.5 / 100.0), 500::numeric) * 100) / 100;
  v_transaction := floor((10.75 * p_num_payouts) * 100) / 100;
  v_fees_no_stamp := v_processing + v_transaction;
  v_net_if_no_stamp := p_total_amount - v_fees_no_stamp;
  v_per_if_no_stamp := v_net_if_no_stamp / p_num_payouts;

  IF v_per_if_no_stamp > 9999 THEN
    v_stamp := floor((50::numeric * p_num_payouts) * 100) / 100;
  ELSE
    v_stamp := 0;
  END IF;

  v_total_fees := floor((v_processing + v_stamp + v_transaction) * 100) / 100;
  v_net := floor((p_total_amount - v_total_fees) * 100) / 100;
  v_per := floor((v_net / p_num_payouts) * 100) / 100;

  RETURN jsonb_build_object(
    'processing_fee', v_processing,
    'stamp_duty', v_stamp,
    'transaction_fee', v_transaction,
    'total_fees', v_total_fees,
    'net_payout_amount', v_net,
    'per_payout_amount', v_per,
    'fee_percentage', 1.5
  );
END;
$$;

COMMENT ON FUNCTION public.compute_payout_schedule_fees(numeric, int) IS
  'Mirrors TS calculatePayoutFees for standard (non-custom) schedules.';

CREATE TABLE IF NOT EXISTS public.vault_payout_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  budget_plan_id uuid NOT NULL REFERENCES public.budget_plans(id) ON DELETE CASCADE,
  payout_account_id uuid NOT NULL REFERENCES public.payout_accounts(id),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  payout_amount numeric NOT NULL CHECK (payout_amount >= 0),
  net_payout_amount numeric NOT NULL CHECK (net_payout_amount >= 0),
  fee_percentage numeric,
  fee_amount numeric NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  frequency text NOT NULL,
  duration integer NOT NULL CHECK (duration > 0),
  start_date date NOT NULL,
  next_payout_date date,
  day_of_week integer,
  payout_hour integer DEFAULT 12,
  payout_minute integer DEFAULT 0,
  completed_payouts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  plan_transaction_id uuid REFERENCES public.plan_transactions(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_payout_schedules_user
  ON public.vault_payout_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_payout_schedules_plan
  ON public.vault_payout_schedules(budget_plan_id);
CREATE INDEX IF NOT EXISTS idx_vault_payout_schedules_next
  ON public.vault_payout_schedules(next_payout_date)
  WHERE status = 'active';

ALTER TABLE public.vault_payout_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault payout schedules"
  ON public.vault_payout_schedules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own vault payout schedules"
  ON public.vault_payout_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own vault payout schedules"
  ON public.vault_payout_schedules
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RPC: create schedule + vault withdrawal + main-wallet fee
CREATE OR REPLACE FUNCTION public.create_vault_payout_schedule(
  p_budget_plan_id uuid,
  p_payout_account_id uuid,
  p_total_amount numeric,
  p_frequency text,
  p_duration integer,
  p_start_date date,
  p_next_payout_date date,
  p_day_of_week integer DEFAULT NULL,
  p_payout_hour integer DEFAULT 12,
  p_payout_minute integer DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_plan_user uuid;
  v_plan_wallet_id uuid;
  v_pw_balance numeric;
  v_fee_json jsonb;
  v_total_fees numeric;
  v_net numeric;
  v_per numeric;
  v_fee_pct numeric := 1.5;
  v_main_wallet numeric;
  v_schedule_id uuid;
  v_pt_id uuid;
  v_pa_user uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 OR p_duration IS NULL OR p_duration < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount or duration');
  END IF;

  SELECT user_id INTO v_plan_user
  FROM budget_plans
  WHERE id = p_budget_plan_id;

  IF NOT FOUND OR v_plan_user <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Budget plan not found');
  END IF;

  SELECT user_id INTO v_pa_user
  FROM payout_accounts
  WHERE id = p_payout_account_id;

  IF NOT FOUND OR v_pa_user <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout account not found');
  END IF;

  v_fee_json := compute_payout_schedule_fees(p_total_amount, p_duration);
  v_total_fees := (v_fee_json->>'total_fees')::numeric;
  v_net := (v_fee_json->>'net_payout_amount')::numeric;
  v_per := (v_fee_json->>'per_payout_amount')::numeric;

  SELECT id, balance INTO v_plan_wallet_id, v_pw_balance
  FROM plan_wallets
  WHERE plan_id = p_budget_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan wallet not found');
  END IF;

  IF v_pw_balance < p_total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient vault balance',
      'required', p_total_amount,
      'available', v_pw_balance
    );
  END IF;

  IF v_total_fees > 0 THEN
    SELECT balance INTO v_main_wallet
    FROM wallets
    WHERE user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Main wallet not found');
    END IF;

    IF v_main_wallet < v_total_fees THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient main wallet balance for fees',
        'fee_amount', v_total_fees,
        'available', v_main_wallet
      );
    END IF;
  END IF;

  INSERT INTO vault_payout_schedules (
    user_id,
    budget_plan_id,
    payout_account_id,
    total_amount,
    payout_amount,
    net_payout_amount,
    fee_percentage,
    fee_amount,
    frequency,
    duration,
    start_date,
    next_payout_date,
    day_of_week,
    payout_hour,
    payout_minute,
    metadata
  ) VALUES (
    v_uid,
    p_budget_plan_id,
    p_payout_account_id,
    p_total_amount,
    v_per,
    v_net,
    v_fee_pct,
    v_total_fees,
    p_frequency,
    p_duration,
    p_start_date,
    p_next_payout_date,
    p_day_of_week,
    p_payout_hour,
    p_payout_minute,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_schedule_id;

  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    p_budget_plan_id,
    v_plan_wallet_id,
    'withdrawal',
    p_total_amount,
    'Vault scheduled payout commitment (schedule ' || v_schedule_id::text || ')'
  )
  RETURNING id INTO v_pt_id;

  UPDATE vault_payout_schedules
  SET plan_transaction_id = v_pt_id
  WHERE id = v_schedule_id;

  IF v_total_fees > 0 THEN
    PERFORM allow_wallet_update();
    UPDATE wallets
    SET
      balance = balance - v_total_fees,
      updated_at = now()
    WHERE user_id = v_uid;

    PERFORM record_user_fee(
      v_uid,
      'other',
      v_schedule_id,
      'plan_creation',
      v_total_fees,
      'NGN',
      p_total_amount,
      v_fee_pct,
      jsonb_build_object(
        'kind', 'vault_payout_schedule',
        'net_payout_amount', v_net,
        'frequency', p_frequency,
        'budget_plan_id', p_budget_plan_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', v_schedule_id,
    'plan_transaction_id', v_pt_id,
    'fee_amount', v_total_fees,
    'net_payout_amount', v_net,
    'per_payout_amount', v_per,
    'fee_breakdown', v_fee_json
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vault_payout_schedule(
  uuid, uuid, numeric, text, integer, date, date, integer, integer, integer, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.create_vault_payout_schedule IS
  'Creates a vault payout schedule: upfront withdrawal from plan wallet, fees from main wallet.';
