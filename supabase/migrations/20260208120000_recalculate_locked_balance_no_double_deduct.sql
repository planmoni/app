-- Fix: recalculate_locked_balance was deducting from balance on every reduction of locked_balance.
-- When a payout completes, completed_payouts increases, so calculated locked goes down (reduction).
-- That reduction is the payout amount we already deducted via transfer_funds. Deducting it again
-- in recalculate double-debits the user. So we never deduct from balance in recalculate;
-- only update locked_balance and available_balance. Fee must be deducted at plan creation (charge_plan_fee).

CREATE OR REPLACE FUNCTION recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_wallet wallets%ROWTYPE;
BEGIN
  PERFORM allow_wallet_update();

  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate locked balance from active and paused payout plans only (net remaining)
  SELECT COALESCE(SUM(
    (
      COALESCE(
        net_payout_amount,
        total_amount - COALESCE(fee_amount, 0),
        total_amount
      ) - (completed_payouts * payout_amount)
    )
  ), 0)
  INTO v_calculated_locked_balance
  FROM payout_plans
  WHERE user_id = arg_user_id
    AND status IN ('active', 'paused')
    AND (
      COALESCE(
        net_payout_amount,
        total_amount - COALESCE(fee_amount, 0),
        total_amount
      ) - (completed_payouts * payout_amount)
    ) > 0;

  IF v_calculated_locked_balance < 0 THEN
    v_calculated_locked_balance := 0;
  END IF;
  IF v_calculated_locked_balance > v_wallet.balance THEN
    v_calculated_locked_balance := GREATEST(0, v_wallet.balance);
  END IF;

  -- Only update locked_balance and available_balance. Do NOT deduct from balance here.
  -- (Reductions in locked are from completed payouts already debited via transfer_funds;
  -- fee is deducted at plan creation via charge_plan_fee.)
  UPDATE wallets
  SET
    locked_balance = v_calculated_locked_balance,
    available_balance = GREATEST(0, balance - v_calculated_locked_balance),
    updated_at = now()
  WHERE user_id = arg_user_id;

  SELECT balance, locked_balance, (balance - locked_balance) INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance,
    'calculated_locked_balance', v_calculated_locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION recalculate_locked_balance IS 'Recalculates locked_balance from active/paused plans; only updates locked and available_balance (never balance). Fee is deducted at plan creation.';

-- Ensure fee is deducted at plan creation (recalculate no longer deducts)
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
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  SELECT id INTO v_existing
  FROM user_fee_events
  WHERE source_type = 'payout_plan' AND source_id = p_plan_id AND fee_type = 'plan_creation'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_charged', true, 'event_id', v_existing);
  END IF;

  v_fee_amount := COALESCE(v_plan.fee_amount, 0);
  v_fee_percent := COALESCE(v_plan.fee_percentage, NULL);
  IF v_fee_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', null, 'message', 'No fee to charge');
  END IF;

  PERFORM allow_wallet_update();
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_plan.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  UPDATE wallets
  SET
    balance = balance - v_fee_amount,
    available_balance = GREATEST(0, (balance - v_fee_amount) - COALESCE(locked_balance, 0)),
    updated_at = now()
  WHERE user_id = v_plan.user_id;

  v_event_id := record_user_fee(
    v_plan.user_id, 'payout_plan', p_plan_id, 'plan_creation',
    v_fee_amount, 'NGN', v_plan.total_amount, v_fee_percent,
    jsonb_build_object('net_payout_amount', v_plan.net_payout_amount, 'frequency', v_plan.frequency)
  );

  RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', v_event_id);
END;
$$;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO service_role;
