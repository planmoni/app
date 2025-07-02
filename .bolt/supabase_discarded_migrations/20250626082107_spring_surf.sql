/*
# Add OTP Verification Function

1. New Functions
  - `send_otp_email` - Sends an OTP verification email using Supabase's SMTP server
  - `verify_otp` - Verifies an OTP code against the stored OTP in the database

2. Security
  - Functions are accessible to both authenticated and anonymous users
  - OTP codes are stored securely with expiration times

3. Changes
  - Adds support for email verification during onboarding
  - Improves security by using server-side OTP generation and verification
*/

-- Function to send OTP email using Supabase's SMTP server
CREATE OR REPLACE FUNCTION public.send_otp_email(
  p_email TEXT,
  p_otp TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp TEXT;
  v_expires_at TIMESTAMPTZ;
  v_email_sent BOOLEAN;
BEGIN
  -- Generate OTP if not provided
  IF p_otp IS NULL THEN
    -- Generate a 6-digit OTP
    v_otp := floor(random() * 900000 + 100000)::TEXT;
  ELSE
    v_otp := p_otp;
  END IF;

  -- Set expiration time (10 minutes from now)
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- Delete any existing OTPs for this email
  DELETE FROM public.otps WHERE email = p_email;

  -- Insert new OTP
  INSERT INTO public.otps (email, otp_code, expires_at, is_used)
  VALUES (p_email, v_otp, v_expires_at, false);

  -- Send email using Supabase's SMTP server
  SELECT INTO v_email_sent
    supabase_functions.http((
      'POST',
      'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-email',
      '{"Content-Type":"application/json"}',
      '{"to":"' || p_email || '", "subject":"Your Planmoni Verification Code", "html":"<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;\"><h2 style=\"color: #1E3A8A;\">Your Verification Code</h2><p>Your verification code for Planmoni is:</p><div style=\"font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 30px 0; color: #1E3A8A;\">' || v_otp || '</div><p>This code will expire in 10 minutes.</p><p>If you didn\'t request this code, you can safely ignore this email.</p><p style=\"font-size: 12px; color: #666; margin-top: 30px;\">This is an automated message, please do not reply directly to this email.</p></div>"}'
    )).status = 200;

  RETURN v_email_sent;
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email TEXT,
  p_otp TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp_record RECORD;
  v_user_id UUID;
BEGIN
  -- Get the OTP record
  SELECT * INTO v_otp_record
  FROM public.otps
  WHERE email = p_email
    AND otp_code = p_otp
    AND is_used = false
    AND expires_at > NOW();

  -- If no valid OTP found, return false
  IF v_otp_record IS NULL THEN
    RETURN false;
  END IF;

  -- Mark OTP as used
  UPDATE public.otps
  SET is_used = true
  WHERE id = v_otp_record.id;

  -- Try to find the user and update their profile
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  -- If user exists, update their profile
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET email_verified = true
    WHERE id = v_user_id;
  END IF;

  RETURN true;
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.send_otp_email(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT) TO anon, authenticated;