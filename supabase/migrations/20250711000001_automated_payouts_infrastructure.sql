/*
  # Phase 1: Database Enhancements for Automated Payouts
  
  1. Performance Optimizations
    - Add indexes for efficient payout date queries
    - Optimize payout plan lookups
  
  2. Audit & Logging Tables
    - Create automated_payouts table for execution tracking
    - Add transfer recipient management
  
  3. Transfer Integration Support
    - Add Paystack transfer recipient IDs to bank accounts
    - Add transfer status tracking fields
*/

-- Add performance indexes for payout processing
CREATE INDEX IF NOT EXISTS idx_payout_plans_due_payouts 
ON payout_plans(next_payout_date, status) 
WHERE status = 'active' AND next_payout_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_plans_processing 
ON payout_plans(status, next_payout_date, updated_at);

-- Create automated payouts execution log table
CREATE TABLE IF NOT EXISTS automated_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid REFERENCES payout_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  scheduled_date date NOT NULL,
  execution_date timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  transfer_reference text UNIQUE,
  paystack_transfer_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
  error_message text,
  retry_count integer DEFAULT 0,
  retry_after timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for automated_payouts
ALTER TABLE automated_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automated payouts"
  ON automated_payouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automated_payouts_status ON automated_payouts(status, execution_date);
CREATE INDEX IF NOT EXISTS idx_automated_payouts_user ON automated_payouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_automated_payouts_plan ON automated_payouts(payout_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_automated_payouts_retry ON automated_payouts(status, retry_after) 
WHERE status = 'retrying';

-- Add Paystack transfer recipient support to bank accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS paystack_recipient_code text;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS transfer_enabled boolean DEFAULT false;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS last_transfer_attempt timestamptz;

-- Create index for transfer-enabled accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_transfer_enabled 
ON bank_accounts(transfer_enabled, user_id) 
WHERE transfer_enabled = true;

-- Create updated_at trigger for automated_payouts
CREATE OR REPLACE FUNCTION update_automated_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automated_payouts_updated_at
  BEFORE UPDATE ON automated_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_automated_payouts_updated_at();

-- Function to find due payout plans
CREATE OR REPLACE FUNCTION get_due_payout_plans(check_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  bank_account_id uuid,
  next_payout_date date,
  completed_payouts integer,
  duration integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id as plan_id,
    pp.user_id,
    pp.name,
    pp.payout_amount,
    pp.bank_account_id,
    pp.next_payout_date,
    pp.completed_payouts,
    pp.duration
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= check_date
    AND pp.completed_payouts < pp.duration
    AND NOT EXISTS (
      SELECT 1 FROM automated_payouts ap 
      WHERE ap.payout_plan_id = pp.id 
        AND ap.scheduled_date = pp.next_payout_date
        AND ap.status IN ('pending', 'processing', 'completed')
    );
END;
$$;

-- Function to create automated payout record
CREATE OR REPLACE FUNCTION create_automated_payout(
  p_plan_id uuid,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_payout_id uuid;
  v_reference text;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found: %', p_plan_id;
  END IF;
  
  -- Validate plan is eligible for payout
  IF v_plan.status != 'active' THEN
    RAISE EXCEPTION 'Payout plan is not active: %', v_plan.status;
  END IF;
  
  IF v_plan.completed_payouts >= v_plan.duration THEN
    RAISE EXCEPTION 'Payout plan is already completed';
  END IF;
  
  -- Generate unique reference
  v_reference := 'auto_payout_' || p_plan_id || '_' || p_scheduled_date || '_' || extract(epoch from now())::bigint;
  
  -- Create automated payout record
  INSERT INTO automated_payouts (
    payout_plan_id,
    user_id,
    scheduled_date,
    status,
    transfer_reference,
    amount,
    bank_account_id
  ) VALUES (
    p_plan_id,
    v_plan.user_id,
    p_scheduled_date,
    'pending',
    v_reference,
    v_plan.payout_amount,
    v_plan.bank_account_id
  ) RETURNING id INTO v_payout_id;
  
  RETURN v_payout_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_due_payout_plans TO authenticated;
GRANT EXECUTE ON FUNCTION create_automated_payout TO authenticated;
