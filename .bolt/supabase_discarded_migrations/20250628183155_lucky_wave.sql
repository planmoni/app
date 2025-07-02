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

-- Allow public access for verification purposes
CREATE POLICY "Anyone can read email verification status" 
  ON public.email_verification_cache
  FOR SELECT 
  USING (true);

-- Allow service role to manage all records
CREATE POLICY "Service role can manage all email verification records" 
  ON public.email_verification_cache
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to update their own records
CREATE POLICY "Users can update their own email verification" 
  ON public.email_verification_cache
  FOR UPDATE 
  TO authenticated
  USING ((auth.uid())::text = email)
  WITH CHECK ((auth.uid())::text = email);

-- Allow authenticated users to insert their own records
CREATE POLICY "Users can insert their own email verification" 
  ON public.email_verification_cache
  FOR INSERT 
  TO authenticated
  WITH CHECK ((auth.uid())::text = email);

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