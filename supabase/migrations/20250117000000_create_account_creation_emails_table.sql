/*
  # Create account_creation_emails table
  
  1. New Tables
    - account_creation_emails
      - id (uuid)
      - user_id (uuid, references profiles)
      - account_number (text)
      - account_name (text)
      - bank_name (text)
      - email_sent (boolean)
      - sent_at (timestamptz)
      - email_provider_response (jsonb)
      - error_message (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create account_creation_emails table
CREATE TABLE IF NOT EXISTS account_creation_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL DEFAULT 'SafeHaven Microfinance Bank',
  email_sent boolean DEFAULT false,
  sent_at timestamptz,
  email_provider_response jsonb,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_creation_emails_user_id ON account_creation_emails(user_id);

-- Create index on email_sent for filtering
CREATE INDEX IF NOT EXISTS idx_account_creation_emails_email_sent ON account_creation_emails(email_sent);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_account_creation_emails_created_at ON account_creation_emails(created_at DESC);

-- Enable RLS
ALTER TABLE account_creation_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own account creation emails
CREATE POLICY "Users can view their own account creation emails"
  ON account_creation_emails
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert account creation emails
CREATE POLICY "Service role can insert account creation emails"
  ON account_creation_emails
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update account creation emails
CREATE POLICY "Service role can update account creation emails"
  ON account_creation_emails
  FOR UPDATE
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_account_creation_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_account_creation_emails_updated_at
  BEFORE UPDATE ON account_creation_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_account_creation_emails_updated_at();

