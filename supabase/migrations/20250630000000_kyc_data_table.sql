-- Create kyc_data table for storing detailed KYC form information
CREATE TABLE IF NOT EXISTS kyc_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Personal Information
  first_name text,
  last_name text,
  middle_name text,
  date_of_birth text,
  phone_number text,
  
  -- Address Information
  address text,
  address_no text,
  address_lat text,
  address_lon text,
  address_place_id text,
  lga text,
  state text,
  
  -- Identity Information
  bvn text,
  nin text,
  document_type text CHECK (document_type IN ('bvn', 'nin', 'passport', 'drivers_license')),
  document_number text,
  
  -- Document URLs
  document_front_url text,
  document_back_url text,
  selfie_url text,
  
  -- Utility Bill (Optional)
  utility_bill_url text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE kyc_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own kyc data"
  ON kyc_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kyc data"
  ON kyc_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kyc data"
  ON kyc_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_kyc_data_updated_at
  BEFORE UPDATE ON kyc_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_kyc_data_user_id ON kyc_data(user_id); 