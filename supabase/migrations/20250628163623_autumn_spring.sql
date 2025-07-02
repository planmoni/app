/*
  # Fix Profile Creation Trigger

  1. Database Trigger Setup
    - Create trigger on auth.users table to automatically create profile
    - Ensure profile is created immediately when user signs up
    - Handle user metadata properly (first_name, last_name, referral_code)

  2. Security
    - Maintain existing RLS policies
    - Ensure trigger runs with proper permissions

  3. Error Handling
    - Add proper error handling in trigger function
    - Ensure referral code processing works correctly
*/

-- First, let's recreate the handle_new_user function to ensure it's correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  -- Insert the new profile
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    referral_code,
    referred_by
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    generate_referral_code(),
    NULL -- We'll update this below if referral_code is provided
  );

  -- Handle referral code if provided
  IF NEW.raw_user_meta_data->>'referral_code' IS NOT NULL AND NEW.raw_user_meta_data->>'referral_code' != '' THEN
    -- Find the referrer by their referral code
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.raw_user_meta_data->>'referral_code'
    LIMIT 1;

    -- Update the referred_by field if referrer found
    IF referrer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET referred_by = referrer_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  -- Create wallet for the new user
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the function to generate referral codes if it doesn't exist
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    -- Generate a random 8-character code
    code := upper(substring(md5(random()::text) from 1 for 8));
    
    -- Check if this code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    
    -- If it doesn't exist, we can use it
    IF NOT exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that fires when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure the trigger function has the right permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION generate_referral_code() TO supabase_auth_admin;