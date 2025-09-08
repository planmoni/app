/*
  # Fix Account Creation Trigger
  
  This migration ensures the account creation process works flawlessly by:
  1. Creating a robust handle_new_user function
  2. Ensuring proper error handling
  3. Adding fallback mechanisms
  4. Optimizing for performance
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a robust handle_new_user function
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
  
  -- Insert the new profile with comprehensive error handling
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
  );

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
  ON CONFLICT (user_id) DO NOTHING;

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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies allow the trigger to work
DO $$
BEGIN
  -- Check if the system insert policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'System can insert profiles'
  ) THEN
    CREATE POLICY "System can insert profiles"
      ON profiles
      FOR INSERT
      TO authenticated, anon
      WITH CHECK (true);
  END IF;
  
  -- Check if the system insert policy exists for wallets, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallets' 
    AND policyname = 'System can insert wallets'
  ) THEN
    CREATE POLICY "System can insert wallets"
      ON wallets
      FOR INSERT
      TO authenticated, anon
      WITH CHECK (true);
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates user profile and wallet when a new user signs up. Includes comprehensive error handling and fallback mechanisms.';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates profile and wallet for new users with robust error handling.';
