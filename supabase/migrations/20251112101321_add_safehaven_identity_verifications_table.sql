/*
  # Add SafeHaven Identity Verifications Table
  
  This migration creates a table to track SafeHaven identity verification status
  for NIN verification workflow: Initiate → Validate → Create Sub Account
  
  1. New Table
    - `safehaven_identity_verifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `identity_id` (text) - SafeHaven identity verification ID
      - `verification_type` (text) - 'NIN' (BVN uses Dojah)
      - `status` (text) - 'pending', 'validated', 'failed'
      - `verified_data` (jsonb) - Personal info from validation response
      - `otp_sent_at` (timestamptz) - When OTP was sent
      - `otp_verified_at` (timestamptz) - When OTP was validated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    
  3. Updates to safehaven_subaccounts
    - Add `identity_id` reference column
    - Add `auto_sweep_enabled` boolean flag
    - Add `main_account_number` for sweep destination
*/

-- Create safehaven_identity_verifications table
CREATE TABLE IF NOT EXISTS safehaven_identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- SafeHaven identity verification identifiers
  identity_id text NOT NULL,
  verification_type text NOT NULL CHECK (verification_type IN ('NIN', 'BVN')) DEFAULT 'NIN',
  
  -- Verification status
  status text NOT NULL CHECK (status IN ('pending', 'validated', 'failed')) DEFAULT 'pending',
  
  -- Verified data from SafeHaven (personal info from validation response)
  verified_data jsonb,
  
  -- OTP tracking
  otp_sent_at timestamptz,
  otp_verified_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure unique identity_id per user
  UNIQUE(user_id, identity_id)
);

-- Enable RLS
ALTER TABLE safehaven_identity_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own identity verifications"
  ON safehaven_identity_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own identity verifications"
  ON safehaven_identity_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own identity verifications"
  ON safehaven_identity_verifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_safehaven_identity_verifications_updated_at
  BEFORE UPDATE ON safehaven_identity_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_safehaven_identity_verifications_user_id ON safehaven_identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_identity_verifications_identity_id ON safehaven_identity_verifications(identity_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_identity_verifications_status ON safehaven_identity_verifications(status);

-- Update safehaven_subaccounts table if it exists
DO $$
BEGIN
  -- Add identity_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'safehaven_subaccounts' 
    AND column_name = 'identity_id'
  ) THEN
    ALTER TABLE safehaven_subaccounts ADD COLUMN identity_id text;
  END IF;

  -- Add auto_sweep_enabled column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'safehaven_subaccounts' 
    AND column_name = 'auto_sweep_enabled'
  ) THEN
    ALTER TABLE safehaven_subaccounts ADD COLUMN auto_sweep_enabled boolean DEFAULT true;
  END IF;

  -- Add main_account_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'safehaven_subaccounts' 
    AND column_name = 'main_account_number'
  ) THEN
    ALTER TABLE safehaven_subaccounts ADD COLUMN main_account_number text;
  END IF;
END $$;

-- Update kyc_progress table to add tier1_completed flag if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kyc_progress' 
    AND column_name = 'tier1_completed'
  ) THEN
    ALTER TABLE kyc_progress ADD COLUMN tier1_completed boolean DEFAULT false;
  END IF;
END $$;

-- Add index for identity_id in safehaven_subaccounts if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'safehaven_subaccounts' 
    AND column_name = 'identity_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_identity_id ON safehaven_subaccounts(identity_id);
  END IF;
END $$;

