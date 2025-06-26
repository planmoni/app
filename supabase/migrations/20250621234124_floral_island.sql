/*
  # Fix wallet balance operations

  1. Database Functions
    - Create or update wallet management functions
    - Add fund locking and unlocking capabilities
    - Ensure proper balance calculations

  2. Security
    - Maintain existing RLS policies
    - Add proper error handling in functions

  3. Data Integrity
    - Add constraints to prevent negative balances
    - Ensure atomic operations for fund transfers
*/

-- Create or replace the add_funds function
CREATE OR REPLACE FUNCTION add_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get or create wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id;

  IF NOT FOUND THEN
    -- Create new wallet
    INSERT INTO wallets (user_id, balance, locked_balance)
    VALUES (arg_user_id, arg_amount, 0)
    RETURNING * INTO wallet_record;
  ELSE
    -- Update existing wallet
    UPDATE wallets
    SET balance = COALESCE(balance, 0) + arg_amount,
        updated_at = now()
    WHERE user_id = arg_user_id
    RETURNING * INTO wallet_record;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the lock_funds function
CREATE OR REPLACE FUNCTION lock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
  available_balance numeric;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate available balance
  available_balance := COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0);

  -- Check if sufficient funds available
  IF available_balance < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s, Required: %s', available_balance, arg_amount)
    );
  END IF;

  -- Lock the funds
  UPDATE wallets
  SET locked_balance = COALESCE(locked_balance, 0) + arg_amount,
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the unlock_funds function
CREATE OR REPLACE FUNCTION unlock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient locked funds
  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient locked balance. Locked: %s, Required: %s', COALESCE(wallet_record.locked_balance, 0), arg_amount)
    );
  END IF;

  -- Unlock the funds
  UPDATE wallets
  SET locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the transfer_funds function (for payouts)
CREATE OR REPLACE FUNCTION transfer_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient locked funds
  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient locked balance for transfer. Locked: %s, Required: %s', COALESCE(wallet_record.locked_balance, 0), arg_amount)
    );
  END IF;

  -- Transfer funds (reduce both balance and locked_balance)
  UPDATE wallets
  SET balance = COALESCE(balance, 0) - arg_amount,
      locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Ensure all existing wallets have proper default values
UPDATE wallets 
SET balance = COALESCE(balance, 0),
    locked_balance = COALESCE(locked_balance, 0)
WHERE balance IS NULL OR locked_balance IS NULL;

-- Add additional constraints to ensure data integrity
DO $$
BEGIN
  -- Add balance check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallets_balance_check' 
    AND table_name = 'wallets'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0);
  END IF;

  -- Add locked_balance check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallets_locked_balance_check' 
    AND table_name = 'wallets'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_locked_balance_check CHECK (locked_balance >= 0);
  END IF;

  -- Add constraint to ensure locked_balance doesn't exceed balance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallets_locked_balance_limit_check' 
    AND table_name = 'wallets'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_locked_balance_limit_check CHECK (locked_balance <= balance);
  END IF;
END $$;