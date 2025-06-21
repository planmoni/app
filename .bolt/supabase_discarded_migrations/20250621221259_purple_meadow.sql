/*
  # Add Available Balance to Wallets Table

  1. New Columns
    - `available_balance` (numeric) - Represents the balance available for spending (total balance minus locked balance)
  
  2. Changes
    - Add available_balance column to wallets table
    - Create a trigger to automatically calculate available_balance when balance or locked_balance changes
*/

-- Add available_balance column to wallets table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'available_balance'
  ) THEN
    ALTER TABLE wallets ADD COLUMN available_balance numeric DEFAULT 0 CHECK (available_balance >= 0);
  END IF;
END $$;

-- Update existing wallets to set available_balance = balance - locked_balance
UPDATE wallets SET available_balance = balance - locked_balance;

-- Create or replace function to calculate available balance
CREATE OR REPLACE FUNCTION calculate_available_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.available_balance = NEW.balance - NEW.locked_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_available_balance ON wallets;

-- Create trigger to automatically update available_balance when balance or locked_balance changes
CREATE TRIGGER update_available_balance
BEFORE INSERT OR UPDATE OF balance, locked_balance ON wallets
FOR EACH ROW
EXECUTE FUNCTION calculate_available_balance();

-- Update the add_funds function to handle available_balance
CREATE OR REPLACE FUNCTION add_funds(p_user_id uuid, p_amount numeric)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_result json;
BEGIN
  -- Check if amount is positive
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Get wallet ID
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Create wallet if it doesn't exist
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (p_user_id, p_amount, 0, p_amount)
    RETURNING id INTO v_wallet_id;
    
    v_result := json_build_object('success', true, 'wallet_id', v_wallet_id);
  ELSE
    -- Update existing wallet
    UPDATE wallets
    SET balance = balance + p_amount
    WHERE id = v_wallet_id;
    
    v_result := json_build_object('success', true, 'wallet_id', v_wallet_id);
  END IF;
  
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
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the lock_funds function to handle available_balance
CREATE OR REPLACE FUNCTION lock_funds(p_user_id uuid, p_amount numeric)
RETURNS json AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_locked_balance numeric;
  v_available_balance numeric;
  v_result json;
BEGIN
  -- Check if amount is positive
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Get wallet details
  SELECT id, balance, locked_balance, available_balance 
  INTO v_wallet_id, v_balance, v_locked_balance, v_available_balance
  FROM wallets 
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check if there's enough available balance
  IF v_available_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient available balance');
  END IF;
  
  -- Update wallet
  UPDATE wallets
  SET locked_balance = locked_balance + p_amount
  WHERE id = v_wallet_id;
  
  RETURN json_build_object('success', true, 'wallet_id', v_wallet_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;