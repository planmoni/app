/*
  # Fix Wallet Balance Logic for Payout Plans
  
  1. Problem
    - Current implementation incorrectly checks available balance
    - Shows "insufficient balance" error even when there is enough available balance
  
  2. Solution
    - Create a new lock_funds function with proper balance checking
    - Ensure proper parameter order and validation
    - Add detailed error messages for better debugging
*/

-- Create or replace the lock_funds function with proper balance checking
CREATE OR REPLACE FUNCTION lock_funds(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
  v_available numeric;
BEGIN
  -- Get current wallet balances
  SELECT balance, locked_balance
  INTO v_balance, v_locked
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calculate available balance
  v_available := v_balance - v_locked;

  -- Check if sufficient available balance exists
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Available: %, Requested: %', v_available, p_amount;
  END IF;

  -- Lock the requested amount
  UPDATE wallets
  SET locked_balance = locked_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

END;
$$;

-- Create a function with the reverse parameter order to handle existing calls
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the main function with parameters in the correct order
  PERFORM lock_funds(p_user_id, p_amount);
END;
$$;