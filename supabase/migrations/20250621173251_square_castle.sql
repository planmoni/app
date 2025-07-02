/*
  # Wallet and Balance Management

  1. New Tables
    - `wallets` - Stores user wallet information with balance and locked funds
  
  2. Security
    - Enable RLS on wallets table
    - Add policies for wallet access control
  
  3. Functions
    - Add function to calculate available balance
*/

-- Create wallet table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  locked_balance numeric DEFAULT 0 CHECK (locked_balance >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable row level security
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create policies using DO blocks to check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' AND policyname = 'Users can view own wallet'
  ) THEN
    CREATE POLICY "Users can view own wallet"
      ON wallets
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' AND policyname = 'Users can update own wallet'
  ) THEN
    CREATE POLICY "Users can update own wallet"
      ON wallets
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' AND policyname = 'Users can insert own wallet'
  ) THEN
    CREATE POLICY "Users can insert own wallet"
      ON wallets
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Create a function to calculate available balance
CREATE OR REPLACE FUNCTION get_available_balance(wallet_id uuid)
RETURNS numeric AS $$
DECLARE
  wallet_balance numeric;
  wallet_locked numeric;
BEGIN
  SELECT balance, locked_balance INTO wallet_balance, wallet_locked
  FROM wallets
  WHERE id = wallet_id;
  
  RETURN wallet_balance - wallet_locked;
END;
$$ LANGUAGE plpgsql;

-- Create a function to add funds to wallet
CREATE OR REPLACE FUNCTION add_funds(p_amount numeric, p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert or update wallet
  INSERT INTO wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET balance = wallets.balance + p_amount;
  
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
END;
$$ LANGUAGE plpgsql;

-- Create a function to lock funds in wallet
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_available_balance numeric;
  v_wallet_id uuid;
BEGIN
  -- Get wallet ID and check available balance
  SELECT id, (balance - locked_balance) INTO v_wallet_id, v_available_balance
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance to lock funds';
  END IF;
  
  -- Update locked balance
  UPDATE wallets
  SET locked_balance = locked_balance + p_amount
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;