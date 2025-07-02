/*
  # Create OTP Functions

  1. New Functions
    - `send_otp_email` - Generates and stores OTP for email verification
    - `verify_otp` - Verifies OTP code and marks it as used
    - `cleanup_expired_otps` - Removes expired OTP records

  2. Security
    - Functions are accessible to authenticated and anonymous users
    - OTP codes are 6-digit random numbers
    - OTPs expire after 10 minutes
    - Used OTPs cannot be reused

  3. Features
    - Automatic cleanup of expired OTPs
    - Secure OTP generation
    - Email validation
*/

-- Function to generate a random 6-digit OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to send OTP email (stores OTP in database)
CREATE OR REPLACE FUNCTION send_otp_email(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_otp_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate email format
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  -- Generate OTP and set expiration (10 minutes from now)
  v_otp_code := generate_otp();
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- Clean up any existing OTPs for this email
  DELETE FROM otps WHERE email = LOWER(p_email);

  -- Insert new OTP
  INSERT INTO otps (email, otp_code, expires_at, is_used)
  VALUES (LOWER(p_email), v_otp_code, v_expires_at, FALSE);

  -- In a real implementation, you would send the email here
  -- For now, we'll just return TRUE to indicate success
  -- The OTP will be available in the database for testing
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to send OTP: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION verify_otp(p_email TEXT, p_otp TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_otp_record RECORD;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' OR p_otp IS NULL OR p_otp = '' THEN
    RETURN FALSE;
  END IF;

  -- Find the OTP record
  SELECT * INTO v_otp_record
  FROM otps
  WHERE email = LOWER(p_email)
    AND otp_code = p_otp
    AND is_used = FALSE
    AND expires_at > NOW();

  -- If no valid OTP found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark OTP as used
  UPDATE otps
  SET is_used = TRUE
  WHERE id = v_otp_record.id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired OTPs (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM otps
  WHERE expires_at < NOW() OR is_used = TRUE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION send_otp_email(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_otp(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_otps() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_otp() TO authenticated, anon;

-- Create an index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_otps_email_expires ON otps(email, expires_at) WHERE is_used = FALSE;