/*
  # Fix signup trigger function

  1. Database Functions
    - Update or recreate the `handle_new_user` function to properly handle user creation
    - Ensure proper error handling and data validation
    - Fix any issues with profile and wallet creation

  2. Security
    - Maintain existing RLS policies
    - Ensure proper user data isolation

  3. Data Integrity
    - Add proper null checks and default values
    - Handle referral code logic safely
*/

-- Drop existing function if it exists to recreate it
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create the handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id uuid;
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    referral_code,
    referred_by,
    is_admin,
    app_lock_enabled,
    two_factor_enabled,
    email_verified,
    account_verified
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'referral_code', NULL),
    NULL, -- Will be updated by update_referred_by trigger
    false,
    false,
    false,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false
  );

  -- Create wallet for the new user
  INSERT INTO public.wallets (
    user_id,
    balance,
    locked_balance
  ) VALUES (
    NEW.id,
    0,
    0
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Re-raise the exception to fail the transaction
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the update_referred_by function
CREATE OR REPLACE FUNCTION update_referred_by()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id uuid;
BEGIN
  -- Only process if referral_code is provided
  IF NEW.referral_code IS NOT NULL AND NEW.referral_code != '' THEN
    -- Find the referrer by referral code
    SELECT id INTO referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.referral_code
    AND id != NEW.id; -- Prevent self-referral

    -- Update the referred_by field if referrer found
    IF referrer_id IS NOT NULL THEN
      NEW.referred_by := referrer_id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction for referral issues
    RAISE LOG 'Error in update_referred_by: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger_update_next_payout_date function
CREATE OR REPLACE FUNCTION trigger_update_next_payout_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate next payout date based on frequency and start date
  CASE NEW.frequency
    WHEN 'weekly' THEN
      NEW.next_payout_date := NEW.start_date + INTERVAL '7 days';
    WHEN 'biweekly' THEN
      NEW.next_payout_date := NEW.start_date + INTERVAL '14 days';
    WHEN 'monthly' THEN
      NEW.next_payout_date := NEW.start_date + INTERVAL '1 month';
    WHEN 'custom' THEN
      -- For custom frequency, next_payout_date should be set manually
      -- or calculated based on custom_payout_dates table
      NULL;
  END CASE;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in trigger_update_next_payout_date: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the update_referred_by trigger exists on profiles
DROP TRIGGER IF EXISTS update_referred_by_trigger ON public.profiles;
CREATE TRIGGER update_referred_by_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_referred_by();

-- Ensure the updated_at triggers exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payout_accounts_updated_at ON public.payout_accounts;
CREATE TRIGGER update_payout_accounts_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure the payout plan trigger exists
DROP TRIGGER IF EXISTS trigger_payout_plan_next_date ON public.payout_plans;
CREATE TRIGGER trigger_payout_plan_next_date
  AFTER INSERT ON public.payout_plans
  FOR EACH ROW EXECUTE FUNCTION trigger_update_next_payout_date();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;