/*
  # Add Unique Constraint on Transaction Reference
  
  1. Problem
    - Transactions can be processed multiple times due to race conditions
    - No database-level protection against duplicate transaction references
    - This causes wallet balance issues and duplicate emails
  
  2. Solution
    - Add unique constraint on reference field for deposit transactions
    - This prevents duplicate processing at the database level
    - Only apply to deposit transactions since other types might have different reference patterns
*/

-- Add unique constraint on reference field for deposit transactions
-- This will prevent duplicate processing of the same transaction
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transactions_reference_unique' 
    AND table_name = 'transactions'
  ) THEN
    -- Add unique constraint on reference field
    ALTER TABLE transactions 
    ADD CONSTRAINT transactions_reference_unique 
    UNIQUE (reference) 
    WHERE reference IS NOT NULL;
  END IF;
END $$;

-- Add index for better performance on reference lookups
CREATE INDEX IF NOT EXISTS idx_transactions_reference 
ON transactions(reference) 
WHERE reference IS NOT NULL;

-- Add index for better performance on deposit transactions
CREATE INDEX IF NOT EXISTS idx_transactions_deposit_reference 
ON transactions(reference, type, source) 
WHERE type = 'deposit' AND source = 'Paystack Virtual Account'; 