/*
  # Add Referral Code to Profiles Table
  
  1. Changes
    - Add referral_code column to profiles table
    - Update handle_new_user function to store referral code
  
  2. Rationale
    - Enable referral program functionality
    - Track which users were referred by others
*/

-- Add referral_code column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_code text;
  END IF;
END $$;

-- Update the handle_new_user function to include referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with referral code
  INSERT INTO public.profiles (id, first_name, last_name, email, referral_code)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.email,
    new.raw_user_meta_data->>'referral_code'
  );
  
  -- Create wallet for the user
  INSERT INTO public.wallets (user_id, balance, locked_balance)
  VALUES (new.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;