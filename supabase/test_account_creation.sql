-- Test Account Creation Setup
-- Run this query in Supabase SQL Editor to verify everything is working

-- 1. Run the diagnostic function
SELECT * FROM diagnose_account_creation();

-- 2. Check current profiles table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Check current wallets table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'wallets'
ORDER BY ordinal_position;

-- 4. Check if trigger exists and is active
SELECT 
  tgname as trigger_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 5. Check handle_new_user function
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 6. Check for any profiles without wallets (should be none after trigger runs)
SELECT 
  p.id,
  p.email,
  p.created_at,
  CASE WHEN w.id IS NULL THEN 'MISSING WALLET' ELSE 'OK' END as wallet_status
FROM profiles p
LEFT JOIN wallets w ON w.user_id = p.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 7. Check for any NULL values in required columns
SELECT 
  'profiles with NULL referral_code' as issue,
  COUNT(*) as count
FROM profiles
WHERE referral_code IS NULL
UNION ALL
SELECT 
  'profiles with NULL kyc_tier' as issue,
  COUNT(*) as count
FROM profiles
WHERE kyc_tier IS NULL
UNION ALL
SELECT 
  'profiles with NULL email_verified' as issue,
  COUNT(*) as count
FROM profiles
WHERE email_verified IS NULL
UNION ALL
SELECT 
  'wallets with NULL balance' as issue,
  COUNT(*) as count
FROM wallets
WHERE balance IS NULL
UNION ALL
SELECT 
  'wallets with NULL locked_balance' as issue,
  COUNT(*) as count
FROM wallets
WHERE locked_balance IS NULL;

