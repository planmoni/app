/*
  # Fix wallet table and policies

  1. Table Creation
    - Create wallets table if it doesn't exist
    - Add balance and locked_balance fields with checks
  
  2. Security
    - Enable RLS on wallets table
    - Skip policies that already exist
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

-- Skip creating the policy that already exists
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

-- Skip creating the policy that already exists
-- CREATE POLICY "Users can insert own wallet"
--   ON wallets
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() = user_id);