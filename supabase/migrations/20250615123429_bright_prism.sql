/*
  # Fix bank_account_id nullable constraint
  
  1. Changes
    - Make bank_account_id column nullable in payout_plans table
    - This allows payout plans to use either bank_accounts or payout_accounts
  
  2. Security
    - No changes to RLS policies
*/

-- Make bank_account_id nullable to support payout accounts
ALTER TABLE payout_plans 
ALTER COLUMN bank_account_id DROP NOT NULL;