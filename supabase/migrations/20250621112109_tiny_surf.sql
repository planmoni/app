/*
  # Fix Lock Funds Function
  
  1. Problem
    - The current lock_funds function has issues with balance checking
    - It's causing "Insufficient available balance" errors even when there is enough balance
  
  2. Solution
    - Create a new direct_lock_funds function that properly handles balance checking
    - This function will directly update the wallet balance and locked_balance
*/

-- Create a new direct_lock_funds function that properly handles balance checking
CREATE OR REPLACE FUNCTION direct_lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_record wallets%ROWTYPE;
  v_available_balance numeric;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Get the wallet record with FOR UPDATE to lock the row
  SELECT * INTO v_wallet_record
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  -- Calculate available balance
  v_available_balance := v_wallet_record.balance - v_wallet_record.locked_balance;
  
  -- Check if sufficient funds are available
  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Required: %, Available: %', p_amount, v_available_balance;
  END IF;

  -- Lock the funds by increasing locked_balance
  UPDATE wallets
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create a transaction record for the locked funds
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'payout',
    p_amount,
    'pending',
    'wallet',
    'locked_balance',
    'Funds locked for payout plan'
  );
END;
$$;