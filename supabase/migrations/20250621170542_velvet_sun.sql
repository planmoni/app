/*
  # Fix signup database error

  1. Database Functions
    - Drop and recreate the handle_new_user function with proper error handling
    - Ensure the function handles all required fields and constraints
    - Add proper null checks and default values

  2. Security
    - Maintain existing RLS policies
    - Ensure proper permissions for the trigger function

  3. Changes
    - Fix the handle_new_user trigger function
    - Add better error handling and logging
    - Ensure all required tables and relationships exist
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    referral_code,
    referred_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    -- Generate a unique referral code if not provided
    COALESCE(
      NEW.raw_user_meta_data->>'referral_code',
      UPPER(SUBSTRING(MD5(NEW.id::text || NEW.email) FROM 1 FOR 8))
    ),
    -- Handle referral code lookup
    CASE 
      WHEN NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
        (SELECT id FROM public.profiles WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1)
      ELSE NULL
    END,
    NOW(),
    NOW()
  );

  -- Insert into wallets table
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
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error (this will appear in Supabase logs)
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    -- Re-raise the exception to prevent user creation if profile/wallet creation fails
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the uid() function exists for RLS policies
CREATE OR REPLACE FUNCTION uid()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the is_admin() function exists for RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((
    SELECT is_admin 
    FROM public.profiles 
    WHERE id = auth.uid()
  ), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the is_super_admin() function exists for RLS policies
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((
    SELECT EXISTS(
      SELECT 1 
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'super_admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  ), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;