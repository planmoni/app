/*
  # Create payout_fees table
  
  This migration creates a table to store fee percentages per frequency type.
  Fees are applied to payout plans based on their frequency.
*/

-- Create payout_fees table
CREATE TABLE IF NOT EXISTS payout_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency text NOT NULL UNIQUE CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'end_of_month', 'quarterly', 'biannual', 'annually', 'custom', 'weekly_specific')),
  fee_percentage numeric NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payout_fees ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view fees (for frontend queries)
CREATE POLICY "Authenticated users can view payout fees"
  ON payout_fees
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can insert/update fees (admin operations)
-- This will be handled by service role, so we don't need a policy for authenticated users

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payout_fees_frequency ON payout_fees(frequency);
CREATE INDEX IF NOT EXISTS idx_payout_fees_is_active ON payout_fees(is_active);

-- Insert default fee percentages (1.5% for all frequencies)
INSERT INTO payout_fees (frequency, fee_percentage, is_active) VALUES
  ('daily', 1.5, true),
  ('weekly', 1.5, true),
  ('biweekly', 1.5, true),
  ('monthly', 1.5, true),
  ('end_of_month', 1.5, true),
  ('quarterly', 1.5, true),
  ('biannual', 1.5, true),
  ('annually', 1.5, true),
  ('custom', 1.5, true),
  ('weekly_specific', 1.5, true)
ON CONFLICT (frequency) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payout_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_payout_fees_updated_at
  BEFORE UPDATE ON payout_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_fees_updated_at();

-- Add comment
COMMENT ON TABLE payout_fees IS 'Stores fee percentages for different payout plan frequencies';
