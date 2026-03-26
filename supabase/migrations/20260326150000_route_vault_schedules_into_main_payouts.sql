/*
  Route vault schedules into the main payout pipeline.

  1) Vault schedules still deduct gross amount upfront from plan_transactions (vault).
  2) Fees are deducted from the committed vault amount in create_vault_payout_schedule().
  3) We now also insert a payout_plans row so vault schedules appear in "Your Payout Plans"
     and are processed by existing payout workers.
  4) Skip payout_plans fee trigger for vault-sourced rows to avoid double fee debit.
*/

CREATE OR REPLACE FUNCTION public.deduct_plan_fee_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee numeric;
  v_source_kind text;
BEGIN
  v_source_kind := COALESCE(NEW.metadata->>'source_kind', '');

  -- Vault schedules already deduct fees in create_vault_payout_schedule RPC.
  IF v_source_kind = 'vault_schedule' THEN
    RETURN NEW;
  END IF;

  v_fee := COALESCE(NEW.fee_amount, 0);
  IF v_fee <= 0 THEN
    RETURN NEW;
  END IF;

  PERFORM allow_wallet_update();

  UPDATE wallets
  SET
    balance = balance - v_fee,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  PERFORM record_user_fee(
    NEW.user_id,
    'payout_plan',
    NEW.id,
    'plan_creation',
    v_fee,
    'NGN',
    NEW.total_amount,
    NEW.fee_percentage,
    jsonb_build_object(
      'net_payout_amount', NEW.net_payout_amount,
      'frequency', NEW.frequency,
      'note', 'Fee deducted by trigger deduct_plan_fee_on_insert'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

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
  v_plan_name text;
  v_pw_balance numeric;
  v_fee_json jsonb;
  v_total_fees numeric;
  v_net numeric;
  v_per numeric;
  v_fee_pct numeric := 1.5;
  v_schedule_id uuid;
  v_pt_id uuid;
  v_pa_user uuid;
  v_payout_plan_id uuid;
  v_effective_metadata jsonb;
  v_custom_dates jsonb;
  v_custom_amounts jsonb;
  v_custom_times jsonb;
  v_custom_date text;
  v_custom_amount numeric;
  v_custom_time text;
  v_has_day_of_week boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 OR p_duration IS NULL OR p_duration < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount or duration');
  END IF;

  SELECT user_id, name INTO v_plan_user, v_plan_name
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

  v_effective_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'source_kind', 'vault_schedule',
    'budget_plan_id', p_budget_plan_id
  );
  v_custom_dates := COALESCE(v_effective_metadata->'customDates', '[]'::jsonb);
  v_custom_amounts := COALESCE(v_effective_metadata->'customDateAmounts', '{}'::jsonb);
  v_custom_times := COALESCE(v_effective_metadata->'customDateTimes', '{}'::jsonb);

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payout_plans'
      AND column_name = 'day_of_week'
  ) INTO v_has_day_of_week;

  IF v_has_day_of_week THEN
    INSERT INTO payout_plans (
      user_id,
      name,
      description,
      total_amount,
      payout_amount,
      frequency,
      day_of_week,
      duration,
      start_date,
      payout_account_id,
      status,
      next_payout_date,
      emergency_withdrawal_enabled,
      fee_percentage,
      fee_amount,
      net_payout_amount,
      metadata
    ) VALUES (
      v_uid,
      COALESCE(v_plan_name, 'Vault') || ' Vault Payout Plan',
      'Vault scheduled payout',
      p_total_amount,
      v_per,
      p_frequency,
      p_day_of_week,
      p_duration,
      p_start_date,
      p_payout_account_id,
      'active',
      (p_next_payout_date::timestamp
        + make_interval(hours => p_payout_hour, mins => p_payout_minute)),
      true,
      v_fee_pct,
      v_total_fees,
      v_net,
      v_effective_metadata
    )
    RETURNING id INTO v_payout_plan_id;
  ELSE
    INSERT INTO payout_plans (
      user_id,
      name,
      description,
      total_amount,
      payout_amount,
      frequency,
      duration,
      start_date,
      payout_account_id,
      status,
      next_payout_date,
      emergency_withdrawal_enabled,
      fee_percentage,
      fee_amount,
      net_payout_amount,
      metadata
    ) VALUES (
      v_uid,
      COALESCE(v_plan_name, 'Vault') || ' Vault Payout Plan',
      'Vault scheduled payout',
      p_total_amount,
      v_per,
      p_frequency,
      p_duration,
      p_start_date,
      p_payout_account_id,
      'active',
      (p_next_payout_date::timestamp
        + make_interval(hours => p_payout_hour, mins => p_payout_minute)),
      true,
      v_fee_pct,
      v_total_fees,
      v_net,
      v_effective_metadata
    )
    RETURNING id INTO v_payout_plan_id;
  END IF;

  IF p_frequency = 'custom' AND jsonb_typeof(v_custom_dates) = 'array' THEN
    FOR v_custom_date IN
      SELECT jsonb_array_elements_text(v_custom_dates)
    LOOP
      v_custom_amount := NULLIF(replace((v_custom_amounts->>v_custom_date), ',', ''), '')::numeric;
      v_custom_time := COALESCE(NULLIF(v_custom_times->>v_custom_date, ''), '12:00');

      INSERT INTO custom_payout_dates (
        payout_plan_id,
        payout_date,
        payout_time,
        amount
      ) VALUES (
        v_payout_plan_id,
        v_custom_date::date,
        (v_custom_time || ':00')::time,
        v_custom_amount
      );
    END LOOP;
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
    v_effective_metadata || jsonb_build_object('payout_plan_id', v_payout_plan_id)
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
        'budget_plan_id', p_budget_plan_id,
        'payout_plan_id', v_payout_plan_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', v_schedule_id,
    'payout_plan_id', v_payout_plan_id,
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
