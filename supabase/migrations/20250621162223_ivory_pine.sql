/*
  # Fix Insufficient Available Balance Error
  
  1. Problem
    - Users are seeing "Insufficient available balance" errors when creating payout plans
    - The issue is in how the available balance is calculated and checked
  
  2. Solution
    - Create a new lock_funds function with proper balance checking
    - Ensure the function handles the balance check and update atomically
    - Add detailed error messages for better debugging
    - Create a version with reversed parameters for backward compatibility
*/

-- Create a new lock_funds function with proper balance checking
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
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

-- Create a version with reversed parameters for backward compatibility
CREATE OR REPLACE FUNCTION lock_funds(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the main function with parameters in the correct order
  PERFORM lock_funds(p_amount, p_user_id);
END;
$$;