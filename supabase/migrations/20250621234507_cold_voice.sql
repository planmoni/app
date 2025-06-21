/*
  # Add missing balance columns to wallets table

  1. Changes
    - Add `balance` column (numeric, default 0)
    - Add `locked_balance` column (numeric, default 0)
    - Add constraints to ensure balance values are non-negative
    - Add constraint to ensure locked_balance doesn't exceed balance

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Add balance column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'balance'
  ) THEN
    ALTER TABLE wallets ADD COLUMN balance numeric DEFAULT 0;
  END IF;
END $$;

-- Add locked_balance column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'locked_balance'
  ) THEN
    ALTER TABLE wallets ADD COLUMN locked_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Add constraints to ensure balance values are valid
DO $$
BEGIN
  -- Add balance check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_balance_check'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0);
  END IF;

  -- Add locked_balance check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_locked_balance_check'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_locked_balance_check CHECK (locked_balance >= 0);
  END IF;

  -- Add constraint to ensure locked_balance doesn't exceed balance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_locked_balance_limit_check'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_locked_balance_limit_check CHECK (locked_balance <= balance);
  END IF;
END $$;