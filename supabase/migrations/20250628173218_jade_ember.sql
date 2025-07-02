/*
  # Fix OTP Verification

  1. New Functions
    - Improved `verify_otp` function with better error handling and logging
    - Adds `send_otp_email` function for consistent OTP generation

  2. Security
    - Both functions use SECURITY DEFINER to ensure proper access control
    - Proper error handling and validation
*/

-- Create or replace the verify_otp function with improved error handling and logging
CREATE OR REPLACE FUNCTION public.verify_otp(
    p_email text,
    p_otp text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Use SECURITY DEFINER for elevated privileges
SET search_path = public -- Ensure the function operates within the public schema
AS $$
DECLARE
    otp_record public.otps;
BEGIN
    RAISE LOG 'Attempting to verify OTP for email: %', p_email;

    -- Input validation
    IF p_email IS NULL OR p_otp IS NULL THEN
        RAISE LOG 'Invalid input: email or OTP is NULL';
        RETURN FALSE;
    END IF;

    -- Retrieve the OTP record
    SELECT *
    INTO otp_record
    FROM public.otps
    WHERE email = LOWER(p_email) AND otp_code = p_otp
    ORDER BY created_at DESC -- Get the latest OTP if multiple exist
    LIMIT 1;

    -- Check if an OTP record was found
    IF otp_record IS NULL THEN
        RAISE LOG 'OTP record not found for email: % or OTP: %', p_email, p_otp;
        RETURN FALSE;
    END IF;

    RAISE LOG 'Found OTP record: id=%, expires_at=%, is_used=%', otp_record.id, otp_record.expires_at, otp_record.is_used;

    -- Check if the OTP has expired
    IF otp_record.expires_at < NOW() THEN
        RAISE LOG 'OTP expired for id: %, expired at: %, current time: %', 
                 otp_record.id, otp_record.expires_at, NOW();
        RETURN FALSE;
    END IF;

    -- Check if the OTP has already been used
    IF otp_record.is_used THEN
        RAISE LOG 'OTP already used for id: %', otp_record.id;
        RETURN FALSE;
    END IF;

    -- If all checks pass, mark the OTP as used
    UPDATE public.otps
    SET is_used = TRUE
    WHERE id = otp_record.id;

    RAISE LOG 'OTP successfully verified and marked as used for id: %', otp_record.id;
    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error verifying OTP: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Create or replace the send_otp_email function for consistent OTP generation
CREATE OR REPLACE FUNCTION public.send_otp_email(
    p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_otp_code text;
    v_expires_at timestamp with time zone;
BEGIN
    RAISE LOG 'Generating OTP for email: %', p_email;

    -- Input validation
    IF p_email IS NULL THEN
        RAISE LOG 'Invalid input: email is NULL';
        RETURN FALSE;
    END IF;

    -- Generate a 6-digit OTP
    v_otp_code := lpad(floor(random() * 1000000)::text, 6, '0');
    
    -- Set expiration time (10 minutes from now)
    v_expires_at := NOW() + INTERVAL '10 minutes';
    
    -- Insert the OTP into the database
    INSERT INTO public.otps (
        email,
        otp_code,
        expires_at,
        is_used
    ) VALUES (
        LOWER(p_email),
        v_otp_code,
        v_expires_at,
        FALSE
    );
    
    RAISE LOG 'OTP generated successfully for email: %, expires at: %', p_email, v_expires_at;
    
    -- In a real implementation, you would send an email here
    -- For now, we just return success
    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error generating OTP: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.verify_otp TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_otp_email TO anon, authenticated, service_role;

-- Ensure the otps table exists with the right structure
CREATE TABLE IF NOT EXISTS public.otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otps_email_code ON public.otps(email, otp_code);
CREATE INDEX IF NOT EXISTS idx_otps_email_expires ON public.otps(email, expires_at) WHERE (is_used = false);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON public.otps(expires_at);