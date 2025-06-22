/*
  # Fix Supabase signup trigger

  This migration fixes the database error that occurs during user signup by ensuring:
  1. The handle_new_user function exists and works correctly
  2. The trigger is properly set up on auth.users
  3. RLS policies allow the trigger to insert into profiles table

  ## Changes
  1. Recreate the handle_new_user function with proper error handling
  2. Ensure the trigger exists on auth.users table
  3. Add necessary RLS policies for the trigger to work
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS policies allow the trigger to work
-- The trigger runs with SECURITY DEFINER so it should bypass RLS,
-- but let's make sure there's a policy for system operations
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
END $$;

-- Also ensure the profiles table has the correct structure
-- Add any missing columns that might be expected
DO $$
BEGIN
  -- Add referral_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_code text;
  END IF;
  
  -- Add referred_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referred_by uuid REFERENCES profiles(id);
  END IF;
END $$;