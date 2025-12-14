/*
  # Add Active Session Tracking
  
  This migration adds support for single-device login by tracking which device
  is currently active for each user.
  
  1. New Fields
    - `is_active` (boolean) - Indicates if this session is currently active
    - `device_fingerprint` (text) - Unique identifier for the device
  
  2. Constraints
    - Unique partial index ensures only one active session per user
    - Function to automatically deactivate other sessions when activating a new one
  
  3. Security
    - RLS policies already allow users to update their own sessions
*/

-- Add is_active field
ALTER TABLE login_sessions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Add device_fingerprint field for device identification
ALTER TABLE login_sessions 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Ensure only one active session per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_user 
ON login_sessions(user_id) 
WHERE is_active = true;

-- Function to deactivate other sessions when activating a new one
CREATE OR REPLACE FUNCTION deactivate_other_sessions(p_user_id UUID, p_session_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE login_sessions
  SET is_active = false
  WHERE user_id = p_user_id 
    AND id != p_session_id
    AND is_active = true;
END;
$$;

-- Function to automatically deactivate sessions when they expire
-- This will be called by triggers or can be called manually
CREATE OR REPLACE FUNCTION deactivate_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate sessions that are older than 30 days (or adjust based on your session expiry)
  -- Note: This is a safety measure. Actual session expiry is handled by Supabase auth
  UPDATE login_sessions
  SET is_active = false
  WHERE is_active = true
    AND login_timestamp < NOW() - INTERVAL '30 days';
END;
$$;

-- Add index on device_fingerprint for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_sessions_device_fingerprint 
ON login_sessions(device_fingerprint);

-- Add index on is_active for faster queries
CREATE INDEX IF NOT EXISTS idx_login_sessions_is_active 
ON login_sessions(is_active) 
WHERE is_active = true;
