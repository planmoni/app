/*
  # Fix Wallet Table Migration

  1. New Tables
    - Ensures `wallets` table exists if not already created
    - Contains user_id, balance, locked_balance fields with appropriate constraints
  
  2. Security
    - Enables row level security on the wallets table
    - Comments out policies that already exist to prevent errors
*/

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  locked_balance numeric DEFAULT 0 CHECK (locked_balance >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Skip creating policies that already exist in the database
-- CREATE POLICY "Users can view own wallet"
--   ON wallets
--   FOR SELECT
--   TO authenticated
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can update own wallet"
--   ON wallets
--   FOR UPDATE
--   TO authenticated
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can insert own wallet"
--   ON wallets
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() = user_id);