/*
  # SafeHaven Extended Tables
  
  This migration creates additional tables for SafeHaven API operations including:
  - Transfers and virtual account transfers
  - Transaction history
  - Webhook processing
  - Comprehensive audit trails
*/

-- Create safehaven_transfers table for storing transfer data
CREATE TABLE IF NOT EXISTS safehaven_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- SafeHaven transfer identifiers
  safehaven_transfer_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  account_id text NOT NULL,
  
  -- Transfer details
  type text NOT NULL CHECK (type IN ('Inwards', 'Outwards')),
  session_id text NOT NULL,
  name_enquiry_reference text,
  payment_reference text NOT NULL,
  is_reversed boolean NOT NULL DEFAULT false,
  
  -- Provider information
  provider text NOT NULL,
  provider_channel text NOT NULL,
  destination_institution_code text,
  
  -- Account information
  credit_account_name text NOT NULL,
  credit_account_number text NOT NULL,
  debit_account_name text NOT NULL,
  debit_account_number text NOT NULL,
  
  -- Transaction details
  narration text NOT NULL,
  amount numeric NOT NULL,
  fees numeric NOT NULL DEFAULT 0,
  response_code text NOT NULL,
  response_message text NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Completed', 'Failed', 'Reversed')),
  transaction_location text,
  
  -- Timestamps
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  webhook_received_at timestamptz,
  
  -- Metadata
  metadata jsonb,
  
  -- Ensure unique transfer per SafeHaven ID
  UNIQUE(safehaven_transfer_id)
);

-- Create safehaven_virtual_account_transfers table
CREATE TABLE IF NOT EXISTS safehaven_virtual_account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- SafeHaven transfer identifiers
  safehaven_transfer_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  virtual_account_id text NOT NULL,
  
  -- Transfer details
  session_id text NOT NULL,
  name_enquiry_reference text,
  payment_reference text NOT NULL,
  is_reversed boolean NOT NULL DEFAULT false,
  
  -- Provider information
  provider text NOT NULL,
  provider_channel text NOT NULL,
  provider_channel_code text,
  destination_institution_code text,
  
  -- Account information
  credit_account_name text NOT NULL,
  credit_account_number text NOT NULL,
  debit_account_name text NOT NULL,
  debit_account_number text NOT NULL,
  
  -- Transaction details
  transaction_location text,
  amount numeric NOT NULL,
  fees numeric NOT NULL DEFAULT 0,
  response_code text NOT NULL,
  response_message text NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Completed', 'Failed', 'Reversed')),
  
  -- Timestamps
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  webhook_received_at timestamptz,
  
  -- Metadata
  metadata jsonb,
  
  -- Ensure unique transfer per SafeHaven ID
  UNIQUE(safehaven_transfer_id)
);

-- Create safehaven_transactions table for transaction history
CREATE TABLE IF NOT EXISTS safehaven_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- SafeHaven transaction identifiers
  safehaven_transaction_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  account_id text NOT NULL,
  
  -- Transaction details
  type text NOT NULL,
  amount numeric NOT NULL,
  balance numeric NOT NULL,
  narration text NOT NULL,
  reference text NOT NULL,
  status text NOT NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  webhook_updated_at timestamptz,
  
  -- Metadata
  metadata jsonb,
  
  -- Ensure unique transaction per SafeHaven ID
  UNIQUE(safehaven_transaction_id)
);

-- Create safehaven_virtual_accounts table for virtual account management
CREATE TABLE IF NOT EXISTS safehaven_virtual_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- SafeHaven virtual account identifiers
  safehaven_virtual_account_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  
  -- Virtual account details
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  balance numeric NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now() NOT NULL,
  
  -- Metadata
  metadata jsonb,
  
  -- Ensure unique virtual account per SafeHaven ID
  UNIQUE(safehaven_virtual_account_id)
);

-- Create safehaven_subaccounts table for subaccount management
CREATE TABLE IF NOT EXISTS safehaven_subaccounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- SafeHaven subaccount identifiers
  safehaven_subaccount_id text NOT NULL UNIQUE,
  client_id text NOT NULL,
  session_id text, -- For OTP verification process
  
  -- Subaccount details
  account_name text NOT NULL,
  account_number text,
  account_type text NOT NULL,
  currency_code text NOT NULL DEFAULT 'NGN',
  description text,
  phone_number text,
  email text,
  status text NOT NULL CHECK (status IN ('Pending', 'Active', 'Inactive', 'Suspended', 'Failed')),
  
  -- OTP verification
  otp_required boolean NOT NULL DEFAULT false,
  otp_verified boolean NOT NULL DEFAULT false,
  otp_verified_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  max_otp_attempts integer NOT NULL DEFAULT 3,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  synced_at timestamptz DEFAULT now() NOT NULL,
  
  -- Metadata
  metadata jsonb,
  
  -- Ensure unique subaccount per SafeHaven ID
  UNIQUE(safehaven_subaccount_id)
);

-- Create safehaven_webhooks table for webhook processing
CREATE TABLE IF NOT EXISTS safehaven_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Webhook details
  webhook_type text NOT NULL CHECK (webhook_type IN ('transfer', 'virtualAccount.transfer', 'account.update', 'transaction.update')),
  webhook_data jsonb NOT NULL,
  signature text,
  
  -- Processing status
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  
  -- Timestamps
  received_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  
  -- Metadata
  metadata jsonb
);

-- Enable RLS on all tables
ALTER TABLE safehaven_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_virtual_account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safehaven_webhooks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for safehaven_transfers
CREATE POLICY "Users can view own safehaven transfers"
  ON safehaven_transfers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven transfers"
  ON safehaven_transfers
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_virtual_account_transfers
CREATE POLICY "Users can view own safehaven virtual account transfers"
  ON safehaven_virtual_account_transfers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven virtual account transfers"
  ON safehaven_virtual_account_transfers
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_transactions
CREATE POLICY "Users can view own safehaven transactions"
  ON safehaven_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven transactions"
  ON safehaven_transactions
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_virtual_accounts
CREATE POLICY "Users can view own safehaven virtual accounts"
  ON safehaven_virtual_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven virtual accounts"
  ON safehaven_virtual_accounts
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_subaccounts
CREATE POLICY "Users can view own safehaven subaccounts"
  ON safehaven_subaccounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own safehaven subaccounts"
  ON safehaven_subaccounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own safehaven subaccounts"
  ON safehaven_subaccounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage safehaven subaccounts"
  ON safehaven_subaccounts
  FOR ALL
  TO service_role
  USING (true);

-- Create RLS policies for safehaven_webhooks
CREATE POLICY "Service role can manage safehaven webhooks"
  ON safehaven_webhooks
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safehaven_transfers_user_id ON safehaven_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_transfers_safehaven_id ON safehaven_transfers(safehaven_transfer_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_transfers_status ON safehaven_transfers(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_transfers_created_at ON safehaven_transfers(created_at);

CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_user_id ON safehaven_subaccounts(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_safehaven_id ON safehaven_subaccounts(safehaven_subaccount_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_status ON safehaven_subaccounts(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_session_id ON safehaven_subaccounts(session_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_subaccounts_created_at ON safehaven_subaccounts(created_at);
CREATE INDEX IF NOT EXISTS idx_safehaven_transfers_type ON safehaven_transfers(type);

CREATE INDEX IF NOT EXISTS idx_safehaven_va_transfers_user_id ON safehaven_virtual_account_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_va_transfers_safehaven_id ON safehaven_virtual_account_transfers(safehaven_transfer_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_va_transfers_virtual_account_id ON safehaven_virtual_account_transfers(virtual_account_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_va_transfers_status ON safehaven_virtual_account_transfers(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_va_transfers_created_at ON safehaven_virtual_account_transfers(created_at);

CREATE INDEX IF NOT EXISTS idx_safehaven_transactions_user_id ON safehaven_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_transactions_safehaven_id ON safehaven_transactions(safehaven_transaction_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_transactions_account_id ON safehaven_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_transactions_status ON safehaven_transactions(status);
CREATE INDEX IF NOT EXISTS idx_safehaven_transactions_created_at ON safehaven_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_safehaven_virtual_accounts_user_id ON safehaven_virtual_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_virtual_accounts_safehaven_id ON safehaven_virtual_accounts(safehaven_virtual_account_id);
CREATE INDEX IF NOT EXISTS idx_safehaven_virtual_accounts_account_number ON safehaven_virtual_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_safehaven_virtual_accounts_status ON safehaven_virtual_accounts(status);

CREATE INDEX IF NOT EXISTS idx_safehaven_webhooks_type ON safehaven_webhooks(webhook_type);
CREATE INDEX IF NOT EXISTS idx_safehaven_webhooks_processed ON safehaven_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_safehaven_webhooks_received_at ON safehaven_webhooks(received_at);

-- Create triggers for updated_at
CREATE TRIGGER update_safehaven_transfers_updated_at
  BEFORE UPDATE ON safehaven_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safehaven_virtual_account_transfers_updated_at
  BEFORE UPDATE ON safehaven_virtual_account_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safehaven_transactions_updated_at
  BEFORE UPDATE ON safehaven_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safehaven_virtual_accounts_updated_at
  BEFORE UPDATE ON safehaven_virtual_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get user's transfer summary
CREATE OR REPLACE FUNCTION get_safehaven_transfer_summary(p_user_id uuid, p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE (
  total_transfers integer,
  total_amount numeric,
  successful_transfers integer,
  failed_transfers integer,
  pending_transfers integer,
  inwards_transfers integer,
  outwards_transfers integer,
  total_fees numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_transfers,
    COALESCE(SUM(st.amount), 0) as total_amount,
    COUNT(*) FILTER (WHERE st.status = 'Completed')::integer as successful_transfers,
    COUNT(*) FILTER (WHERE st.status = 'Failed')::integer as failed_transfers,
    COUNT(*) FILTER (WHERE st.status = 'Pending')::integer as pending_transfers,
    COUNT(*) FILTER (WHERE st.type = 'Inwards')::integer as inwards_transfers,
    COUNT(*) FILTER (WHERE st.type = 'Outwards')::integer as outwards_transfers,
    COALESCE(SUM(st.fees), 0) as total_fees
  FROM safehaven_transfers st
  WHERE st.user_id = p_user_id
    AND (p_start_date IS NULL OR st.created_at >= p_start_date)
    AND (p_end_date IS NULL OR st.created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Create function to get virtual account transfer summary
CREATE OR REPLACE FUNCTION get_safehaven_virtual_account_transfer_summary(p_user_id uuid, p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE (
  total_transfers integer,
  total_amount numeric,
  successful_transfers integer,
  failed_transfers integer,
  pending_transfers integer,
  total_fees numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_transfers,
    COALESCE(SUM(svat.amount), 0) as total_amount,
    COUNT(*) FILTER (WHERE svat.status = 'Completed')::integer as successful_transfers,
    COUNT(*) FILTER (WHERE svat.status = 'Failed')::integer as failed_transfers,
    COUNT(*) FILTER (WHERE svat.status = 'Pending')::integer as pending_transfers,
    COALESCE(SUM(svat.fees), 0) as total_fees
  FROM safehaven_virtual_account_transfers svat
  WHERE svat.user_id = p_user_id
    AND (p_start_date IS NULL OR svat.created_at >= p_start_date)
    AND (p_end_date IS NULL OR svat.created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Create function to process webhook
CREATE OR REPLACE FUNCTION process_safehaven_webhook(
  p_webhook_type text,
  p_webhook_data jsonb,
  p_signature text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  webhook_id uuid;
BEGIN
  webhook_id := gen_random_uuid();
  
  INSERT INTO safehaven_webhooks (
    id, webhook_type, webhook_data, signature
  ) VALUES (
    webhook_id, p_webhook_type, p_webhook_data, p_signature
  );
  
  RETURN webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to retry failed webhooks
CREATE OR REPLACE FUNCTION retry_failed_safehaven_webhooks()
RETURNS integer AS $$
DECLARE
  retry_count integer;
BEGIN
  UPDATE safehaven_webhooks 
  SET 
    retry_count = retry_count + 1,
    processed = false,
    processing_error = NULL
  WHERE 
    processed = false 
    AND retry_count < max_retries
    AND received_at < NOW() - INTERVAL '5 minutes'; -- Wait 5 minutes before retry
  
  GET DIAGNOSTICS retry_count = ROW_COUNT;
  
  RETURN retry_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for transfer analytics
CREATE OR REPLACE VIEW safehaven_transfer_analytics AS
SELECT 
  st.user_id,
  st.type,
  st.status,
  COUNT(*) as transfer_count,
  SUM(st.amount) as total_amount,
  AVG(st.amount) as average_amount,
  SUM(st.fees) as total_fees,
  MIN(st.created_at) as first_transfer,
  MAX(st.created_at) as last_transfer
FROM safehaven_transfers st
GROUP BY st.user_id, st.type, st.status;

-- Create view for virtual account analytics
CREATE OR REPLACE VIEW safehaven_virtual_account_analytics AS
SELECT 
  svat.user_id,
  svat.virtual_account_id,
  COUNT(*) as transfer_count,
  SUM(svat.amount) as total_amount,
  AVG(svat.amount) as average_amount,
  SUM(svat.fees) as total_fees,
  MIN(svat.created_at) as first_transfer,
  MAX(svat.created_at) as last_transfer
FROM safehaven_virtual_account_transfers svat
GROUP BY svat.user_id, svat.virtual_account_id;

-- Add comments for documentation
COMMENT ON TABLE safehaven_transfers IS 'Stores SafeHaven transfer data with webhook processing';
COMMENT ON TABLE safehaven_virtual_account_transfers IS 'Stores SafeHaven virtual account transfer data';
COMMENT ON TABLE safehaven_transactions IS 'Stores SafeHaven transaction history';
COMMENT ON TABLE safehaven_virtual_accounts IS 'Stores SafeHaven virtual account information';
COMMENT ON TABLE safehaven_webhooks IS 'Stores and processes SafeHaven webhook data';

COMMENT ON FUNCTION get_safehaven_transfer_summary IS 'Returns summary of user SafeHaven transfers';
COMMENT ON FUNCTION get_safehaven_virtual_account_transfer_summary IS 'Returns summary of user virtual account transfers';
COMMENT ON FUNCTION process_safehaven_webhook IS 'Processes incoming SafeHaven webhooks';
COMMENT ON FUNCTION retry_failed_safehaven_webhooks IS 'Retries failed webhook processing';

COMMENT ON VIEW safehaven_transfer_analytics IS 'Analytics view for SafeHaven transfers';
COMMENT ON VIEW safehaven_virtual_account_analytics IS 'Analytics view for virtual account transfers';
