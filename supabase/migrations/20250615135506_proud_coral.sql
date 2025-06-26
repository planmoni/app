/*
  # Fix lock_funds Function Overloading Issue
  
  1. Problem
    - There are two versions of the lock_funds function with different parameter types
    - This causes ambiguity when the function is called
  
  2. Solution
    - Drop the incorrect version of the function
    - Keep only the correct version with p_amount as numeric and p_user_id as uuid
*/

-- Drop all versions of the lock_funds function to start fresh
DROP FUNCTION IF EXISTS lock_funds(numeric, uuid);
DROP FUNCTION IF EXISTS lock_funds(bigint, numeric);
DROP FUNCTION IF EXISTS lock_funds(p_amount numeric, p_user_id uuid);
DROP FUNCTION IF EXISTS lock_funds(p_user_id bigint, p_amount numeric);

-- Recreate the correct version of the function
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

  -- Lock the funds
  UPDATE wallets
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;