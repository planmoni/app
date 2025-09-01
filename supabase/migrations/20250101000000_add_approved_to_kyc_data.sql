/*
  # Add approved field to kyc_data table
  
  1. Changes
    - Add `approved` column to kyc_data table
    - This field will be used to track admin approval of KYC documents
    - Default value is false for existing records
  
  2. Purpose
    - Required for Tier 3 verification (overall_completed + utility_bill_url + approved)
    - Allows admin to manually approve KYC submissions
*/

-- Add approved column to kyc_data table
ALTER TABLE kyc_data ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN kyc_data.approved IS 'Admin approval status for KYC verification. Required for Tier 3 verification.'; 