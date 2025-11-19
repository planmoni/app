-- Fix RLS policies for safehaven_accounts
-- Add INSERT and UPDATE policies for authenticated users

-- Add INSERT policy for safehaven_accounts
CREATE POLICY "Users can insert own safehaven accounts"
  ON safehaven_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for safehaven_accounts
CREATE POLICY "Users can update own safehaven accounts"
  ON safehaven_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

