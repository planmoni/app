/*
  # Fix negative locked_balance and prevent future occurrences
  
  Problem:
  - Some wallets have negative locked_balance due to the buggy charge_plan_fee() function
  - This violates the wallets_locked_balance_limit_check constraint
  - recalculate_locked_balance() should ensure locked_balance is never negative
  
  Solution:
  1. Fix all wallets with negative locked_balance by setting it to 0
  2. Update recalculate_locked_balance() to ensure locked_balance >= 0
*/

-- Step 1: Fix all wallets with negative locked_balance
UPDATE wallets
SET 
  locked_balance = 0,
  available_balance = balance - 0,
  updated_at = now()
WHERE locked_balance < 0;

-- Step 2: Ensure recalculate_locked_balance() never sets locked_balance to negative
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
