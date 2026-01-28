/*
  # Combined Fix: Fix corrupted wallets + Update charge_plan_fee + Prevent future issues
  
  This migration combines all fixes in the correct order:
  1. Fix corrupted wallets FIRST (before any function updates)
  2. Update charge_plan_fee() to only deduct from balance
  3. Update recalculate_locked_balance() to prevent negative values
*/

-- ============================================================================
-- STEP 1: Fix corrupted wallets FIRST (must happen before any updates)
-- ============================================================================

-- Fix all wallets with negative locked_balance
UPDATE wallets
SET 
  locked_balance = GREATEST(0, locked_balance),
  available_balance = balance - GREATEST(0, locked_balance),
  updated_at = now()
WHERE locked_balance < 0;

-- Ensure locked_balance never exceeds balance
UPDATE wallets
SET 
  locked_balance = LEAST(locked_balance, balance),
  available_balance = balance - LEAST(locked_balance, balance),
  updated_at = now()
WHERE locked_balance > balance;

-- ============================================================================
-- STEP 2: Update charge_plan_fee() to only deduct from balance
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
  v_wallet wallets%ROWTYPE;
  v_new_balance numeric;
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

  -- Calculate new balance
  v_new_balance := v_wallet.balance - v_fee_amount;
  
  -- Safety check: ensure new balance is not negative
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to charge fee');
  END IF;

  -- Deduct the fee ONLY from balance (not locked_balance)
  -- locked_balance is already correctly calculated as net_payout_amount (excluding fee)
  UPDATE wallets
  SET 
    balance = v_new_balance,
    available_balance = v_new_balance - GREATEST(0, locked_balance),
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

-- ============================================================================
-- STEP 3: Update recalculate_locked_balance() to prevent negative values
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed (required by secure_wallets_table trigger)
  PERFORM allow_wallet_update();

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

  -- Get wallet with row lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Ensure locked_balance doesn't exceed balance
  IF v_calculated_locked_balance > v_wallet.balance THEN
    v_calculated_locked_balance := GREATEST(0, v_wallet.balance);
  END IF;

  -- Update locked balance only (available_balance is derived)
  UPDATE wallets
  SET 
    locked_balance = v_calculated_locked_balance,
    available_balance = balance - v_calculated_locked_balance,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
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
    'calculated_locked_balance', v_calculated_locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
