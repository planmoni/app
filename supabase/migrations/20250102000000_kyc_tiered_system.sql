/*
  # KYC Tiered System with Deposit Limits
  
  This migration implements a tiered KYC system similar to banks:
  
  - Tier 1: Liveness test, BVN verification, NIN verification
  - Tier 2: Complete personal info and document verification
  - Tier 3: Address details and utility bill
  
  Each tier has maximum deposit limits.
  
  1. New Tables
    - `kyc_tiers` - Configuration table for KYC tiers with deposit limits
    - Updates to `kyc_progress` - Add tier completion tracking
    - Updates to `profiles` - Ensure kyc_tier column exists
  
  2. Functions
    - Function to calculate user's current tier
    - Function to check if user can upgrade to next tier
    - Function to get deposit limits for a tier
*/

-- Create kyc_tiers configuration table
CREATE TABLE IF NOT EXISTS kyc_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_number integer NOT NULL UNIQUE CHECK (tier_number IN (1, 2, 3)),
  tier_name text NOT NULL,
  tier_description text,
  
  -- Deposit limits (in smallest currency unit, e.g., kobo for NGN)
  max_daily_deposit numeric NOT NULL DEFAULT 0,
  max_weekly_deposit numeric NOT NULL DEFAULT 0,
  max_monthly_deposit numeric NOT NULL DEFAULT 0,
  max_single_deposit numeric NOT NULL DEFAULT 0,
  max_account_balance numeric NOT NULL DEFAULT 0,
  
  -- Requirements for this tier (JSONB for flexibility)
  requirements jsonb NOT NULL DEFAULT '{}',
  
  -- Metadata
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default tier configurations
INSERT INTO kyc_tiers (tier_number, tier_name, tier_description, requirements, max_daily_deposit, max_weekly_deposit, max_monthly_deposit, max_single_deposit, max_account_balance) VALUES
  (
    1,
    'Tier 1 - Basic Verification',
    'Liveness test, BVN verification, and NIN verification completed',
    '{"liveness_test": true, "bvn_verified": true, "nin_verified": true}',
    10000000,  -- ₦100,000 daily
    500000,  -- ₦5,000 weekly
    2000000, -- ₦20,000 monthly
    50000,   -- ₦500 single transaction
    5000000  -- ₦50,000 max balance
  ),
  (
    2,
    'Tier 2 - Enhanced Verification',
    'Complete personal information and document verification',
    '{"personal_info_completed": true, "documents_verified": true}',
    500000,  -- ₦5,000 daily
    2000000, -- ₦20,000 weekly
    10000000, -- ₦100,000 monthly
    200000,  -- ₦2,000 single transaction
    50000000 -- ₦500,000 max balance
  ),
  (
    3,
    'Tier 3 - Full Verification',
    'Address details and utility bill verification completed',
    '{"address_completed": true, "utility_bill_verified": true}',
    5000000,  -- ₦50,000 daily
    20000000, -- ₦200,000 weekly
    100000000, -- ₦1,000,000 monthly
    5000000,  -- ₦50,000 single transaction
    500000000 -- ₦5,000,000 max balance
  )
ON CONFLICT (tier_number) DO NOTHING;

-- Update kyc_progress table to include tier tracking
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_1_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_2_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_3_completed boolean DEFAULT false;

ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS liveness_test_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS nin_verified boolean DEFAULT false;

-- Ensure profiles table has kyc_tier column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'kyc_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_tier integer DEFAULT 0;
  END IF;
END $$;

-- Function to calculate user's current tier based on completed requirements
CREATE OR REPLACE FUNCTION calculate_user_kyc_tier(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier integer := 0;
  v_progress record;
BEGIN
  -- Get user's KYC progress
  SELECT 
    tier_1_completed,
    tier_2_completed,
    tier_3_completed,
    liveness_test_completed,
    bvn_verified,
    nin_verified,
    personal_info_completed,
    documents_verified,
    address_completed,
    utility_bill_verified
  INTO v_progress
  FROM kyc_progress
  WHERE user_id = p_user_id;

  IF v_progress IS NULL THEN
    RETURN 0; -- No KYC progress, tier 0 (unverified)
  END IF;

  -- Check Tier 3 requirements
  IF v_progress.tier_2_completed AND 
     v_progress.address_completed AND 
     COALESCE(v_progress.utility_bill_verified, false) THEN
    RETURN 3;
  END IF;

  -- Check Tier 2 requirements
  IF v_progress.tier_1_completed AND 
     v_progress.personal_info_completed AND 
     v_progress.documents_verified THEN
    RETURN 2;
  END IF;

  -- Check Tier 1 requirements
  IF COALESCE(v_progress.liveness_test_completed, false) AND 
     COALESCE(v_progress.bvn_verified, false) AND 
     COALESCE(v_progress.nin_verified, false) THEN
    RETURN 1;
  END IF;

  RETURN 0; -- Unverified
END;
$$;

-- Function to check if user can upgrade to next tier
CREATE OR REPLACE FUNCTION can_upgrade_tier(p_user_id uuid, p_target_tier integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tier integer;
  v_progress record;
BEGIN
  -- Get current tier
  v_current_tier := calculate_user_kyc_tier(p_user_id);
  
  -- Can only upgrade one tier at a time
  IF p_target_tier != v_current_tier + 1 THEN
    RETURN false;
  END IF;

  -- Get user's KYC progress
  SELECT 
    liveness_test_completed,
    bvn_verified,
    nin_verified,
    personal_info_completed,
    documents_verified,
    address_completed,
    utility_bill_verified
  INTO v_progress
  FROM kyc_progress
  WHERE user_id = p_user_id;

  IF v_progress IS NULL THEN
    RETURN false;
  END IF;

  -- Check requirements for target tier
  IF p_target_tier = 1 THEN
    -- Tier 1: Liveness, BVN, NIN
    RETURN COALESCE(v_progress.liveness_test_completed, false) AND
           COALESCE(v_progress.bvn_verified, false) AND
           COALESCE(v_progress.nin_verified, false);
  ELSIF p_target_tier = 2 THEN
    -- Tier 2: Tier 1 completed + Personal info + Documents
    RETURN v_current_tier >= 1 AND
           COALESCE(v_progress.personal_info_completed, false) AND
           COALESCE(v_progress.documents_verified, false);
  ELSIF p_target_tier = 3 THEN
    -- Tier 3: Tier 2 completed + Address + Utility
    RETURN v_current_tier >= 2 AND
           COALESCE(v_progress.address_completed, false) AND
           COALESCE(v_progress.utility_bill_verified, false);
  END IF;

  RETURN false;
END;
$$;

-- Function to get deposit limits for a tier
CREATE OR REPLACE FUNCTION get_tier_deposit_limits(p_tier_number integer)
RETURNS TABLE (
  tier_number integer,
  tier_name text,
  max_daily_deposit numeric,
  max_weekly_deposit numeric,
  max_monthly_deposit numeric,
  max_single_deposit numeric,
  max_account_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tier_number,
    t.tier_name,
    t.max_daily_deposit,
    t.max_weekly_deposit,
    t.max_monthly_deposit,
    t.max_single_deposit,
    t.max_account_balance
  FROM kyc_tiers t
  WHERE t.tier_number = p_tier_number
    AND t.is_active = true;
END;
$$;

-- Function to get user's deposit limits based on current tier
CREATE OR REPLACE FUNCTION get_user_deposit_limits(p_user_id uuid)
RETURNS TABLE (
  tier_number integer,
  tier_name text,
  max_daily_deposit numeric,
  max_weekly_deposit numeric,
  max_monthly_deposit numeric,
  max_single_deposit numeric,
  max_account_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier integer;
BEGIN
  v_tier := calculate_user_kyc_tier(p_user_id);
  
  IF v_tier = 0 THEN
    -- Return tier 1 limits for unverified users (restrictive)
    RETURN QUERY
    SELECT * FROM get_tier_deposit_limits(1);
  ELSE
    RETURN QUERY
    SELECT * FROM get_tier_deposit_limits(v_tier);
  END IF;
END;
$$;

-- Function to update user tier when requirements are met
CREATE OR REPLACE FUNCTION update_user_kyc_tier(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_tier integer;
  v_current_tier integer;
BEGIN
  -- Calculate new tier
  v_new_tier := calculate_user_kyc_tier(p_user_id);
  
  -- Get current tier from profiles
  SELECT COALESCE(kyc_tier, 0) INTO v_current_tier
  FROM profiles
  WHERE id = p_user_id;

  -- Update tier if changed
  IF v_new_tier != v_current_tier THEN
    UPDATE profiles
    SET kyc_tier = v_new_tier
    WHERE id = p_user_id;
    
    -- Update tier completion flags in kyc_progress
    UPDATE kyc_progress
    SET 
      tier_1_completed = (v_new_tier >= 1),
      tier_2_completed = (v_new_tier >= 2),
      tier_3_completed = (v_new_tier >= 3),
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_new_tier;
END;
$$;

-- Add utility_bill_verified column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_progress' AND column_name = 'utility_bill_verified'
  ) THEN
    ALTER TABLE kyc_progress ADD COLUMN utility_bill_verified boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS on kyc_tiers
ALTER TABLE kyc_tiers ENABLE ROW LEVEL SECURITY;

-- Create policies for kyc_tiers (read-only for authenticated users)
CREATE POLICY "Users can view kyc tiers"
  ON kyc_tiers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kyc_progress_user_id ON kyc_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_tiers_tier_number ON kyc_tiers(tier_number);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_tier ON profiles(kyc_tier);

-- Add comments for documentation
COMMENT ON TABLE kyc_tiers IS 'Configuration table for KYC tiers with deposit limits';
COMMENT ON FUNCTION calculate_user_kyc_tier IS 'Calculates user''s current KYC tier based on completed requirements';
COMMENT ON FUNCTION can_upgrade_tier IS 'Checks if user meets requirements to upgrade to next tier';
COMMENT ON FUNCTION get_tier_deposit_limits IS 'Returns deposit limits for a specific tier';
COMMENT ON FUNCTION get_user_deposit_limits IS 'Returns deposit limits for a user based on their current tier';
COMMENT ON FUNCTION update_user_kyc_tier IS 'Updates user''s tier in profiles table when requirements are met';

