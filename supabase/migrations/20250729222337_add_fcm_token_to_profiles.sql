/*
  # Add FCM Token to Profiles Table

  This migration adds FCM (Firebase Cloud Messaging) token fields to the profiles table
  to enable push notifications for the Planmoni app.

  ## Changes:
  - Add fcm_token column to store Firebase Cloud Messaging token
  - Add fcm_token_updated_at column to track when token was last updated
  - Add notification_preferences JSONB column for user notification settings

  ## Security:
  - Ensures RLS policies are maintained
  - Only users can update their own FCM tokens
*/

-- Add FCM token fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fcm_token text,
ADD COLUMN IF NOT EXISTS fcm_token_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "payouts": true,
  "deposits": true,
  "security": true,
  "general": true
}'::jsonb;

-- Create index on fcm_token for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
COMMENT ON COLUMN profiles.fcm_token_updated_at IS 'Timestamp when FCM token was last updated';
COMMENT ON COLUMN profiles.notification_preferences IS 'User preferences for different types of notifications';

-- Update the existing RLS policies to include the new columns
-- The existing policies already cover SELECT/UPDATE for authenticated users on their own profiles,
-- so the new columns are automatically included.

-- Create a function to update fcm_token_updated_at automatically
CREATE OR REPLACE FUNCTION update_fcm_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update the timestamp if fcm_token was actually changed
  IF OLD.fcm_token IS DISTINCT FROM NEW.fcm_token THEN
    NEW.fcm_token_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update fcm_token_updated_at
DROP TRIGGER IF EXISTS update_fcm_token_timestamp_trigger ON profiles;
CREATE TRIGGER update_fcm_token_timestamp_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_token_timestamp();

-- Create a function to get active FCM tokens (for admin use in sending notifications)
CREATE OR REPLACE FUNCTION get_active_fcm_tokens(user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(user_id uuid, fcm_token text, notification_preferences jsonb)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow service role to call this function
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied. This function can only be called by service role.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.fcm_token,
    p.notification_preferences
  FROM profiles p
  WHERE 
    p.fcm_token IS NOT NULL 
    AND p.fcm_token != ''
    AND (user_ids IS NULL OR p.id = ANY(user_ids));
END;
$$ LANGUAGE plpgsql;
