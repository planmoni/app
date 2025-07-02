/*
  # Add kyc_tier column to profiles table
  
  1. Changes
    - Add `kyc_tier` column to profiles table if it doesn't exist
    - Set default value to 1 for existing users
  
  2. Safety
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Safe to run multiple times
*/

-- Add kyc_tier column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'kyc_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_tier integer DEFAULT 1;
  END IF;
END $$;