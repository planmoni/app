-- Update Tier 1 daily deposit limit from ₦1,000 to ₦100,000
-- This corrects the max_daily_deposit value for Tier 1 users

UPDATE kyc_tiers
SET 
  max_daily_deposit = 10000000,  -- ₦100,000 (was 100000 = ₦1,000)
  updated_at = now()
WHERE tier_number = 1
  AND is_active = true;

