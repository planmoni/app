/*
  # Create Approval Workflow System
  
  This migration creates the approval workflow infrastructure for
  controlled money access in the Platform-as-a-Service model.
  
  1. New Tables
    - approval_workflows - Workflow definitions
    - approval_requests - Individual approval requests
    - approval_actions - Approval/rejection actions
*/

-- Create approval_workflows table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_workflows') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE approval_workflows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        workflow_type text NOT NULL CHECK (workflow_type IN (
          'disbursement', 'withdrawal', 'wallet_creation', 'policy_change'
        )),
        steps jsonb NOT NULL,
        is_active boolean DEFAULT true,
        auto_approve_rules jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    ELSE
      CREATE TABLE approval_workflows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid,
        name text NOT NULL,
        description text,
        workflow_type text NOT NULL CHECK (workflow_type IN (
          'disbursement', 'withdrawal', 'wallet_creation', 'policy_change'
        )),
        steps jsonb NOT NULL,
        is_active boolean DEFAULT true,
        auto_approve_rules jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'approval_workflows' 
      AND constraint_name = 'approval_workflows_partner_id_fkey'
    ) THEN
      ALTER TABLE approval_workflows 
      ADD CONSTRAINT approval_workflows_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create approval_requests table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_requests') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE approval_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id uuid REFERENCES approval_workflows(id) ON DELETE SET NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
        transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
        request_type text NOT NULL CHECK (request_type IN (
          'disbursement', 'withdrawal', 'wallet_creation', 'policy_change', 'restriction_change'
        )),
        amount numeric,
        currency text DEFAULT 'NGN',
        purpose text,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
        current_step integer DEFAULT 0,
        total_steps integer NOT NULL DEFAULT 1,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        expires_at timestamptz,
        approved_at timestamptz,
        rejected_at timestamptz
      );
    ELSE
      CREATE TABLE approval_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id uuid REFERENCES approval_workflows(id) ON DELETE SET NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
        transaction_id uuid,
        partner_id uuid,
        request_type text NOT NULL CHECK (request_type IN (
          'disbursement', 'withdrawal', 'wallet_creation', 'policy_change', 'restriction_change'
        )),
        amount numeric,
        currency text DEFAULT 'NGN',
        purpose text,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
        current_step integer DEFAULT 0,
        total_steps integer NOT NULL DEFAULT 1,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        expires_at timestamptz,
        approved_at timestamptz,
        rejected_at timestamptz
      );
    END IF;
  END IF;
  
  -- Add foreign key constraints if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'approval_requests' 
      AND constraint_name = 'approval_requests_partner_id_fkey'
    ) THEN
      ALTER TABLE approval_requests 
      ADD CONSTRAINT approval_requests_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'approval_requests' 
      AND constraint_name = 'approval_requests_transaction_id_fkey'
    ) THEN
      ALTER TABLE approval_requests 
      ADD CONSTRAINT approval_requests_transaction_id_fkey 
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create approval_actions table
CREATE TABLE IF NOT EXISTS approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid REFERENCES approval_requests(id) ON DELETE CASCADE NOT NULL,
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  step_number integer NOT NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes')),
  comments text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_workflows_partner ON approval_workflows(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow ON approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_wallet ON approval_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_transaction ON approval_requests(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_requests_partner ON approval_requests(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON approval_requests(status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON approval_actions(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_approver ON approval_actions(approver_id) WHERE approver_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_workflows
CREATE POLICY "Service role can manage all approval workflows"
  ON approval_workflows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view own approval workflows"
  ON approval_workflows
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
    OR partner_id IS NULL -- Allow viewing default workflows
  );

-- RLS Policies for approval_requests
CREATE POLICY "Service role can manage all approval requests"
  ON approval_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own approval requests"
  ON approval_requests
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can view their approval requests"
  ON approval_requests
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for approval_actions
CREATE POLICY "Service role can manage all approval actions"
  ON approval_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view approval actions for their requests"
  ON approval_actions
  FOR SELECT
  TO authenticated
  USING (
    approval_request_id IN (
      SELECT id FROM approval_requests
      WHERE wallet_id IN (
        SELECT id FROM wallets WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Approvers can view and create actions for assigned requests"
  ON approval_actions
  FOR ALL
  TO authenticated
  USING (
    approver_id = auth.uid()
    OR approval_request_id IN (
      SELECT id FROM approval_requests
      WHERE partner_id IN (
        SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
      )
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_approval_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_approval_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_approval_workflows_updated_at
  BEFORE UPDATE ON approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_workflows_updated_at();

CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_requests_updated_at();
