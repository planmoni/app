/*
  # Fix lock_funds function parameter ambiguity

  1. Changes
    - Drop existing lock_funds functions to remove ambiguity
    - Create a single lock_funds function with unambiguous parameter names
    - Update add_funds function to use consistent parameter naming

  2. Security
    - Maintain existing security checks and constraints
    - Ensure proper error handling and validation
*/

-- Drop existing lock_funds functions to remove ambiguity
DROP FUNCTION IF EXISTS public.lock_funds(p_user_id uuid, p_amount numeric);
DROP FUNCTION IF EXISTS public.lock_funds(p_amount numeric, p_user_id uuid);

-- Drop existing add_funds function to update parameter names
DROP FUNCTION IF EXISTS public.add_funds(p_user_id uuid, p_amount numeric);

-- Create lock_funds function with unambiguous parameter names
CREATE OR REPLACE FUNCTION public.lock_funds(
  arg_user_id uuid,
  arg_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance numeric;
  current_locked numeric;
  available_balance numeric;
BEGIN
  -- Validate input parameters
  IF arg_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get current wallet balances
  SELECT balance, locked_balance 
  INTO current_balance, current_locked
  FROM wallets 
  WHERE user_id = arg_user_id;
  
  -- Check if wallet exists
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Calculate available balance
  available_balance := current_balance - current_locked;
  
  -- Check if sufficient funds are available
  IF available_balance < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient available balance'
    );
  END IF;
  
  -- Lock the funds by increasing locked_balance
  UPDATE wallets 
  SET 
    locked_balance = locked_balance + arg_amount,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
  -- Return success
  RETURN jsonb_build_object('success', true);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Failed to lock funds: ' || SQLERRM
    );
END;
$$;

-- Create add_funds function with consistent parameter naming
CREATE OR REPLACE FUNCTION public.add_funds(
  arg_user_id uuid,
  arg_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate input parameters
  IF arg_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Insert or update wallet
  INSERT INTO wallets (user_id, balance, locked_balance)
  VALUES (arg_user_id, arg_amount, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = wallets.balance + arg_amount,
    updated_at = now();
  
  -- Return success
  RETURN jsonb_build_object('success', true);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Failed to add funds: ' || SQLERRM
    );
END;
$$;