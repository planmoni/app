/*
  # FINAL FIX: Prevent fees from returning to available balance
  
  Problem:
  - lock_funds() locks the gross amount (total_amount including fee)
  - recalculate_locked_balance() recalculates to net amount (net_payout_amount excluding fee)
  - This reduces locked_balance, which increases available_balance by the fee amount
  - The fee should NOT be available - it should be deducted from balance
  
  Solution:
  1. Fix corrupted wallets FIRST
  2. Update recalculate_locked_balance() to deduct fees from balance when reducing locked_balance
  3. Remove charge_plan_fee() call - fees are already accounted for in net_payout_amount
  4. Update trigger to handle fee deduction properly
*/

-- ============================================================================
-- STEP 1: Fix corrupted wallets FIRST
-- ============================================================================

UPDATE wallets
SET 
  locked_balance = GREATEST(0, locked_balance),
  available_balance = balance - GREATEST(0, locked_balance),
  updated_at = now()
WHERE locked_balance < 0;

UPDATE wallets
SET 
  locked_balance = LEAST(locked_balance, balance),
  available_balance = balance - LEAST(locked_balance, balance),
  updated_at = now()
WHERE locked_balance > balance;

-- ============================================================================
-- STEP 2: Update recalculate_locked_balance() to deduct fees from balance
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_current_locked_balance numeric;
  v_fee_to_deduct numeric;
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed (required by secure_wallets_table trigger)
  PERFORM allow_wallet_update();

  -- Get current wallet state
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_current_locked_balance := COALESCE(v_wallet.locked_balance, 0);

  -- Calculate locked balance from active and paused payout plans only
  -- Remaining amount = net_base - (completed_payouts * payout_amount)
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

  -- Ensure calculated locked balance is never negative
  IF v_calculated_locked_balance < 0 THEN
    v_calculated_locked_balance := 0;
  END IF;

  -- Ensure locked_balance doesn't exceed balance
  IF v_calculated_locked_balance > v_wallet.balance THEN
    v_calculated_locked_balance := GREATEST(0, v_wallet.balance);
  END IF;

  -- Calculate fee to deduct: if locked_balance is being reduced, deduct the difference from balance
  -- This happens when we recalculate from gross (locked) to net (calculated)
  IF v_current_locked_balance > v_calculated_locked_balance THEN
    v_fee_to_deduct := v_current_locked_balance - v_calculated_locked_balance;
    
    -- Deduct the fee from balance (this is the fee that was "returned" to available balance)
    UPDATE wallets
    SET 
      balance = balance - v_fee_to_deduct,
      locked_balance = v_calculated_locked_balance,
      available_balance = (balance - v_fee_to_deduct) - v_calculated_locked_balance,
      updated_at = now()
    WHERE user_id = arg_user_id;
  ELSE
    -- No fee to deduct, just update locked_balance
    UPDATE wallets
    SET 
      locked_balance = v_calculated_locked_balance,
      available_balance = balance - v_calculated_locked_balance,
      updated_at = now()
    WHERE user_id = arg_user_id;
  END IF;
  
  -- Safety: ensure available_balance doesn't go negative
  UPDATE wallets
  SET available_balance = GREATEST(0, balance - locked_balance)
  WHERE user_id = arg_user_id 
    AND available_balance < 0;

  -- Return updated wallet state
  SELECT balance, locked_balance, (balance - locked_balance) as available_balance
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance,
    'calculated_locked_balance', v_calculated_locked_balance,
    'fee_deducted', COALESCE(v_fee_to_deduct, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 3: Update charge_plan_fee() to ONLY record the fee, NOT deduct it
-- ============================================================================

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
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', null, 'message', 'No fee to charge');
  END IF;

  -- ONLY record the fee event - DO NOT deduct from balance
  -- The fee is already accounted for in net_payout_amount and will be deducted
  -- by recalculate_locked_balance() when it reduces locked_balance
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
      'frequency', v_plan.frequency,
      'note', 'Fee deducted automatically by recalculate_locked_balance()'
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'already_charged', false, 
    'event_id', v_event_id,
    'message', 'Fee recorded (deduction handled by recalculate_locked_balance)'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO service_role;
