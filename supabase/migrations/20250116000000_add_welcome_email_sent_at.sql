/*
  # Add welcome_email_sent_at column to profiles table
  
  This migration adds a column to track when the welcome email was sent
  to prevent duplicate welcome emails from being sent to the same user.
*/

-- Add welcome_email_sent_at column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_email_sent_at 
ON profiles(welcome_email_sent_at) 
WHERE welcome_email_sent_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.welcome_email_sent_at IS 'Timestamp when the welcome email was sent to prevent duplicate sends';

