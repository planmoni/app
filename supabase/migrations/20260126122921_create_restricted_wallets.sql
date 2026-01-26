/*
  # Create Restricted Wallets System
  
  This migration extends the wallet system with restrictions and policies for
  controlled money access in the Platform-as-a-Service model.
  
  1. New Tables
    - wallet_restrictions - Rules governing wallet access
    - wallet_policies - Policy definitions for partners
  
  2. Updates
    - Add partner_id and restriction flags to wallets table
*/

-- Add partner_id column to wallets table (nullable for B2C compatibility)
-- First add column without foreign key, then add constraint if partners table exists
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE wallets ADD COLUMN partner_id uuid;
  END IF;
  
  -- Add foreign key constraint only if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    -- Drop constraint if it exists (in case of re-run)
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'wallets' 
      AND constraint_name = 'wallets_partner_id_fkey'
    ) THEN
      ALTER TABLE wallets DROP CONSTRAINT wallets_partner_id_fkey;
    END IF;
    
    -- Add foreign key constraint
    ALTER TABLE wallets 
    ADD CONSTRAINT wallets_partner_id_fkey 
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add restriction flags to wallets table
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS is_restricted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS policy_id uuid;

-- Create wallet_restrictions table
CREATE TABLE IF NOT EXISTS wallet_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  restriction_type text NOT NULL CHECK (restriction_type IN (
    'max_balance', 'min_balance', 'daily_limit', 'transaction_limit',
    'withdrawal_limit', 'approval_required', 'time_restriction', 'purpose_restriction'
  )),
  restriction_value jsonb NOT NULL, -- Flexible value storage
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wallet_policies table
-- Handle foreign key to partners table safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_policies') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      -- Partners table exists, create with foreign key
      CREATE TABLE wallet_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        policy_rules jsonb NOT NULL,
        is_default boolean DEFAULT false,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    ELSE
      -- Partners table doesn't exist, create without foreign key (will add later)
      CREATE TABLE wallet_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid,
        name text NOT NULL,
        description text,
        policy_rules jsonb NOT NULL,
        is_default boolean DEFAULT false,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists and constraint doesn't
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'wallet_policies' 
      AND constraint_name = 'wallet_policies_partner_id_fkey'
    ) THEN
      ALTER TABLE wallet_policies 
      ADD CONSTRAINT wallet_policies_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallets_partner ON wallets(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallets_restricted ON wallets(is_restricted) WHERE is_restricted = true;
CREATE INDEX IF NOT EXISTS idx_wallet_restrictions_wallet ON wallet_restrictions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_restrictions_active ON wallet_restrictions(wallet_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wallet_restrictions_type ON wallet_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_policies_partner ON wallet_policies(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_policies_default ON wallet_policies(partner_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_wallet_policies_active ON wallet_policies(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE wallet_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_restrictions table
CREATE POLICY "Service role can manage all wallet restrictions"
  ON wallet_restrictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view restrictions on own wallets"
  ON wallet_restrictions
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can view restrictions on their wallets"
  ON wallet_restrictions
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT w.id FROM wallets w
      JOIN partner_users pu ON w.partner_id = pu.partner_id
      WHERE pu.user_id = auth.uid()
    )
  );

-- RLS Policies for wallet_policies table
CREATE POLICY "Service role can manage all wallet policies"
  ON wallet_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view own policies"
  ON wallet_policies
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
    OR partner_id IS NULL -- Allow viewing default policies
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_restrictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_wallet_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_wallet_restrictions_updated_at
  BEFORE UPDATE ON wallet_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_restrictions_updated_at();

CREATE TRIGGER update_wallet_policies_updated_at
  BEFORE UPDATE ON wallet_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_policies_updated_at();
