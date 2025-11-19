/*
  # Secure Wallets Table - Prevent Manual Updates
  
  This migration secures the wallets table by:
  1. Removing direct UPDATE permissions from authenticated users
  2. Only allowing updates through SECURITY DEFINER functions
  3. Ensuring balance, locked_balance, and available_balance can only be updated via functions
  
  Security:
  - Users can still VIEW their own wallet (SELECT)
  - Users CANNOT directly UPDATE their wallet
  - Only SECURITY DEFINER functions (add_funds, lock_funds, etc.) can update wallets
  - Service role (used by edge functions) can update through functions
*/

-- Drop the policy that allows users to update their own wallet
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;

-- Drop any other UPDATE policies that might allow direct updates
DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;
DROP POLICY IF EXISTS "Service role can update wallets" ON wallets;

-- Revoke UPDATE permission from authenticated role
-- This prevents direct SQL updates from authenticated users
REVOKE UPDATE ON wallets FROM authenticated;

-- Grant UPDATE permission only to service_role
-- This allows edge functions (which use service_role) to update wallets
-- Edge functions like safehaven-webhook use service_role and can update wallets directly
GRANT UPDATE ON wallets TO service_role;

-- Create an audit table to track blocked wallet update attempts
CREATE TABLE IF NOT EXISTS wallet_update_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  attempted_balance numeric,
  attempted_locked_balance numeric,
  attempted_available_balance numeric,
  backend_pid integer,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  blocked boolean NOT NULL DEFAULT true
);

-- Create index for querying
CREATE INDEX IF NOT EXISTS idx_wallet_update_attempts_user ON wallet_update_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_update_attempts_attempted_at ON wallet_update_attempts(attempted_at);

-- Create a temporary table to track allowed wallet updates
-- This table will be used by functions to mark their updates as allowed
CREATE TABLE IF NOT EXISTS wallet_update_allowed (
  pid integer PRIMARY KEY,
  allowed boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 minute'
);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_wallet_update_allowed_expires ON wallet_update_allowed(expires_at);

-- Function to allow wallet updates (called by wallet functions)
CREATE OR REPLACE FUNCTION allow_wallet_update()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update the current backend PID to allow updates
  INSERT INTO wallet_update_allowed (pid, allowed, expires_at)
  VALUES (pg_backend_pid(), true, now() + interval '1 minute')
  ON CONFLICT (pid) DO UPDATE
  SET allowed = true, expires_at = now() + interval '1 minute';
END;
$$;

-- Function to check if wallet update is allowed
CREATE OR REPLACE FUNCTION is_wallet_update_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  is_allowed boolean;
BEGIN
  -- Check if current backend PID is in the allowed list and not expired
  SELECT EXISTS(
    SELECT 1 FROM wallet_update_allowed
    WHERE pid = pg_backend_pid()
    AND allowed = true
    AND expires_at > now()
  ) INTO is_allowed;
  
  RETURN COALESCE(is_allowed, false);
END;
$$;

-- Create a trigger function that prevents direct updates to balance columns
-- This will block updates even from Supabase dashboard table editor
CREATE OR REPLACE FUNCTION prevent_direct_wallet_updates()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if any balance-related columns are being updated
  IF (
    OLD.balance IS DISTINCT FROM NEW.balance OR
    OLD.locked_balance IS DISTINCT FROM NEW.locked_balance OR
    OLD.available_balance IS DISTINCT FROM NEW.available_balance
  ) THEN
    -- Check if this update is coming from an allowed function
    IF NOT is_wallet_update_allowed() THEN
      -- Get user_id for audit logging
      v_user_id := NEW.user_id;
      
      -- Log the blocked attempt to audit table (silently, without raising error in log)
      BEGIN
        INSERT INTO wallet_update_attempts (
          user_id,
          attempted_balance,
          attempted_locked_balance,
          attempted_available_balance,
          backend_pid,
          blocked
        ) VALUES (
          v_user_id,
          NEW.balance,
          NEW.locked_balance,
          NEW.available_balance,
          pg_backend_pid(),
          true
        );
      EXCEPTION WHEN OTHERS THEN
        -- If audit logging fails, continue anyway
        NULL;
      END;
      
      -- Direct update attempt - block it (even from Supabase dashboard table editor)
      -- Use a shorter error message to reduce log noise
      RAISE EXCEPTION 'Direct wallet updates not allowed. Use add_funds, lock_funds, unlock_funds, or update_wallet_from_webhook functions.';
    END IF;
  END IF;
  
  -- Allow updates to other columns (like updated_at, created_at)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_direct_wallet_updates_trigger ON wallets;
CREATE TRIGGER prevent_direct_wallet_updates_trigger
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_wallet_updates();

-- Update wallet functions to mark updates as allowed before updating
-- This allows functions to bypass the trigger
CREATE OR REPLACE FUNCTION add_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed
  PERFORM allow_wallet_update();
  
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get or create wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id;

  IF NOT FOUND THEN
    -- Create new wallet
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_amount, 0, arg_amount)
    RETURNING * INTO wallet_record;
  ELSE
    -- Update existing wallet
    UPDATE wallets
    SET balance = COALESCE(balance, 0) + arg_amount,
        available_balance = COALESCE(balance, 0) + arg_amount - COALESCE(locked_balance, 0),
        updated_at = now()
    WHERE user_id = arg_user_id
    RETURNING * INTO wallet_record;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create a function specifically for webhook wallet updates
-- This allows edge functions to update wallets through a controlled function
CREATE OR REPLACE FUNCTION update_wallet_from_webhook(
  arg_user_id uuid,
  arg_balance numeric,
  arg_available_balance numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark this update as allowed
  PERFORM allow_wallet_update();
  
  UPDATE wallets
  SET 
    balance = arg_balance,
    available_balance = arg_available_balance,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
  -- If wallet doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_balance, 0, arg_available_balance);
  END IF;
END;
$$;

-- Update lock_funds function to mark updates as allowed
CREATE OR REPLACE FUNCTION lock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
  available_balance numeric;
BEGIN
  -- Mark this update as allowed
  PERFORM allow_wallet_update();
  
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate available balance
  available_balance := COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0);

  -- Check if sufficient funds available
  IF available_balance < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s, Required: %s', available_balance, arg_amount)
    );
  END IF;

  -- Lock the funds - update locked_balance and available_balance
  UPDATE wallets
  SET 
    locked_balance = COALESCE(locked_balance, 0) + arg_amount,
    available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) + arg_amount),
    updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update unlock_funds function to mark updates as allowed
CREATE OR REPLACE FUNCTION unlock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed
  PERFORM allow_wallet_update();
  
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient locked funds
  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient locked balance. Locked: %s, Required: %s', wallet_record.locked_balance, arg_amount)
    );
  END IF;

  -- Unlock the funds - update locked_balance and available_balance
  UPDATE wallets
  SET 
    locked_balance = COALESCE(locked_balance, 0) - arg_amount,
    available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) - arg_amount),
    updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create a cleanup function to remove expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_wallet_updates()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM wallet_update_allowed WHERE expires_at < now();
END;
$$;

-- Create a function to automatically clean up expired entries
-- This will be called periodically or can be scheduled
CREATE OR REPLACE FUNCTION auto_cleanup_wallet_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clean up expired entries (only if table is getting large)
  IF (SELECT COUNT(*) FROM wallet_update_allowed) > 100 THEN
    PERFORM cleanup_expired_wallet_updates();
  END IF;
  RETURN NULL;
END;
$$;

-- Note: SECURITY DEFINER functions (like add_funds, lock_funds, unlock_funds, update_wallet_from_webhook) 
-- will still be able to update wallets because they call allow_wallet_update() which marks the backend PID as allowed
-- The trigger checks if the current backend PID is in the allowed list before allowing updates

-- Summary of who can update wallets:
-- 1. Functions that call allow_wallet_update() - CAN update (bypasses trigger)
-- 2. Direct SQL/Table Editor updates - BLOCKED by trigger (even with service_role/admin)
-- 3. Edge functions - MUST use update_wallet_from_webhook() or other wallet functions

-- Create a comment explaining the security model
COMMENT ON TABLE wallets IS 'Wallet balances can only be updated through functions that call allow_wallet_update(). Direct updates (including from Supabase dashboard) are blocked by trigger.';
COMMENT ON TABLE wallet_update_allowed IS 'Temporary table tracking which backend PIDs are allowed to update wallets. Entries expire after 1 minute.';
COMMENT ON TABLE wallet_update_attempts IS 'Audit log of blocked direct wallet update attempts. Use this table to monitor security violations instead of checking error logs.';

-- Grant access to view audit logs (optional - for monitoring)
-- Uncomment if you want to allow users to see their own blocked attempts
-- CREATE POLICY "Users can view own blocked attempts" ON wallet_update_attempts
--   FOR SELECT TO authenticated
--   USING (user_id = auth.uid());

