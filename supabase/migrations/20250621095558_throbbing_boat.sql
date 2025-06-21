/*
  # Add Emergency Withdrawal Column to Payout Plans
  
  1. Schema Updates
    - Add `emergency_withdrawal_enabled` column to payout_plans table if it doesn't exist
  
  2. Safety
    - Uses IF NOT EXISTS to prevent errors if column already exists
*/

-- Add emergency_withdrawal_enabled column to payout_plans table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' AND column_name = 'emergency_withdrawal_enabled'
  ) THEN
    ALTER TABLE payout_plans ADD COLUMN emergency_withdrawal_enabled boolean DEFAULT false;
  END IF;
END $$;