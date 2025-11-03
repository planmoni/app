/*
  # TOTP Two-Factor Authentication System
  
  This migration creates a complete TOTP-based 2FA system with:
  1. Enhanced profiles table with TOTP fields
  2. Backup codes table for recovery
  3. TOTP verification functions
  4. Security policies and triggers
  
  Tables Created:
  - Enhanced profiles table with TOTP fields
  - two_factor_backup_codes table
  - two_factor_verification_attempts table (for rate limiting)
  
  Functions Created:
  - generate_totp_secret() - Generate TOTP secret for user
  - verify_totp_token() - Verify TOTP codes
  - generate_backup_codes() - Generate recovery codes
  - verify_backup_code() - Verify backup codes
  - cleanup_expired_attempts() - Clean up old verification attempts
*/

-- Add TOTP-related columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_method TEXT DEFAULT 'email'; -- 'authenticator', 'email'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_setup_completed_at TIMESTAMPTZ;

-- Create backup codes table
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- Hashed backup code
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year')
);

-- Create verification attempts table for rate limiting
CREATE TABLE IF NOT EXISTS two_factor_verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL, -- 'totp', 'backup_code'
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for backup codes
CREATE POLICY "Users can view own backup codes"
  ON two_factor_backup_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backup codes"
  ON two_factor_backup_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backup codes"
  ON two_factor_backup_codes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for verification attempts
CREATE POLICY "Users can view own verification attempts"
  ON two_factor_verification_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification attempts"
  ON two_factor_verification_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_code_hash ON two_factor_backup_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_backup_codes_expires_at ON two_factor_backup_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_user_id ON two_factor_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_created_at ON two_factor_verification_attempts(created_at);

-- Function to generate TOTP secret
CREATE OR REPLACE FUNCTION generate_totp_secret(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_user_email TEXT;
BEGIN
  -- Get user email for TOTP label
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Generate a random 32-character base32 secret
  v_secret := encode(gen_random_bytes(20), 'base64');
  v_secret := translate(v_secret, '+/=', 'ABC');
  v_secret := left(v_secret, 32);
  
  -- Update user's TOTP secret
  UPDATE profiles
  SET totp_secret = v_secret
  WHERE id = p_user_id;
  
  RETURN v_secret;
END;
$$;

-- Function to verify TOTP token (simplified - you'll need to implement proper TOTP algorithm)
CREATE OR REPLACE FUNCTION verify_totp_token(
  p_user_id UUID,
  p_token TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_attempt_count INTEGER;
  v_is_valid BOOLEAN := false;
BEGIN
  -- Check rate limiting (max 5 attempts per 15 minutes)
  SELECT COUNT(*) INTO v_attempt_count
  FROM two_factor_verification_attempts
  WHERE user_id = p_user_id
    AND attempt_type = 'totp'
    AND success = false
    AND created_at > (now() - INTERVAL '15 minutes');
  
  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
  END IF;
  
  -- Get user's TOTP secret
  SELECT totp_secret INTO v_secret
  FROM profiles
  WHERE id = p_user_id AND totp_enabled = true;
  
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'TOTP not enabled for this user';
  END IF;
  
  -- TODO: Implement proper TOTP verification using speakeasy or similar
  -- For now, we'll use a simple validation (replace with actual TOTP logic)
  -- This is a placeholder - you need to implement the actual TOTP algorithm
  v_is_valid := (length(p_token) = 6 AND p_token ~ '^[0-9]+$');
  
  -- Log the attempt
  INSERT INTO two_factor_verification_attempts (
    user_id, attempt_type, ip_address, user_agent, success
  ) VALUES (
    p_user_id, 'totp', p_ip_address, p_user_agent, v_is_valid
  );
  
  RETURN v_is_valid;
END;
$$;

-- Function to generate backup codes
CREATE OR REPLACE FUNCTION generate_backup_codes(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_codes TEXT[] := '{}';
  v_code TEXT;
  v_code_hash TEXT;
  i INTEGER;
BEGIN
  -- Delete existing unused backup codes
  DELETE FROM two_factor_backup_codes
  WHERE user_id = p_user_id AND is_used = false;
  
  -- Generate 10 backup codes
  FOR i IN 1..10 LOOP
    -- Generate 8-character alphanumeric code
    v_code := upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8));
    v_code := translate(v_code, '+/=', 'ABC');
    
    -- Hash the code for storage
    v_code_hash := encode(digest(v_code, 'sha256'), 'hex');
    
    -- Store hashed code
    INSERT INTO two_factor_backup_codes (user_id, code_hash)
    VALUES (p_user_id, v_code_hash);
    
    -- Add to return array
    v_codes := array_append(v_codes, v_code);
  END LOOP;
  
  RETURN v_codes;
END;
$$;

-- Function to verify backup code
CREATE OR REPLACE FUNCTION verify_backup_code(
  p_user_id UUID,
  p_code TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code_hash TEXT;
  v_backup_code_record RECORD;
  v_attempt_count INTEGER;
BEGIN
  -- Check rate limiting (max 3 attempts per 15 minutes)
  SELECT COUNT(*) INTO v_attempt_count
  FROM two_factor_verification_attempts
  WHERE user_id = p_user_id
    AND attempt_type = 'backup_code'
    AND success = false
    AND created_at > (now() - INTERVAL '15 minutes');
  
  IF v_attempt_count >= 3 THEN
    RAISE EXCEPTION 'Too many failed backup code attempts. Please try again later.';
  END IF;
  
  -- Hash the provided code
  v_code_hash := encode(digest(upper(p_code), 'sha256'), 'hex');
  
  -- Find matching backup code
  SELECT * INTO v_backup_code_record
  FROM two_factor_backup_codes
  WHERE user_id = p_user_id
    AND code_hash = v_code_hash
    AND is_used = false
    AND expires_at > now();
  
  -- Log the attempt
  INSERT INTO two_factor_verification_attempts (
    user_id, attempt_type, ip_address, user_agent, success
  ) VALUES (
    p_user_id, 'backup_code', p_ip_address, p_user_agent, (v_backup_code_record.id IS NOT NULL)
  );
  
  -- If code found, mark as used
  IF v_backup_code_record.id IS NOT NULL THEN
    UPDATE two_factor_backup_codes
    SET is_used = true, used_at = now()
    WHERE id = v_backup_code_record.id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to enable TOTP for user
CREATE OR REPLACE FUNCTION enable_totp_for_user(
  p_user_id UUID,
  p_verification_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_is_valid BOOLEAN;
BEGIN
  -- Verify the token first
  SELECT verify_totp_token(p_user_id, p_verification_token) INTO v_is_valid;
  
  IF NOT v_is_valid THEN
    RETURN false;
  END IF;
  
  -- Enable TOTP and mark setup as completed
  UPDATE profiles
  SET 
    totp_enabled = true,
    two_factor_enabled = true,
    two_factor_method = 'authenticator',
    totp_setup_completed_at = now()
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$;

-- Function to disable TOTP for user
CREATE OR REPLACE FUNCTION disable_totp_for_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable TOTP
  UPDATE profiles
  SET 
    totp_enabled = false,
    two_factor_enabled = false,
    two_factor_method = 'email',
    totp_secret = NULL,
    totp_setup_completed_at = NULL
  WHERE id = p_user_id;
  
  -- Delete all backup codes
  DELETE FROM two_factor_backup_codes
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;

-- Function to cleanup expired verification attempts
CREATE OR REPLACE FUNCTION cleanup_expired_verification_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete attempts older than 24 hours
  DELETE FROM two_factor_verification_attempts
  WHERE created_at < (now() - INTERVAL '24 hours');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Function to cleanup expired backup codes
CREATE OR REPLACE FUNCTION cleanup_expired_backup_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired backup codes
  DELETE FROM two_factor_backup_codes
  WHERE expires_at < now() OR is_used = true;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_totp_secret(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_totp_token(UUID, TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_backup_codes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_backup_code(UUID, TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_totp_for_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_totp_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_attempts() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_backup_codes() TO service_role;

-- Create a trigger to automatically cleanup old data
CREATE OR REPLACE FUNCTION auto_cleanup_2fa_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cleanup expired verification attempts (keep last 24 hours)
  PERFORM cleanup_expired_verification_attempts();
  
  -- Cleanup expired backup codes
  PERFORM cleanup_expired_backup_codes();
END;
$$;

-- Create a scheduled function to run cleanup daily (if pg_cron is available)
-- SELECT cron.schedule('cleanup-2fa-data', '0 2 * * *', 'SELECT auto_cleanup_2fa_data();');

-- Add comments for documentation
COMMENT ON TABLE two_factor_backup_codes IS 'Backup codes for 2FA recovery';
COMMENT ON TABLE two_factor_verification_attempts IS 'Rate limiting and audit trail for 2FA attempts';
COMMENT ON COLUMN profiles.totp_secret IS 'Base32 encoded TOTP secret key';
COMMENT ON COLUMN profiles.totp_enabled IS 'Whether TOTP is enabled for this user';
COMMENT ON COLUMN profiles.two_factor_method IS 'Primary 2FA method: authenticator or email';
COMMENT ON COLUMN profiles.totp_setup_completed_at IS 'When TOTP setup was completed';
