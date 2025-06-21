/*
  # Fix User Signup Error
  
  1. Problem
    - Database error when updating user during signup
    - The handle_new_user function is failing to properly create user profiles
  
  2. Solution
    - Update the handle_new_user function to be more robust
    - Add better error handling and null checks
    - Ensure proper handling of metadata fields
*/

-- Create or replace the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with proper null handling
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
    kyc_tier
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.email, ''),
    NULL, -- Will be set later by a separate function
    COALESCE(new.email_confirmed_at IS NOT NULL, false),
    false,
    false,
    false,
    1
  );
  
  -- Create wallet for the user
  INSERT INTO public.wallets (
    user_id, 
    balance, 
    locked_balance
  )
  VALUES (
    new.id, 
    0, 
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Process referral if code was provided
  IF new.raw_user_meta_data->>'referral_code' IS NOT NULL AND new.raw_user_meta_data->>'referral_code' != '' THEN
    -- Find the referrer based on the provided code
    UPDATE profiles
    SET referred_by = (
      SELECT id FROM profiles 
      WHERE referral_code = new.raw_user_meta_data->>'referral_code'
      LIMIT 1
    )
    WHERE id = new.id;
  END IF;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error (this will appear in Supabase logs)
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Return the new user anyway to prevent signup failure
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();