/*
  # Alter Emergency Withdrawals Table
  
  This migration adds missing fields to the existing emergency_withdrawals table
  and fixes inconsistencies with the emergency_withdrawal_options table.
  
  Changes:
  1. Add missing fields: transfer_code, error_message, transferred_at, metadata
  2. Update withdrawal_type constraint to match emergency_withdrawal_options values
  3. Add RLS policies (if not already present)
*/

-- Add missing columns to emergency_withdrawals table
ALTER TABLE emergency_withdrawals 
ADD COLUMN IF NOT EXISTS transfer_code text,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- First, let's check what values currently exist and update them
-- Update any existing records to use the new format
UPDATE emergency_withdrawals 
SET withdrawal_type = CASE 
  WHEN withdrawal_type = '24h' THEN '24hrs'
  WHEN withdrawal_type = '72h' THEN '72hrs'
  ELSE withdrawal_type
END
WHERE withdrawal_type IN ('24h', '72h');

-- Now update withdrawal_type constraint to match emergency_withdrawal_options values
-- First drop the existing constraint
ALTER TABLE emergency_withdrawals 
DROP CONSTRAINT IF EXISTS emergency_withdrawals_withdrawal_type_check;

-- Add the new constraint with correct values (including both old and new formats temporarily)
ALTER TABLE emergency_withdrawals 
ADD CONSTRAINT emergency_withdrawals_withdrawal_type_check 
CHECK (withdrawal_type = ANY (ARRAY['instant'::text, '24h'::text, '72h'::text, '24hrs'::text, '72hrs'::text]));

-- Now update any remaining old format records
UPDATE emergency_withdrawals 
SET withdrawal_type = CASE 
  WHEN withdrawal_type = '24h' THEN '24hrs'
  WHEN withdrawal_type = '72h' THEN '72hrs'
  ELSE withdrawal_type
END
WHERE withdrawal_type IN ('24h', '72h');

-- Drop the temporary constraint and add the final one
ALTER TABLE emergency_withdrawals 
DROP CONSTRAINT IF EXISTS emergency_withdrawals_withdrawal_type_check;

ALTER TABLE emergency_withdrawals 
ADD CONSTRAINT emergency_withdrawals_withdrawal_type_check 
CHECK (withdrawal_type = ANY (ARRAY['instant'::text, '24hrs'::text, '72hrs'::text]));

-- Enable Row Level Security if not already enabled
ALTER TABLE emergency_withdrawals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_withdrawals' 
    AND policyname = 'Users can view their own emergency withdrawals'
  ) THEN
    CREATE POLICY "Users can view their own emergency withdrawals"
      ON emergency_withdrawals
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_withdrawals' 
    AND policyname = 'Users can create their own emergency withdrawals'
  ) THEN
    CREATE POLICY "Users can create their own emergency withdrawals"
      ON emergency_withdrawals
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_withdrawals' 
    AND policyname = 'Users can update their own emergency withdrawals'
  ) THEN
    CREATE POLICY "Users can update their own emergency withdrawals"
      ON emergency_withdrawals
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add additional indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_transfer_code ON emergency_withdrawals(transfer_code);
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_transferred_at ON emergency_withdrawals(transferred_at);
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_status ON emergency_withdrawals(status);

-- Add comments to document the new fields
COMMENT ON COLUMN emergency_withdrawals.transfer_code IS 'Paystack transfer code for completed transfers';
COMMENT ON COLUMN emergency_withdrawals.error_message IS 'Error message when withdrawal fails';
COMMENT ON COLUMN emergency_withdrawals.transferred_at IS 'Timestamp when transfer was completed';
COMMENT ON COLUMN emergency_withdrawals.metadata IS 'Additional JSON data (Paystack response, etc.)';
