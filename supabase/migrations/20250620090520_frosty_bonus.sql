/*
  # Add KYC Verification Tables
  
  1. New Tables
    - `kyc_verifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `verification_type` (text) - 'bvn', 'nin', 'passport', 'drivers_license'
      - `verification_data` (jsonb) - The data submitted for verification
      - `verification_result` (jsonb) - The result from Dojah API
      - `status` (text) - 'pending', 'verified', 'failed'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `kyc_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `document_type` (text) - 'id_card', 'passport', 'drivers_license'
      - `verification_result` (jsonb) - The result from Dojah API
      - `status` (text) - 'pending', 'verified', 'failed'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    
  3. Profile Updates
    - Add `kyc_tier` column to profiles table
*/

-- Add kyc_tier column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_tier integer DEFAULT 1;

-- Create kyc_verifications table
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  verification_type text NOT NULL CHECK (verification_type IN ('bvn', 'nin', 'passport', 'drivers_license')),
  verification_data jsonb NOT NULL,
  verification_result jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own kyc verifications"
  ON kyc_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kyc verifications"
  ON kyc_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create kyc_documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('id_card', 'passport', 'drivers_license')),
  verification_result jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own kyc documents"
  ON kyc_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kyc documents"
  ON kyc_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_status ON kyc_verifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_status ON kyc_documents(user_id, status);