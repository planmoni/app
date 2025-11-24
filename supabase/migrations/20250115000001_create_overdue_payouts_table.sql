/*
  # Create Overdue Payouts Tracking Table
  
  This migration creates a table to track and investigate overdue payouts
  that should have been processed but weren't.
  
  1. Table Structure
    - Tracks payout plans that are overdue
    - Records when they were detected as overdue
    - Tracks investigation and recovery attempts
    - Links to original payout plan and automated payout records
*/

-- Create overdue_payouts table
CREATE TABLE IF NOT EXISTS overdue_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid REFERENCES payout_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  expected_payout_date timestamptz NOT NULL,
  detected_at timestamptz DEFAULT now(),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'reprocessing', 'recovered', 'failed', 'ignored')),
  reason text,
  investigation_notes text,
  recovery_attempts integer DEFAULT 0,
  last_recovery_attempt timestamptz,
  recovered_at timestamptz,
  automated_payout_id uuid REFERENCES automated_payouts(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for overdue_payouts
ALTER TABLE overdue_payouts ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own overdue payouts
CREATE POLICY "Users can view own overdue payouts"
  ON overdue_payouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_overdue_payouts_status 
ON overdue_payouts(status, detected_at);

CREATE INDEX IF NOT EXISTS idx_overdue_payouts_plan 
ON overdue_payouts(payout_plan_id, expected_payout_date);

CREATE INDEX IF NOT EXISTS idx_overdue_payouts_user 
ON overdue_payouts(user_id, expected_payout_date);

CREATE INDEX IF NOT EXISTS idx_overdue_payouts_date 
ON overdue_payouts(expected_payout_date) 
WHERE status IN ('detected', 'investigating', 'reprocessing');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_overdue_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER overdue_payouts_updated_at
  BEFORE UPDATE ON overdue_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_overdue_payouts_updated_at();

-- Add comments
COMMENT ON TABLE overdue_payouts IS 'Tracks payout plans that are overdue and should have been processed';
COMMENT ON COLUMN overdue_payouts.expected_payout_date IS 'The date/time when the payout should have been executed';
COMMENT ON COLUMN overdue_payouts.detected_at IS 'When this overdue payout was first detected';
COMMENT ON COLUMN overdue_payouts.status IS 'Current status of the overdue payout investigation/recovery';
COMMENT ON COLUMN overdue_payouts.reason IS 'Reason why the payout was overdue (e.g., trigger failed, cron missed, edge function error)';
COMMENT ON COLUMN overdue_payouts.investigation_notes IS 'Notes from investigation into why the payout was missed';
COMMENT ON COLUMN overdue_payouts.recovery_attempts IS 'Number of times we attempted to recover this payout';
COMMENT ON COLUMN overdue_payouts.automated_payout_id IS 'Link to automated_payouts record if one was created during recovery';

