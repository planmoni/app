/*
  # Wallet View Policy

  1. New Policies
    - Add a policy to allow users to view only their own wallet
    - Ensure users cannot view other users' wallets
  
  2. Security
    - Enforces row-level security for wallet data
    - Restricts access based on user authentication
*/

-- First, ensure RLS is enabled on the wallets table
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to view only their own wallet
CREATE POLICY "Users can view own wallet"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a policy that allows users to update their own wallet
-- This is needed for operations that might update the wallet directly
CREATE POLICY "Users can update own wallet"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a policy for admins to view all wallets
CREATE POLICY "Admins can view all wallets"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Create a policy for admins to update all wallets
CREATE POLICY "Admins can update all wallets"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (is_admin());