/*
  # Fix Wallet Table and Policies

  1. Changes
     - Ensures wallet table exists with proper structure
     - Avoids creating duplicate policies by using IF NOT EXISTS
     - Adds comments to explain the purpose of each policy
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

-- Create policies with IF NOT EXISTS to avoid errors
CREATE POLICY IF NOT EXISTS "Users can view own wallet"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own wallet"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own wallet"
  ON wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

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