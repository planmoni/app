/*
  # Add Partner Context to Existing Tables
  
  This migration adds partner_id columns to existing tables to support
  multi-tenancy while maintaining backward compatibility with B2C users.
  
  All partner_id columns are nullable to ensure existing B2C functionality
  continues to work without modification.
*/

-- Add partner_id to payout_plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE payout_plans ADD COLUMN partner_id uuid;
    
    -- Add foreign key constraint if partners table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      ALTER TABLE payout_plans 
      ADD CONSTRAINT payout_plans_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Add partner_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN partner_id uuid;
    
    -- Add foreign key constraint if partners table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      ALTER TABLE transactions 
      ADD CONSTRAINT transactions_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Add partner_id to bank_accounts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' AND column_name = 'partner_id'
    ) THEN
      ALTER TABLE bank_accounts ADD COLUMN partner_id uuid;
      
      -- Add foreign key constraint if partners table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
        ALTER TABLE bank_accounts 
        ADD CONSTRAINT bank_accounts_partner_id_fkey 
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Add partner_id to payout_accounts table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_accounts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_accounts' AND column_name = 'partner_id'
    ) THEN
      ALTER TABLE payout_accounts ADD COLUMN partner_id uuid;
      
      -- Add foreign key constraint if partners table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
        ALTER TABLE payout_accounts 
        ADD CONSTRAINT payout_accounts_partner_id_fkey 
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Create indexes for partner context queries
CREATE INDEX IF NOT EXISTS idx_payout_plans_partner ON payout_plans(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_partner ON transactions(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_partner ON bank_accounts(partner_id) WHERE partner_id IS NOT NULL;

-- Add index for payout_accounts if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_accounts') THEN
    CREATE INDEX IF NOT EXISTS idx_payout_accounts_partner ON payout_accounts(partner_id) WHERE partner_id IS NOT NULL;
  END IF;
END $$;

-- Update RLS policies to support partner context
-- Note: Existing policies remain, these add partner-based access

-- Add policy for partners to view their payout plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payout_plans' 
    AND policyname = 'Partners can view their payout plans'
  ) THEN
    CREATE POLICY "Partners can view their payout plans"
      ON payout_plans
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add policy for partners to view their transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transactions' 
    AND policyname = 'Partners can view their transactions'
  ) THEN
    CREATE POLICY "Partners can view their transactions"
      ON transactions
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add policy for partners to view their bank accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bank_accounts' 
    AND policyname = 'Partners can view their bank accounts'
  ) THEN
    CREATE POLICY "Partners can view their bank accounts"
      ON bank_accounts
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
