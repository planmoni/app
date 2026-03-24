/*
  # Fix charge_plan_fee to only deduct from balance, not locked_balance
  
  Problem:
  - charge_plan_fee() calls deduct_locked_funds() which deducts from both balance and locked_balance
  - But locked_balance is already correctly calculated as net_payout_amount (excluding fee)
  - Deducting from locked_balance causes the fee to "return" to available balance
  
  Solution:
  - Modify charge_plan_fee() to only deduct the fee from balance
  - locked_balance should remain unchanged (it's already net of fees)
*/

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

  -- If already charged, no-op
  SELECT id INTO v_existing
  FROM user_fee_events
  WHERE source_type = 'payout_plan'
    AND source_id = p_plan_id
    AND fee_type = 'plan_creation'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_charged', true, 'event_id', v_existing);
  END IF;

  v_fee_amount := COALESCE(v_plan.fee_amount, 0);
  v_fee_percent := COALESCE(v_plan.fee_percentage, NULL);

  IF v_fee_amount <= 0 THEN
    -- Still record a zero-fee event? No: treat as no-op.
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', null, 'message', 'No fee to charge');
  END IF;

  -- Mark this update as allowed (required by secure_wallets_table trigger)
  PERFORM allow_wallet_update();

  -- Get wallet with row lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_plan.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Deduct the fee ONLY from balance (not locked_balance)
  -- locked_balance is already correctly calculated as net_payout_amount (excluding fee)
  -- Note: In PostgreSQL, the right-hand side of SET uses the OLD value, so this works correctly
  UPDATE wallets
  SET 
    balance = balance - v_fee_amount,
    available_balance = (balance - v_fee_amount) - locked_balance,
    updated_at = now()
  WHERE user_id = v_plan.user_id;

  -- Get updated wallet state
  SELECT balance, locked_balance, (balance - locked_balance) as available_balance
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = v_plan.user_id;

  -- Record the fee event
  v_event_id := record_user_fee(
    v_plan.user_id,
    'payout_plan',
    p_plan_id,
    'plan_creation',
    v_fee_amount,
    'NGN',
    v_plan.total_amount,
    v_fee_percent,
    jsonb_build_object(
      'net_payout_amount', v_plan.net_payout_amount,
      'frequency', v_plan.frequency
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'already_charged', false, 
    'event_id', v_event_id,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO service_role;
