/*
  # Create OTP Table for Email Verification
  
  1. New Tables
    - `otps`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `otp_code` (text, not null)
      - `expires_at` (timestamptz, not null)
      - `is_used` (boolean, default false)
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS
    - Add policies for system access
*/

-- Create otps table
CREATE TABLE IF NOT EXISTS otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

-- Create policy for system to insert OTPs
CREATE POLICY "System can insert OTPs"
  ON otps
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policy for system to select OTPs
CREATE POLICY "System can select OTPs"
  ON otps
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create policy for system to update OTPs
CREATE POLICY "System can update OTPs"
  ON otps
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otps_email_code ON otps(email, otp_code);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- Add function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otps
  WHERE expires_at < now() OR is_used = true;
END;
$$;