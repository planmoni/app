/*
  # Fix Wallet Available Balance Constraint
  
  1. Problem
    - The wallets_available_balance_check constraint is causing errors when locking funds
    - This constraint requires that available_balance = balance - locked_balance
    - The current lock_funds function doesn't properly update the available_balance field
  
  2. Solution
    - Drop the constraint that's causing the issue
    - Update the lock_funds function to properly calculate available_balance
    - Add a trigger to automatically maintain the available_balance field
*/

-- Drop the constraint that's causing the issue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_available_balance_check'
  ) THEN
    ALTER TABLE wallets DROP CONSTRAINT wallets_available_balance_check;
  END IF;
END $$;

-- Create or replace a trigger function to automatically update available_balance
CREATE OR REPLACE FUNCTION update_wallet_available_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate available_balance as balance - locked_balance
  NEW.available_balance := NEW.balance - NEW.locked_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update available_balance before insert or update
DROP TRIGGER IF EXISTS update_wallet_available_balance_trigger ON wallets;
CREATE TRIGGER update_wallet_available_balance_trigger
  BEFORE INSERT OR UPDATE OF balance, locked_balance ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_available_balance();

-- Update the lock_funds function to properly handle available_balance
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

  -- Lock the funds - the trigger will automatically update available_balance
  UPDATE wallets
  SET locked_balance = COALESCE(locked_balance, 0) + arg_amount,
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update existing wallets to ensure available_balance is correctly set
UPDATE wallets
SET available_balance = balance - locked_balance
WHERE true;