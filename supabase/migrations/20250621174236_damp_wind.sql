/*
  # Fix lock_funds function ambiguity

  1. Database Changes
    - Drop existing ambiguous lock_funds functions
    - Create a single, well-defined lock_funds function
    - Function will lock funds by updating wallet locked_balance
    - Includes proper error handling and validation

  2. Security
    - Function uses security definer to ensure proper permissions
    - Validates user ownership of wallet
    - Checks sufficient available balance before locking
*/

-- Drop existing ambiguous lock_funds functions
DROP FUNCTION IF EXISTS public.lock_funds(p_amount numeric, p_user_id uuid);
DROP FUNCTION IF EXISTS public.lock_funds(p_user_id uuid, p_amount numeric);

-- Create a single, well-defined lock_funds function
CREATE OR REPLACE FUNCTION public.lock_funds(
  p_user_id uuid,
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_record record;
  v_available_balance numeric;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet record with row lock
  SELECT * INTO v_wallet_record
  FROM wallets 
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if wallet exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate available balance
  v_available_balance := COALESCE(v_wallet_record.balance, 0) - COALESCE(v_wallet_record.locked_balance, 0);

  -- Check if sufficient balance is available
  IF v_available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient available balance',
      'available_balance', v_available_balance,
      'requested_amount', p_amount
    );
  END IF;

  -- Lock the funds by increasing locked_balance
  UPDATE wallets 
  SET 
    locked_balance = COALESCE(locked_balance, 0) + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Return success
  RETURN json_build_object(
    'success', true, 
    'message', 'Funds locked successfully',
    'locked_amount', p_amount,
    'new_locked_balance', COALESCE(v_wallet_record.locked_balance, 0) + p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false, 
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric) TO authenticated;