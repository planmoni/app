/*
  # Create Immutable Audit Ledger
  
  This migration creates an append-only audit ledger for all money movements
  and policy changes. The ledger uses cryptographic hashing to ensure integrity.
  
  1. New Tables
    - audit_ledger - All money movements (append-only)
    - audit_events - Policy changes, approvals, etc.
  
  2. Features
    - Sequential entry numbers
    - Cryptographic hashing for chain integrity
    - Append-only design (no updates/deletes)
*/

-- Create audit_ledger table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_ledger') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE audit_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_entry_number bigserial NOT NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
        transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        entry_type text NOT NULL CHECK (entry_type IN (
          'credit', 'debit', 'lock', 'unlock', 'restriction_added', 
          'restriction_removed', 'policy_applied', 'approval_granted',
          'approval_rejected', 'disbursement_initiated', 'disbursement_completed',
          'disbursement_failed'
        )),
        amount numeric,
        balance_before numeric NOT NULL,
        balance_after numeric NOT NULL,
        currency text DEFAULT 'NGN',
        metadata jsonb DEFAULT '{}',
        previous_hash text,
        entry_hash text NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL
      );
    ELSE
      CREATE TABLE audit_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_entry_number bigserial NOT NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        partner_id uuid,
        transaction_id uuid,
        entry_type text NOT NULL CHECK (entry_type IN (
          'credit', 'debit', 'lock', 'unlock', 'restriction_added', 
          'restriction_removed', 'policy_applied', 'approval_granted',
          'approval_rejected', 'disbursement_initiated', 'disbursement_completed',
          'disbursement_failed'
        )),
        amount numeric,
        balance_before numeric NOT NULL,
        balance_after numeric NOT NULL,
        currency text DEFAULT 'NGN',
        metadata jsonb DEFAULT '{}',
        previous_hash text,
        entry_hash text NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL
      );
    END IF;
  END IF;
  
  -- Add foreign key constraints if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'audit_ledger' 
      AND constraint_name = 'audit_ledger_partner_id_fkey'
    ) THEN
      ALTER TABLE audit_ledger 
      ADD CONSTRAINT audit_ledger_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'audit_ledger' 
      AND constraint_name = 'audit_ledger_transaction_id_fkey'
    ) THEN
      ALTER TABLE audit_ledger 
      ADD CONSTRAINT audit_ledger_transaction_id_fkey 
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create audit_events table for non-financial events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_events') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL CHECK (event_type IN (
          'policy_created', 'policy_updated', 'policy_deleted',
          'restriction_added', 'restriction_updated', 'restriction_removed',
          'approval_workflow_created', 'approval_workflow_updated',
          'wallet_created', 'wallet_updated', 'wallet_deactivated',
          'partner_created', 'partner_updated', 'partner_deactivated',
          'api_key_generated', 'api_key_revoked'
        )),
        partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
        entity_type text,
        entity_id uuid,
        changes jsonb DEFAULT '{}',
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now() NOT NULL
      );
    ELSE
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL CHECK (event_type IN (
          'policy_created', 'policy_updated', 'policy_deleted',
          'restriction_added', 'restriction_updated', 'restriction_removed',
          'approval_workflow_created', 'approval_workflow_updated',
          'wallet_created', 'wallet_updated', 'wallet_deactivated',
          'partner_created', 'partner_updated', 'partner_deactivated',
          'api_key_generated', 'api_key_revoked'
        )),
        partner_id uuid,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
        entity_type text,
        entity_id uuid,
        changes jsonb DEFAULT '{}',
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now() NOT NULL
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'audit_events' 
      AND constraint_name = 'audit_events_partner_id_fkey'
    ) THEN
      ALTER TABLE audit_events 
      ADD CONSTRAINT audit_events_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create unique index on ledger_entry_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_ledger_entry_number ON audit_ledger(ledger_entry_number);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_ledger_wallet ON audit_ledger(wallet_id, created_at) WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_ledger_partner ON audit_ledger(partner_id, created_at) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_ledger_transaction ON audit_ledger(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_ledger_type ON audit_ledger(entry_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_hash ON audit_ledger(entry_hash);

CREATE INDEX IF NOT EXISTS idx_audit_events_partner ON audit_events(partner_id, created_at) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_wallet ON audit_events(wallet_id, created_at) WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id) WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE audit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_ledger
CREATE POLICY "Service role can manage all audit ledger entries"
  ON audit_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own wallet ledger entries"
  ON audit_ledger
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can view their ledger entries"
  ON audit_ledger
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for audit_events
CREATE POLICY "Service role can manage all audit events"
  ON audit_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own wallet audit events"
  ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Partners can view their audit events"
  ON audit_events
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- Prevent updates and deletes on audit_ledger (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_ledger_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit ledger is append-only. Updates and deletes are not allowed.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_ledger_modifications
  BEFORE UPDATE OR DELETE ON audit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_ledger_updates();
