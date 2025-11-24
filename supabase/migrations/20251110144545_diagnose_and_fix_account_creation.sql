/*
  # Diagnose and Fix Account Creation Issues
  
  This migration:
  1. Diagnoses the current state of profiles and wallets tables
  2. Verifies all required columns exist with proper defaults
  3. Checks for NOT NULL constraints that might cause trigger failures
  4. Fixes any missing columns or constraints
  5. Ensures the trigger can successfully create profiles and wallets
*/

-- Step 1: Ensure all required columns exist in profiles table
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
    ALTER TABLE profiles ADD COLUMN referral_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referred_by') THEN
    ALTER TABLE profiles ADD COLUMN referred_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'kyc_tier') THEN
    ALTER TABLE profiles ADD COLUMN kyc_tier integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'app_lock_enabled') THEN
    ALTER TABLE profiles ADD COLUMN app_lock_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_enabled') THEN
    ALTER TABLE profiles ADD COLUMN two_factor_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_verified') THEN
    ALTER TABLE profiles ADD COLUMN email_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'account_verified') THEN
    ALTER TABLE profiles ADD COLUMN account_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE profiles ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Step 2: Ensure all columns have proper defaults (especially for NOT NULL constraints)
DO $$
BEGIN
  -- Set defaults for existing rows that might have NULL values
  UPDATE profiles 
  SET referral_code = UPPER(SUBSTRING(MD5(id::text || email || EXTRACT(EPOCH FROM NOW())::text) FROM 1 FOR 8))
  WHERE referral_code IS NULL;

  UPDATE profiles 
  SET kyc_tier = 1 
  WHERE kyc_tier IS NULL;

  UPDATE profiles 
  SET app_lock_enabled = false 
  WHERE app_lock_enabled IS NULL;

  UPDATE profiles 
  SET two_factor_enabled = false 
  WHERE two_factor_enabled IS NULL;

  UPDATE profiles 
  SET email_verified = false 
  WHERE email_verified IS NULL;

  UPDATE profiles 
  SET account_verified = false 
  WHERE account_verified IS NULL;

  UPDATE profiles 
  SET created_at = now() 
  WHERE created_at IS NULL;

  UPDATE profiles 
  SET updated_at = now() 
  WHERE updated_at IS NULL;

  UPDATE profiles 
  SET first_name = COALESCE(first_name, '')
  WHERE first_name IS NULL;

  UPDATE profiles 
  SET last_name = COALESCE(last_name, '')
  WHERE last_name IS NULL;
END $$;

-- Step 3: Add NOT NULL constraints only if columns have defaults
DO $$
BEGIN
  -- Only add NOT NULL if column doesn't already have it and has a default
  -- We'll be careful here to not break existing data
  
  -- For columns that should never be NULL, ensure they have defaults first
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'kyc_tier' 
    AND is_nullable = 'NO'
  ) THEN
    -- First ensure all existing rows have values
    UPDATE profiles SET kyc_tier = 1 WHERE kyc_tier IS NULL;
    -- Then add NOT NULL constraint
    ALTER TABLE profiles ALTER COLUMN kyc_tier SET NOT NULL;
    ALTER TABLE profiles ALTER COLUMN kyc_tier SET DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'app_lock_enabled' 
    AND is_nullable = 'NO'
  ) THEN
    UPDATE profiles SET app_lock_enabled = false WHERE app_lock_enabled IS NULL;
    ALTER TABLE profiles ALTER COLUMN app_lock_enabled SET NOT NULL;
    ALTER TABLE profiles ALTER COLUMN app_lock_enabled SET DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'two_factor_enabled' 
    AND is_nullable = 'NO'
  ) THEN
    UPDATE profiles SET two_factor_enabled = false WHERE two_factor_enabled IS NULL;
    ALTER TABLE profiles ALTER COLUMN two_factor_enabled SET NOT NULL;
    ALTER TABLE profiles ALTER COLUMN two_factor_enabled SET DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'email_verified' 
    AND is_nullable = 'NO'
  ) THEN
    UPDATE profiles SET email_verified = false WHERE email_verified IS NULL;
    ALTER TABLE profiles ALTER COLUMN email_verified SET NOT NULL;
    ALTER TABLE profiles ALTER COLUMN email_verified SET DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'account_verified' 
    AND is_nullable = 'NO'
  ) THEN
    UPDATE profiles SET account_verified = false WHERE account_verified IS NULL;
    ALTER TABLE profiles ALTER COLUMN account_verified SET NOT NULL;
    ALTER TABLE profiles ALTER COLUMN account_verified SET DEFAULT false;
  END IF;
END $$;

-- Step 4: Ensure wallets table has all required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'balance') THEN
    ALTER TABLE wallets ADD COLUMN balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'locked_balance') THEN
    ALTER TABLE wallets ADD COLUMN locked_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'created_at') THEN
    ALTER TABLE wallets ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'updated_at') THEN
    ALTER TABLE wallets ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Ensure unique constraint on user_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallets_user_id_key' 
    AND table_name = 'wallets'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Step 5: Update existing wallets with defaults
DO $$
BEGIN
  UPDATE wallets SET balance = 0 WHERE balance IS NULL;
  UPDATE wallets SET locked_balance = 0 WHERE locked_balance IS NULL;
  UPDATE wallets SET created_at = now() WHERE created_at IS NULL;
  UPDATE wallets SET updated_at = now() WHERE updated_at IS NULL;
END $$;

-- Step 6: Verify the trigger function handles all columns correctly
-- The trigger should already be correct from the previous migration,
-- but let's ensure it's using ON CONFLICT for safety

-- Step 7: Create a diagnostic function to test account creation
CREATE OR REPLACE FUNCTION diagnose_account_creation()
RETURNS TABLE (
  check_name text,
  status text,
  message text
) 
LANGUAGE plpgsql
AS $$
DECLARE
  profiles_columns_count integer;
  wallets_columns_count integer;
  trigger_exists boolean;
BEGIN
  -- Check if profiles table has all required columns
  SELECT COUNT(*) INTO profiles_columns_count
  FROM information_schema.columns
  WHERE table_name = 'profiles'
  AND column_name IN ('id', 'first_name', 'last_name', 'email', 'referral_code', 
                      'email_verified', 'app_lock_enabled', 'two_factor_enabled', 
                      'account_verified', 'kyc_tier', 'created_at', 'updated_at');

  IF profiles_columns_count = 12 THEN
    RETURN QUERY SELECT 'Profiles table columns'::text, 'PASS'::text, 
      format('All %s required columns exist', profiles_columns_count)::text;
  ELSE
    RETURN QUERY SELECT 'Profiles table columns'::text, 'FAIL'::text, 
      format('Missing columns. Found: %s, Expected: 12', profiles_columns_count)::text;
  END IF;

  -- Check if wallets table has all required columns
  SELECT COUNT(*) INTO wallets_columns_count
  FROM information_schema.columns
  WHERE table_name = 'wallets'
  AND column_name IN ('id', 'user_id', 'balance', 'locked_balance', 'created_at', 'updated_at');

  IF wallets_columns_count = 6 THEN
    RETURN QUERY SELECT 'Wallets table columns'::text, 'PASS'::text, 
      format('All %s required columns exist', wallets_columns_count)::text;
  ELSE
    RETURN QUERY SELECT 'Wallets table columns'::text, 'FAIL'::text, 
      format('Missing columns. Found: %s, Expected: 6', wallets_columns_count)::text;
  END IF;

  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) INTO trigger_exists;

  IF trigger_exists THEN
    RETURN QUERY SELECT 'Account creation trigger'::text, 'PASS'::text, 
      'Trigger on_auth_user_created exists'::text;
  ELSE
    RETURN QUERY SELECT 'Account creation trigger'::text, 'FAIL'::text, 
      'Trigger on_auth_user_created does not exist'::text;
  END IF;

  -- Check if handle_new_user function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RETURN QUERY SELECT 'handle_new_user function'::text, 'PASS'::text, 
      'Function handle_new_user exists'::text;
  ELSE
    RETURN QUERY SELECT 'handle_new_user function'::text, 'FAIL'::text, 
      'Function handle_new_user does not exist'::text;
  END IF;

  -- Check RLS policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'System can insert profiles'
  ) THEN
    RETURN QUERY SELECT 'RLS policy for profiles'::text, 'PASS'::text, 
      'System can insert profiles policy exists'::text;
  ELSE
    RETURN QUERY SELECT 'RLS policy for profiles'::text, 'WARN'::text, 
      'System can insert profiles policy does not exist (may not be needed with SECURITY DEFINER)'::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' 
    AND policyname = 'System can insert wallets'
  ) THEN
    RETURN QUERY SELECT 'RLS policy for wallets'::text, 'PASS'::text, 
      'System can insert wallets policy exists'::text;
  ELSE
    RETURN QUERY SELECT 'RLS policy for wallets'::text, 'WARN'::text, 
      'System can insert wallets policy does not exist (may not be needed with SECURITY DEFINER)'::text;
  END IF;

END $$;

-- Step 8: Add ON CONFLICT handling to the trigger function for extra safety
-- Update the handle_new_user function to use ON CONFLICT DO NOTHING for profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  referral_code_value text;
BEGIN
  -- Generate a unique referral code
  referral_code_value := UPPER(SUBSTRING(MD5(NEW.id::text || NEW.email || EXTRACT(EPOCH FROM NOW())::text) FROM 1 FOR 8));
  
  -- Insert the new profile with comprehensive error handling and ON CONFLICT
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    referral_code,
    email_verified,
    app_lock_enabled,
    two_factor_enabled,
    account_verified,
    kyc_tier,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    referral_code_value,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false,
    false,
    false,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists

  -- Create wallet for the new user
  INSERT INTO public.wallets (
    user_id,
    balance,
    locked_balance,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent errors if wallet already exists

  -- Handle referral code if provided
  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL 
     AND NEW.raw_user_meta_data->>'referral_code' != '' 
     AND NEW.raw_user_meta_data->>'referral_code' != referral_code_value THEN
    
    -- Find the referrer by their referral code
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code'
    LIMIT 1;

    -- Update the referred_by field if referrer found
    IF referrer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET referred_by = referrer_id,
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RAISE LOG 'User ID: %, Email: %', NEW.id, NEW.email;
    
    -- Try to create a minimal profile if the full creation failed
    BEGIN
      INSERT INTO public.profiles (id, email, referral_code, created_at, updated_at)
      VALUES (NEW.id, NEW.email, UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 8)), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
      
      INSERT INTO public.wallets (user_id, created_at, updated_at)
      VALUES (NEW.id, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING;
      
      RAISE LOG 'Fallback profile creation successful for user: %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Fallback profile creation also failed for user: %, Error: %', NEW.id, SQLERRM;
    END;
    
    -- Always return NEW to prevent signup failure
    RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION diagnose_account_creation() IS 'Diagnostic function to check account creation setup. Run SELECT * FROM diagnose_account_creation(); to see results.';

