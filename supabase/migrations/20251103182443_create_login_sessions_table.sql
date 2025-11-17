/*
  # Create Login Sessions Table

  1. New Tables
    - `login_sessions`
      - `id` (uuid, primary key) - Unique session record ID
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `session_id` (text) - Supabase session ID
      - `device_type` (text) - Device type (mobile, tablet, desktop)
      - `device_model` (text) - Device model name
      - `device_manufacturer` (text) - Device manufacturer
      - `os_name` (text) - Operating system name
      - `os_version` (text) - Operating system version
      - `browser_name` (text) - Browser name
      - `browser_version` (text) - Browser version
      - `engine_name` (text) - Browser engine name
      - `screen_resolution` (text) - Screen resolution
      - `user_agent_raw` (text) - Raw user agent string
      - `ip_address` (text) - IP address (anonymized after 30 days)
      - `country` (text) - Country name
      - `country_code` (text) - Country code (ISO 2-letter)
      - `region` (text) - Region/state
      - `city` (text) - City name
      - `latitude` (decimal) - GPS latitude
      - `longitude` (decimal) - GPS longitude
      - `timezone` (text) - Timezone
      - `isp` (text) - Internet Service Provider
      - `is_suspicious` (boolean) - Flagged as suspicious
      - `login_timestamp` (timestamptz) - When the login occurred
      - `created_at` (timestamptz) - Record creation time

  2. Security
    - Enable RLS on `login_sessions` table
    - Add policies for users to read their own login sessions
    - Add policies for users to delete their own login sessions
    - Add policies for users to update suspicious flag on their sessions

  3. Indexes
    - Index on user_id for fast user session lookups
    - Index on login_timestamp for chronological queries
    - Index on is_suspicious for filtering suspicious sessions

  4. Automatic Cleanup
    - Function to anonymize IP addresses after 30 days
    - Function to delete sessions older than 90 days
*/

-- Create login_sessions table
CREATE TABLE IF NOT EXISTS login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  device_type text DEFAULT 'Unknown',
  device_model text DEFAULT 'Unknown',
  device_manufacturer text DEFAULT 'Unknown',
  os_name text DEFAULT 'Unknown',
  os_version text DEFAULT 'Unknown',
  browser_name text DEFAULT 'Unknown',
  browser_version text DEFAULT 'Unknown',
  engine_name text DEFAULT 'Unknown',
  screen_resolution text DEFAULT 'Unknown',
  user_agent_raw text DEFAULT 'Unknown',
  ip_address text DEFAULT 'Unknown',
  country text DEFAULT 'Unknown',
  country_code text DEFAULT 'Unknown',
  region text DEFAULT 'Unknown',
  city text DEFAULT 'Unknown',
  latitude decimal,
  longitude decimal,
  timezone text DEFAULT 'Unknown',
  isp text DEFAULT 'Unknown',
  is_suspicious boolean DEFAULT false,
  login_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_timestamp ON login_sessions(login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_suspicious ON login_sessions(is_suspicious) WHERE is_suspicious = true;

-- Enable RLS
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own login sessions"
  ON login_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own login sessions"
  ON login_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own login sessions"
  ON login_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own login sessions"
  ON login_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to anonymize old IP addresses (after 30 days)
CREATE OR REPLACE FUNCTION anonymize_old_ip_addresses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE login_sessions
  SET ip_address = 'Anonymized'
  WHERE login_timestamp < NOW() - INTERVAL '30 days'
    AND ip_address != 'Anonymized'
    AND ip_address != 'Unknown';
END;
$$;

-- Function to delete old login sessions (after 90 days)
CREATE OR REPLACE FUNCTION delete_old_login_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM login_sessions
  WHERE login_timestamp < NOW() - INTERVAL '90 days';
END;
$$;

-- Create a scheduled job to run cleanup functions daily
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Anonymize IPs daily at 2 AM
    PERFORM cron.schedule(
      'anonymize-old-ips',
      '0 2 * * *',
      'SELECT anonymize_old_ip_addresses();'
    );
    
    -- Delete old sessions daily at 3 AM
    PERFORM cron.schedule(
      'delete-old-sessions',
      '0 3 * * *',
      'SELECT delete_old_login_sessions();'
    );
  END IF;
END $$;