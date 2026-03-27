-- Update charge_plan_fee to deduct fee from both balance and locked_balance (net the locked plan amount)
-- Maintains idempotency and recording of user_fee_events. Keeps SECURITY DEFINER and GRANTs.

-- Create audit table to log fee charges with before/after wallet snapshots
CREATE TABLE IF NOT EXISTS user_fee_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  action text NOT NULL,
  fee_amount numeric NOT NULL,
  fee_percentage numeric,
  plan_total_amount numeric,
  plan_net_payout_amount numeric,
  plan_frequency text,
  wallet_before jsonb NOT NULL,
  wallet_after jsonb NOT NULL,
  deltas jsonb NOT NULL,
  event_id uuid,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_fee_audit_logs_user ON user_fee_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fee_audit_logs_plan ON user_fee_audit_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_fee_audit_logs_time ON user_fee_audit_logs(executed_at);

CREATE OR REPLACE FUNCTION charge_plan_fee(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_existing uuid;
  v_fee_amount numeric;
  v_fee_percent numeric;
  v_event_id uuid;
  v_wallet wallets%ROWTYPE;
  v_old_balance numeric;
  v_old_locked numeric;
  v_old_available numeric;
  v_new_balance numeric;
  v_new_locked numeric;
  v_new_available numeric;
BEGIN
  -- Fetch plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  -- Idempotency: return if already charged
  SELECT id INTO v_existing
  FROM user_fee_events
  WHERE source_type = 'payout_plan' AND source_id = p_plan_id AND fee_type = 'plan_creation'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_charged', true, 'event_id', v_existing);
  END IF;

  -- Determine fee
  v_fee_amount := COALESCE(v_plan.fee_amount, 0);
  v_fee_percent := COALESCE(v_plan.fee_percentage, NULL);
  IF v_fee_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', null, 'message', 'No fee to charge');
  END IF;

  -- Lock wallet
  PERFORM allow_wallet_update();
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_plan.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Snapshot BEFORE values
  v_old_balance := COALESCE(v_wallet.balance, 0);
  v_old_locked := COALESCE(v_wallet.locked_balance, 0);
  v_old_available := GREATEST(0, v_old_balance - v_old_locked);

  -- Deduct the fee from BOTH balance and locked_balance to net the plan immediately
  -- This ensures examples:
  --  A) avail=50,000 -> lock 50,000 -> fee 750 => balance=49,250, locked=49,250, available=0
  --  B) avail=40,000 -> lock 20,000 -> fee 300 => balance=39,700, locked=19,700, available=20,000
  UPDATE wallets
  SET
    balance = balance - v_fee_amount,
    locked_balance = GREATEST(0, COALESCE(locked_balance, 0) - v_fee_amount),
    updated_at = now()
  WHERE user_id = v_plan.user_id
  RETURNING balance, locked_balance INTO v_new_balance, v_new_locked;

  -- Recompute available after updates
  v_new_available := GREATEST(0, v_new_balance - COALESCE(v_new_locked, 0));

  PERFORM allow_wallet_update();
  UPDATE wallets
  SET available_balance = v_new_available, updated_at = now()
  WHERE user_id = v_plan.user_id;

  -- Record the fee event (audit/rollup)
  v_event_id := record_user_fee(
    v_plan.user_id,
    'payout_plan',
    p_plan_id,
    'plan_creation',
    v_fee_amount,
    'NGN',
    v_plan.total_amount,
    v_fee_percent,
    jsonb_build_object('net_payout_amount', v_plan.net_payout_amount, 'frequency', v_plan.frequency)
  );

  -- Insert audit log with before/after snapshots and deltas
  INSERT INTO user_fee_audit_logs (
    user_id,
    plan_id,
    action,
    fee_amount,
    fee_percentage,
    plan_total_amount,
    plan_net_payout_amount,
    plan_frequency,
    wallet_before,
    wallet_after,
    deltas,
    event_id,
    executed_at
  ) VALUES (
    v_plan.user_id,
    p_plan_id,
    'charge_plan_fee',
    v_fee_amount,
    v_fee_percent,
    v_plan.total_amount,
    v_plan.net_payout_amount,
    v_plan.frequency,
    jsonb_build_object(
      'balance', v_old_balance,
      'locked_balance', v_old_locked,
      'available_balance', v_old_available
    ),
    jsonb_build_object(
      'balance', v_new_balance,
      'locked_balance', v_new_locked,
      'available_balance', v_new_available
    ),
    jsonb_build_object(
      'balance_delta', v_new_balance - v_old_balance,
      'locked_delta', v_new_locked - v_old_locked,
      'available_delta', v_new_available - v_old_available
    ),
    v_event_id,
    now()
  );

  RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', v_event_id);
END;
$;

GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO service_role;
