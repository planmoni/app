/*
  # Add Mono Customer ID to Profiles
  
  1. New Column
    - `mono_customer_id` (text) - Stores Mono customer ID for account linking
*/

-- Add mono_customer_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS mono_customer_id text;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_mono_customer_id 
ON profiles(mono_customer_id) 
WHERE mono_customer_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.mono_customer_id IS 'Mono customer ID for bank account linking';







