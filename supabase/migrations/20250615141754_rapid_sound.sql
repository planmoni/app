/*
  # Fix Lock Funds Function to Properly Deduct from Balance
  
  1. Problem
    - Currently, the lock_funds function only increases locked_balance but doesn't decrease the available balance
    - This causes the total wallet amount (balance + locked_balance) to be incorrect
  
  2. Solution
    - Update the lock_funds function to properly deduct the amount from balance when locking funds
    - This ensures the total wallet amount remains consistent
*/

-- Create or replace the lock_funds function with proper balance deduction
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Check if sufficient funds are available
  IF NOT EXISTS (
    SELECT 1 FROM wallets
    WHERE user_id = p_user_id
    AND (balance - locked_balance) >= p_amount
  ) THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- Lock the funds by increasing locked_balance AND decreasing balance
  -- This is the key fix - we now properly deduct from the balance
  UPDATE wallets
  SET 
    balance = balance - p_amount,
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;