/*
  # Add INSERT policy for transactions table
  
  1. Security Changes
    - Add policy for authenticated users to insert their own transactions
    - Ensures user_id matches the authenticated user's ID
  
  This fixes the RLS violation error when creating new transactions.
*/

CREATE POLICY "Users can insert own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);