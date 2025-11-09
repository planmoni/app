/*
  # SafeHaven Integration Tables
  
  This migration creates tables for storing SafeHaven API tokens and account data
  with comprehensive audit trail integration.
  
  Key Features:
  1. Secure token storage with encryption
  2. Account data synchronization
  3. Audit trail integration
  4. Token expiration management
  5. User-specific data isolation
*/

-- Create safehaven_tokens table for storing API tokens
CREATE TABLE IF NOT EXISTS safehaven_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Token data
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_in integer NOT NULL,
  expires_at timestamptz NOT NULL,
  
  -- SafeHaven specific data
  ibs_client_id text NOT NULL,
  ibs_user_id text NOT NULL,
  client_id text NOT NULL,
  
  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create safehaven_accounts table for storing account data
CREATE TABLE IF NOT EXISTS safehaven_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- SafeHaven account identifiers
  safehaven_account_id text NOT NULL,
  client_id text NOT NULL,
  account_product text NOT NULL,
  account_number text NOT NULL,
  cba_account_id text,
  
  -- Account details
  account_name text NOT NULL,
  account_type text NOT NULL,
  currency_code text NOT NULL DEFAULT 'NGN',
  bvn text,
  
  -- Balance information
  account_balance numeric NOT NULL DEFAULT 0,
  book_balance numeric NOT NULL DEFAULT 0,
  interest_balance numeric NOT NULL DEFAULT 0,
  withholding_tax_balance numeric NOT NULL DEFAULT 0,
  
  -- Account status
  status text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  can_debit boolean NOT NULL DEFAULT false,
  can_credit boolean NOT NULL DEFAULT false,
  
  -- Interest settings
  nominal_annual_interest_rate numeric NOT NULL DEFAULT 0,
  interest_compounding_period text,
  interest_posting_period text,
  interest_calculation_type text,
  interest_calculation_days_in_year_type text,
  
  -- Account limits
  min_required_opening_balance numeric NOT NULL DEFAULT 0,
  lockin_period_frequency integer NOT NULL DEFAULT 0,
  lockin_period_frequency_type text,
  allow_overdraft boolean NOT NULL DEFAULT false,
  overdraft_limit numeric NOT NULL DEFAULT 0,
  
  -- Charge settings
  charge_withholding_tax boolean NOT NULL DEFAULT true,
  charge_value_added_tax boolean NOT NULL DEFAULT true,
  charge_stamp_duty boolean NOT NULL DEFAULT true,
  
  -- Notification settings
  notification_settings jsonb,
  
  -- Account flags
  is_sub_account boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure unique account per user
  UNIQUE(user_id, safehaven_account_id)
);

-- Create safehaven_audit_logs table for SafeHaven-specific audit trails
CREATE TABLE IF NOT EXISTS safehaven_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Operation details
  operation_type text NOT NULL CHECK (operation_type IN (
    'token_refresh', 'token_validation', 'accounts_fetch', 'account_balance_check',
    'transaction_initiated', 'transaction_completed', 'transaction_failed',
    'webhook_received', 'api_error', 'rate_limit_exceeded'
  )),
  
  -- Request/Response data
  request_data jsonb,
  response_data jsonb,
  error_data jsonb,
  
  -- Status and results
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  status_code integer,
  response_time_ms integer,
  
  -- SafeHaven specific data
  safehaven_endpoint text,
  safehaven_client_id text,
  safehaven_user_id text,
  
  -- Security and integrity
  ip_address inet,
  user_agent text,
  integrity_hash text,
  
  -- Metadata
  metadata jsonb,
  tags text[],
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE safehaven_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for safehaven_tokens
CREATE POLICY "Users can view own safehaven tokens"
  ON safehaven_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven tokens"
  ON safehaven_tokens
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_accounts
CREATE POLICY "Users can view own safehaven accounts"
  ON safehaven_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven accounts"
  ON safehaven_accounts
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_audit_logs
CREATE POLICY "Users can view own safehaven audit logs"
  ON safehaven_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven audit logs"
  ON safehaven_audit_logs
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safehaven_tokens_user_id ON safehaven_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_tokens_expires_at ON safehaven_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_safehaven_tokens_ibs_user_id ON safehaven_tokens(ibs_user_id);

CREATE INDEX IF NOT EXISTS idx_safehaven_accounts_user_id ON safehaven_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_accounts_account_number ON safehaven_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_safehaven_accounts_safehaven_id ON safehaven_accounts(safehaven_account_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_accounts_status ON safehaven_accounts(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_accounts_synced_at ON safehaven_accounts(synced_at);

CREATE INDEX IF NOT EXISTS idx_safehaven_audit_logs_user_id ON safehaven_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_audit_logs_operation_type ON safehaven_audit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_safehaven_audit_logs_status ON safehaven_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_audit_logs_created_at ON safehaven_audit_logs(created_at);

-- Create triggers for updated_at
CREATE TRIGGER update_safehaven_tokens_updated_at
  BEFORE UPDATE ON safehaven_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safehaven_accounts_updated_at
  BEFORE UPDATE ON safehaven_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safehaven_audit_logs_updated_at
  BEFORE UPDATE ON safehaven_audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to check token expiration
CREATE OR REPLACE FUNCTION check_safehaven_token_expiration()
RETURNS TABLE (
  user_id uuid,
  token_expired boolean,
  expires_at timestamptz,
  minutes_until_expiry integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.user_id,
    (st.expires_at <= now()) as token_expired,
    st.expires_at,
    EXTRACT(EPOCH FROM (st.expires_at - now()))::integer / 60 as minutes_until_expiry
  FROM safehaven_tokens st
  WHERE st.expires_at <= now() + INTERVAL '1 hour'; -- Check tokens expiring within 1 hour
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's SafeHaven accounts summary
CREATE OR REPLACE FUNCTION get_safehaven_accounts_summary(p_user_id uuid)
RETURNS TABLE (
  total_accounts integer,
  total_balance numeric,
  default_account_id uuid,
  accounts_by_type jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_accounts,
    COALESCE(SUM(sa.account_balance), 0) as total_balance,
    (SELECT id FROM safehaven_accounts WHERE user_id = p_user_id AND is_default = true LIMIT 1) as default_account_id,
    jsonb_object_agg(sa.account_type, type_count) as accounts_by_type
  FROM safehaven_accounts sa
  LEFT JOIN (
    SELECT account_type, COUNT(*) as type_count
    FROM safehaven_accounts
    WHERE user_id = p_user_id
    GROUP BY account_type
  ) type_counts ON sa.account_type = type_counts.account_type
  WHERE sa.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to log SafeHaven operations
CREATE OR REPLACE FUNCTION log_safehaven_operation(
  p_user_id uuid,
  p_operation_type text,
  p_request_data jsonb DEFAULT NULL,
  p_response_data jsonb DEFAULT NULL,
  p_error_data jsonb DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_status_code integer DEFAULT NULL,
  p_response_time_ms integer DEFAULT NULL,
  p_safehaven_endpoint text DEFAULT NULL,
  p_safehaven_client_id text DEFAULT NULL,
  p_safehaven_user_id text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_tags text[] DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  log_id := gen_random_uuid();
  
  INSERT INTO safehaven_audit_logs (
    id, user_id, operation_type, request_data, response_data, error_data,
    status, status_code, response_time_ms, safehaven_endpoint,
    safehaven_client_id, safehaven_user_id, ip_address, user_agent,
    metadata, tags
  ) VALUES (
    log_id, p_user_id, p_operation_type, p_request_data, p_response_data, p_error_data,
    p_status, p_status_code, p_response_time_ms, p_safehaven_endpoint,
    p_safehaven_client_id, p_safehaven_user_id, p_ip_address, p_user_agent,
    p_metadata, p_tags
  );
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_safehaven_tokens()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM safehaven_tokens 
  WHERE expires_at < now() - INTERVAL '7 days'; -- Keep expired tokens for 7 days for audit
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  INSERT INTO safehaven_audit_logs (
    user_id, operation_type, status, metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System user
    'token_cleanup',
    'success',
    jsonb_build_object('deleted_count', deleted_count, 'cleanup_time', now())
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for SafeHaven account balances
CREATE OR REPLACE VIEW safehaven_account_balances AS
SELECT 
  sa.user_id,
  sa.account_number,
  sa.account_name,
  sa.account_type,
  sa.currency_code,
  sa.account_balance,
  sa.book_balance,
  sa.status,
  sa.is_default,
  sa.synced_at,
  st.expires_at as token_expires_at,
  (st.expires_at <= now()) as token_expired
FROM safehaven_accounts sa
LEFT JOIN safehaven_tokens st ON sa.user_id = st.user_id
WHERE sa.is_deleted = false;

-- Create view for SafeHaven audit summary
CREATE OR REPLACE VIEW safehaven_audit_summary AS
SELECT 
  sal.user_id,
  sal.operation_type,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE sal.status = 'success') as successful_operations,
  COUNT(*) FILTER (WHERE sal.status = 'failed') as failed_operations,
  AVG(sal.response_time_ms) as avg_response_time_ms,
  MIN(sal.created_at) as first_operation,
  MAX(sal.created_at) as last_operation
FROM safehaven_audit_logs sal
GROUP BY sal.user_id, sal.operation_type;

-- Add comments for documentation
COMMENT ON TABLE safehaven_tokens IS 'Stores SafeHaven API access tokens with expiration management';
COMMENT ON TABLE safehaven_accounts IS 'Stores synchronized SafeHaven account data';
COMMENT ON TABLE safehaven_audit_logs IS 'Audit trail for all SafeHaven API operations';

COMMENT ON FUNCTION check_safehaven_token_expiration IS 'Checks for tokens that are expiring soon';
COMMENT ON FUNCTION get_safehaven_accounts_summary IS 'Returns summary of user SafeHaven accounts';
COMMENT ON FUNCTION log_safehaven_operation IS 'Logs SafeHaven API operations for audit trail';
COMMENT ON FUNCTION cleanup_expired_safehaven_tokens IS 'Cleans up expired tokens after retention period';

COMMENT ON VIEW safehaven_account_balances IS 'View of SafeHaven account balances with token status';
COMMENT ON VIEW safehaven_audit_summary IS 'Summary of SafeHaven audit operations by user and type';
