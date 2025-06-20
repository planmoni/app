/*
  # Add Profile Action Flags
  
  1. Changes
    - Add app_lock_enabled column to profiles table
    - Add two_factor_enabled column to profiles table
    - Add email_verified column to profiles table
    - Add account_verified column to profiles table
  
  2. Rationale
    - Store user action completion status in the database instead of local storage
    - Ensure persistence across devices for the same user
    - Properly isolate actions between different users
*/

-- Add action flags to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_lock_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_verified boolean DEFAULT false;

-- Create function to update email_verified based on auth.users
CREATE OR REPLACE FUNCTION update_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email_verified status in profiles
  UPDATE profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update email_verified when auth.users is updated
DROP TRIGGER IF EXISTS update_email_verified_trigger ON auth.users;
CREATE TRIGGER update_email_verified_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_email_verified();

-- Update existing profiles with email verification status
UPDATE profiles
SET email_verified = (
  SELECT (users.email_confirmed_at IS NOT NULL)
  FROM auth.users
  WHERE users.id = profiles.id
);