/*
  # Email Verification Cache Schema

  1. New Tables
    - `email_verification_cache` - Stores email verification status for users during signup
      - `email` (text, primary key)
      - `first_name` (text)
      - `last_name` (text)
      - `verified` (boolean)
      - `expires_at` (timestamp with time zone)
      - `created_at` (timestamp with time zone)
  
  2. Security
    - Enable RLS on `email_verification_cache` table
    - Add policies for public read access and authenticated user management
    - Create cleanup function for expired verification records
*/

-- Create email verification cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.email_verification_cache (
  email text PRIMARY KEY,
  first_name text,
  last_name text,
  verified boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_cache_verified ON public.email_verification_cache(email, verified);

-- Add RLS policies
ALTER TABLE public.email_verification_cache ENABLE ROW LEVEL SECURITY;

-- Check if policies exist before creating them
DO $$
DECLARE
  policy_exists boolean;
BEGIN
    -- Check and create "Anyone can read email verification status" policy
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_verification_cache' 
        AND policyname = 'Anyone can read email verification status'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Anyone can read email verification status" 
        ON public.email_verification_cache
        FOR SELECT 
        USING (true);
    END IF;

    -- Check and create "Service role can manage all email verification records" policy
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_verification_cache' 
        AND policyname = 'Service role can manage all email verification records'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Service role can manage all email verification records" 
        ON public.email_verification_cache
        FOR ALL 
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    -- Check and create "Users can update their own email verification" policy
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_verification_cache' 
        AND policyname = 'Users can update their own email verification'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Users can update their own email verification" 
        ON public.email_verification_cache
        FOR UPDATE 
        TO authenticated
        USING ((auth.uid())::text = email)
        WITH CHECK ((auth.uid())::text = email);
    END IF;

    -- Check and create "Users can insert their own email verification" policy
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'email_verification_cache' 
        AND policyname = 'Users can insert their own email verification'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Users can insert their own email verification" 
        ON public.email_verification_cache
        FOR INSERT 
        TO authenticated
        WITH CHECK ((auth.uid())::text = email);
    END IF;
END
$$;

-- Create a function to clean up expired verification records
CREATE OR REPLACE FUNCTION cleanup_expired_email_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.email_verification_cache
  WHERE expires_at < NOW();
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.email_verification_cache TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_email_verifications() TO service_role;