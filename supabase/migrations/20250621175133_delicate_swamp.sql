/*
  # Fix wallet functions

  1. New Functions
    - `add_funds` - Function to add funds to a wallet
    - `lock_funds` - Function to lock funds in a wallet for payouts
    
  2. Changes
    - Drop existing ambiguous functions
    - Create new functions with consistent parameter order
    - Add proper error handling and validation
    - Return JSON responses with success/error information
*/

-- Drop existing ambiguous functions
DROP FUNCTION IF EXISTS public.lock_funds(p_amount numeric, p_user_id uuid);
DROP FUNCTION IF EXISTS public.lock_funds(p_user_id uuid, p_amount numeric);
DROP FUNCTION IF EXISTS public.add_funds(p_amount numeric, p_user_id uuid);
DROP FUNCTION IF EXISTS public.add_funds(p_user_id uuid, p_amount numeric);

-- Create a function to add funds to wallet
CREATE OR REPLACE FUNCTION public.add_funds(
  p_user_id uuid,
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Insert or update wallet
  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = wallets.balance + p_amount,
    updated_at = now()
  RETURNING id INTO v_wallet_id;
  
  -- Create transaction record
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
    'deposit',
    p_amount,
    'completed',
    'bank_transfer',
    'wallet',
    'Funds added to wallet'
  );

  -- Return success
  RETURN json_build_object(
    'success', true, 
    'message', 'Funds added successfully',
    'amount', p_amount,
    'wallet_id', v_wallet_id
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

-- Create a function to lock funds in wallet
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
    'new_locked_balance', COALESCE(v_wallet_record.locked_balance, 0) + p_amount,
    'available_balance', v_available_balance - p_amount
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
GRANT EXECUTE ON FUNCTION public.add_funds(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric) TO authenticated;