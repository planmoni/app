/*
  # Fix: Add deduct_locked_funds function
  
  This migration adds a function to properly deduct funds from both
  balance and locked_balance for automated payouts.
*/

-- Function to deduct locked funds for payouts
CREATE OR REPLACE FUNCTION deduct_locked_funds(
  arg_user_id uuid,
  arg_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Get current wallet state with row lock
  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Validate input amount
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  
  -- Validate locked balance
  IF v_wallet.locked_balance < arg_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient locked balance');
  END IF;
  
  -- Deduct the funds from both balance and locked_balance
  UPDATE wallets 
  SET 
    balance = balance - arg_amount,
    locked_balance = locked_balance - arg_amount,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
  -- Return updated wallet state
  SELECT balance, locked_balance, (balance - locked_balance) as available_balance
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = arg_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_locked_funds TO authenticated;

-- Grant execute permission to service role for automated payouts
GRANT EXECUTE ON FUNCTION deduct_locked_funds TO service_role;
