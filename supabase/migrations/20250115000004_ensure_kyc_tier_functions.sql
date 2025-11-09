-- Ensure calculate_user_kyc_tier function exists
-- This migration ensures all KYC tier functions are created if they don't exist

-- Add missing columns to kyc_progress table if they don't exist
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS id_face_verified boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_1_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_2_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS tier_3_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS liveness_test_completed boolean DEFAULT false;
ALTER TABLE kyc_progress ADD COLUMN IF NOT EXISTS utility_bill_verified boolean DEFAULT false;

-- Function to calculate user's current tier based on completed requirements
CREATE OR REPLACE FUNCTION calculate_user_kyc_tier(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier integer := 0;
  v_progress record;
  v_tier1_complete boolean;
  v_tier2_complete boolean;
BEGIN
  -- Get user's KYC progress
  SELECT 
    liveness_test_completed,
    bvn_verified,
    id_face_verified,  -- Used for NIN verification
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

  -- Check Tier 1 requirements: Liveness, BVN, and NIN (id_face_verified)
  v_tier1_complete := COALESCE(v_progress.liveness_test_completed, false) AND 
                      COALESCE(v_progress.bvn_verified, false) AND 
                      COALESCE(v_progress.id_face_verified, false);

  -- Check Tier 2 requirements: Tier 1 + Personal Info + Documents
  v_tier2_complete := v_tier1_complete AND 
                      COALESCE(v_progress.personal_info_completed, false) AND 
                      COALESCE(v_progress.documents_verified, false);

  -- Check Tier 3 requirements: Tier 2 + Address + Utility
  IF v_tier2_complete AND 
     COALESCE(v_progress.address_completed, false) AND 
     COALESCE(v_progress.utility_bill_verified, false) THEN
    RETURN 3;
  END IF;

  -- Check Tier 2 requirements
  IF v_tier2_complete THEN
    RETURN 2;
  END IF;

  -- Check Tier 1 requirements
  IF v_tier1_complete THEN
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
    id_face_verified,  -- Used for NIN verification
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
    -- Tier 1: Liveness, BVN, NIN (id_face_verified)
    RETURN COALESCE(v_progress.liveness_test_completed, false) AND
           COALESCE(v_progress.bvn_verified, false) AND
           COALESCE(v_progress.id_face_verified, false);
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

-- Add comments for documentation
COMMENT ON FUNCTION calculate_user_kyc_tier IS 'Calculates user''s current KYC tier based on completed requirements';
COMMENT ON FUNCTION can_upgrade_tier IS 'Checks if user meets requirements to upgrade to next tier';
COMMENT ON FUNCTION get_tier_deposit_limits IS 'Returns deposit limits for a specific tier';
COMMENT ON FUNCTION get_user_deposit_limits IS 'Returns deposit limits for a user based on their current tier';
COMMENT ON FUNCTION update_user_kyc_tier IS 'Updates user''s tier in profiles table when requirements are met';

