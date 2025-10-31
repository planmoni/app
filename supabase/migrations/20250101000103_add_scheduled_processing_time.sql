-- Add scheduled_processing_time column to emergency_withdrawals table
ALTER TABLE emergency_withdrawals 
ADD COLUMN IF NOT EXISTS scheduled_processing_time timestamptz;

-- Drop existing status constraint
ALTER TABLE emergency_withdrawals 
DROP CONSTRAINT IF EXISTS emergency_withdrawals_status_check;

-- Add updated status constraint with 'scheduled' status
ALTER TABLE emergency_withdrawals 
ADD CONSTRAINT emergency_withdrawals_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'reversed'::text]));

-- Create index for scheduled processing time queries
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_scheduled_processing_time 
ON emergency_withdrawals(scheduled_processing_time) 
WHERE scheduled_processing_time IS NOT NULL;

-- Create index for scheduled status queries
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_scheduled_status 
ON emergency_withdrawals(status, scheduled_processing_time) 
WHERE status = 'scheduled';

-- Add comment to document the new column
COMMENT ON COLUMN emergency_withdrawals.scheduled_processing_time IS 'When the emergency withdrawal is scheduled to be processed (for 24hrs and 72hrs withdrawals)';