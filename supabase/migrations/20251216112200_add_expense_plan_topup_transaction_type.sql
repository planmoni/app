/*
  # Add expense_plan_topup to transaction types
  
  The expense_plan_topup transaction type is used when transferring funds
  from user wallet to expense plans. This migration adds it to the allowed
  transaction types constraint.
*/

-- Drop the existing constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add the constraint with expense_plan_topup included
ALTER TABLE transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('deposit', 'payout', 'withdrawal', 'referral_bonus', 'expense_plan_topup'));

COMMENT ON COLUMN transactions.type IS 'Transaction type: deposit, payout, withdrawal, referral_bonus, or expense_plan_topup (for wallet to expense plan transfers)';

