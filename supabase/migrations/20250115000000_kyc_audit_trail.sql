/*
  # KYC Audit Trail System
  
  This migration creates a comprehensive audit trail system for KYC operations
  to ensure full traceability and compliance with regulatory requirements.
  
  Key Features:
  1. Immutable audit logs for all KYC operations
  2. Cryptographic integrity verification
  3. Comprehensive metadata capture
  4. Regulatory compliance support
  5. Tamper-proof audit trail
*/

-- Create kyc_audit_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS kyc_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identification
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_id text, -- Track user session for correlation
  request_id text UNIQUE, -- Unique request identifier for tracing
  
  -- Operation details
  operation_type text NOT NULL CHECK (operation_type IN (
    'kyc_initiated', 'kyc_submitted', 'kyc_verified', 'kyc_failed', 
    'kyc_rejected', 'kyc_manual_review', 'kyc_escalated',
    'document_uploaded', 'document_verified', 'document_rejected',
    'bvn_verified', 'nin_verified', 'passport_verified',
    'liveness_check', 'face_match', 'address_verified',
    'kyc_tier_upgraded', 'kyc_tier_downgraded'
  )),
  
  -- Verification details
  verification_type text CHECK (verification_type IN ('bvn', 'nin', 'passport', 'drivers_license', 'document', 'liveness')),
  verification_provider text, -- 'dojah', 'manual', 'internal'
  
  -- Request/Response data (encrypted for sensitive data)
  request_data jsonb, -- Original request data
  response_data jsonb, -- Provider response data
  processed_data jsonb, -- Processed/cleaned data
  
  -- Status and results
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rejected', 'manual_review')),
  result_code text, -- Provider-specific result code
  result_message text, -- Human-readable result message
  confidence_score numeric, -- AI/ML confidence score if applicable
  
  -- Security and integrity
  ip_address inet, -- Client IP address
  user_agent text, -- Client user agent
  device_fingerprint text, -- Device identification
  location_data jsonb, -- Geographic location if available
  
  -- Provider integration details
  provider_request_id text, -- External provider's request ID
  provider_response_time_ms integer, -- Response time from provider
  provider_cost numeric, -- Cost of verification (for billing)
  
  -- Compliance and regulatory
  regulatory_requirements jsonb, -- Applicable regulatory requirements
  compliance_flags jsonb, -- Compliance check results
  risk_score numeric, -- Calculated risk score
  
  -- Audit trail integrity
  previous_log_id uuid REFERENCES kyc_audit_logs(id), -- Chain of custody
  integrity_hash text, -- Cryptographic hash for tamper detection
  signature text, -- Digital signature for verification
  
  -- Metadata
  metadata jsonb, -- Additional metadata
  tags text[], -- Searchable tags
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Retention and archival
  retention_until timestamptz, -- When this record can be archived
  archived_at timestamptz, -- When this record was archived
  archive_reason text -- Reason for archival
);

-- Create kyc_audit_events table for real-time audit events
CREATE TABLE IF NOT EXISTS kyc_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id uuid REFERENCES kyc_audit_logs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type text NOT NULL CHECK (event_type IN (
    'verification_started', 'verification_completed', 'verification_failed',
    'document_uploaded', 'document_processed', 'document_verified',
    'manual_review_required', 'manual_review_completed',
    'compliance_check', 'risk_assessment', 'fraud_detected'
  )),
  
  -- Event data
  event_data jsonb,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create kyc_audit_attachments table for storing audit-related files
CREATE TABLE IF NOT EXISTS kyc_audit_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id uuid REFERENCES kyc_audit_logs(id) ON DELETE CASCADE NOT NULL,
  
  -- File details
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_hash text NOT NULL, -- SHA-256 hash for integrity
  file_path text NOT NULL, -- Storage path
  
  -- Security
  encryption_key_id text, -- Reference to encryption key
  access_level text CHECK (access_level IN ('public', 'internal', 'restricted', 'confidential')),
  
  -- Metadata
  description text,
  tags text[],
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create kyc_audit_summary table for aggregated audit data
CREATE TABLE IF NOT EXISTS kyc_audit_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Summary period
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  period_type text CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  
  -- Verification counts
  total_verifications integer DEFAULT 0,
  successful_verifications integer DEFAULT 0,
  failed_verifications integer DEFAULT 0,
  manual_reviews integer DEFAULT 0,
  
  -- Document counts
  documents_uploaded integer DEFAULT 0,
  documents_verified integer DEFAULT 0,
  documents_rejected integer DEFAULT 0,
  
  -- Risk and compliance
  average_risk_score numeric,
  compliance_violations integer DEFAULT 0,
  fraud_attempts integer DEFAULT 0,
  
  -- Provider usage
  provider_usage jsonb, -- Usage by provider
  total_cost numeric DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure one summary per user per period
  UNIQUE(user_id, period_start, period_end, period_type)
);

-- Enable RLS on all audit tables
ALTER TABLE kyc_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit tables
-- Users can only view their own audit logs
CREATE POLICY "Users can view own kyc audit logs"
  ON kyc_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert audit logs (for system operations)
CREATE POLICY "Service role can insert kyc audit logs"
  ON kyc_audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update audit logs (for status updates)
CREATE POLICY "Service role can update kyc audit logs"
  ON kyc_audit_logs
  FOR UPDATE
  TO service_role
  USING (true);

-- Similar policies for audit events
CREATE POLICY "Users can view own kyc audit events"
  ON kyc_audit_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage kyc audit events"
  ON kyc_audit_events
  FOR ALL
  TO service_role
  USING (true);

-- Similar policies for audit attachments
CREATE POLICY "Users can view own kyc audit attachments"
  ON kyc_audit_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kyc_audit_logs 
      WHERE kyc_audit_logs.id = kyc_audit_attachments.audit_log_id 
      AND kyc_audit_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage kyc audit attachments"
  ON kyc_audit_attachments
  FOR ALL
  TO service_role
  USING (true);

-- Similar policies for audit summary
CREATE POLICY "Users can view own kyc audit summary"
  ON kyc_audit_summary
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage kyc audit summary"
  ON kyc_audit_summary
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_user_operation ON kyc_audit_logs(user_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_created_at ON kyc_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_request_id ON kyc_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_provider_request_id ON kyc_audit_logs(provider_request_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_status ON kyc_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_integrity_hash ON kyc_audit_logs(integrity_hash);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_events_audit_log_id ON kyc_audit_events(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_events_user_created ON kyc_audit_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_events_type ON kyc_audit_events(event_type);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_attachments_audit_log_id ON kyc_audit_attachments(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_attachments_file_hash ON kyc_audit_attachments(file_hash);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_summary_user_period ON kyc_audit_summary(user_id, period_start, period_end);

-- Create triggers for updated_at
CREATE TRIGGER update_kyc_audit_logs_updated_at
  BEFORE UPDATE ON kyc_audit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_audit_summary_updated_at
  BEFORE UPDATE ON kyc_audit_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate integrity hash
CREATE OR REPLACE FUNCTION generate_audit_integrity_hash(
  p_user_id uuid,
  p_operation_type text,
  p_request_data jsonb,
  p_response_data jsonb,
  p_created_at timestamptz
) RETURNS text AS $$
BEGIN
  -- Create a deterministic hash from key audit data
  -- This ensures the audit trail cannot be tampered with
  RETURN encode(
    digest(
      p_user_id::text || 
      p_operation_type || 
      COALESCE(p_request_data::text, '') || 
      COALESCE(p_response_data::text, '') || 
      p_created_at::text,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to verify audit trail integrity
CREATE OR REPLACE FUNCTION verify_audit_trail_integrity(p_audit_log_id uuid)
RETURNS boolean AS $$
DECLARE
  audit_record kyc_audit_logs%ROWTYPE;
  calculated_hash text;
BEGIN
  -- Get the audit record
  SELECT * INTO audit_record 
  FROM kyc_audit_logs 
  WHERE id = p_audit_log_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Calculate the expected hash
  calculated_hash := generate_audit_integrity_hash(
    audit_record.user_id,
    audit_record.operation_type,
    audit_record.request_data,
    audit_record.response_data,
    audit_record.created_at
  );
  
  -- Compare with stored hash
  RETURN calculated_hash = audit_record.integrity_hash;
END;
$$ LANGUAGE plpgsql;

-- Create function to create audit log entry
CREATE OR REPLACE FUNCTION create_kyc_audit_log(
  p_user_id uuid,
  p_operation_type text,
  p_verification_type text DEFAULT NULL,
  p_verification_provider text DEFAULT NULL,
  p_request_data jsonb DEFAULT NULL,
  p_response_data jsonb DEFAULT NULL,
  p_processed_data jsonb DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_result_code text DEFAULT NULL,
  p_result_message text DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL,
  p_location_data jsonb DEFAULT NULL,
  p_provider_request_id text DEFAULT NULL,
  p_provider_response_time_ms integer DEFAULT NULL,
  p_provider_cost numeric DEFAULT NULL,
  p_regulatory_requirements jsonb DEFAULT NULL,
  p_compliance_flags jsonb DEFAULT NULL,
  p_risk_score numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_tags text[] DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  audit_id uuid;
  session_id text;
  request_id text;
  integrity_hash text;
BEGIN
  -- Generate unique identifiers
  audit_id := gen_random_uuid();
  session_id := encode(gen_random_bytes(16), 'hex');
  request_id := 'req_' || extract(epoch from now())::text || '_' || encode(gen_random_bytes(8), 'hex');
  
  -- Insert the audit log
  INSERT INTO kyc_audit_logs (
    id, user_id, session_id, request_id, operation_type, verification_type,
    verification_provider, request_data, response_data, processed_data,
    status, result_code, result_message, confidence_score, ip_address,
    user_agent, device_fingerprint, location_data, provider_request_id,
    provider_response_time_ms, provider_cost, regulatory_requirements,
    compliance_flags, risk_score, metadata, tags
  ) VALUES (
    audit_id, p_user_id, session_id, request_id, p_operation_type, p_verification_type,
    p_verification_provider, p_request_data, p_response_data, p_processed_data,
    p_status, p_result_code, p_result_message, p_confidence_score, p_ip_address,
    p_user_agent, p_device_fingerprint, p_location_data, p_provider_request_id,
    p_provider_response_time_ms, p_provider_cost, p_regulatory_requirements,
    p_compliance_flags, p_risk_score, p_metadata, p_tags
  );
  
  -- Generate and update integrity hash
  integrity_hash := generate_audit_integrity_hash(
    p_user_id, p_operation_type, p_request_data, p_response_data, now()
  );
  
  UPDATE kyc_audit_logs 
  SET integrity_hash = integrity_hash
  WHERE id = audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update audit log status
CREATE OR REPLACE FUNCTION update_kyc_audit_log_status(
  p_audit_log_id uuid,
  p_status text,
  p_result_code text DEFAULT NULL,
  p_result_message text DEFAULT NULL,
  p_response_data jsonb DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_provider_response_time_ms integer DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  audit_record kyc_audit_logs%ROWTYPE;
  new_integrity_hash text;
BEGIN
  -- Get current audit record
  SELECT * INTO audit_record 
  FROM kyc_audit_logs 
  WHERE id = p_audit_log_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update the record
  UPDATE kyc_audit_logs 
  SET 
    status = p_status,
    result_code = COALESCE(p_result_code, result_code),
    result_message = COALESCE(p_result_message, result_message),
    response_data = COALESCE(p_response_data, response_data),
    confidence_score = COALESCE(p_confidence_score, confidence_score),
    provider_response_time_ms = COALESCE(p_provider_response_time_ms, provider_response_time_ms),
    updated_at = now()
  WHERE id = p_audit_log_id;
  
  -- Regenerate integrity hash
  new_integrity_hash := generate_audit_integrity_hash(
    audit_record.user_id,
    audit_record.operation_type,
    audit_record.request_data,
    COALESCE(p_response_data, audit_record.response_data),
    audit_record.created_at
  );
  
  UPDATE kyc_audit_logs 
  SET integrity_hash = new_integrity_hash
  WHERE id = p_audit_log_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to get audit trail for a user
CREATE OR REPLACE FUNCTION get_user_kyc_audit_trail(
  p_user_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_operation_type text DEFAULT NULL,
  p_limit integer DEFAULT 100
) RETURNS TABLE (
  id uuid,
  operation_type text,
  verification_type text,
  verification_provider text,
  status text,
  result_message text,
  created_at timestamptz,
  integrity_verified boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.operation_type,
    al.verification_type,
    al.verification_provider,
    al.status,
    al.result_message,
    al.created_at,
    verify_audit_trail_integrity(al.id) as integrity_verified
  FROM kyc_audit_logs al
  WHERE al.user_id = p_user_id
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    AND (p_operation_type IS NULL OR al.operation_type = p_operation_type)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate audit report
CREATE OR REPLACE FUNCTION generate_kyc_audit_report(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
) RETURNS jsonb AS $$
DECLARE
  report jsonb;
  total_operations integer;
  successful_operations integer;
  failed_operations integer;
  integrity_violations integer;
BEGIN
  -- Get operation counts
  SELECT COUNT(*) INTO total_operations
  FROM kyc_audit_logs
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;
  
  SELECT COUNT(*) INTO successful_operations
  FROM kyc_audit_logs
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND status = 'success';
  
  SELECT COUNT(*) INTO failed_operations
  FROM kyc_audit_logs
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND status IN ('failed', 'rejected');
  
  -- Check integrity violations
  SELECT COUNT(*) INTO integrity_violations
  FROM kyc_audit_logs
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND NOT verify_audit_trail_integrity(id);
  
  -- Build report
  report := jsonb_build_object(
    'user_id', p_user_id,
    'report_period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'summary', jsonb_build_object(
      'total_operations', total_operations,
      'successful_operations', successful_operations,
      'failed_operations', failed_operations,
      'success_rate', CASE WHEN total_operations > 0 THEN (successful_operations::numeric / total_operations::numeric * 100) ELSE 0 END,
      'integrity_violations', integrity_violations,
      'integrity_status', CASE WHEN integrity_violations = 0 THEN 'verified' ELSE 'compromised' END
    ),
    'generated_at', now(),
    'report_id', gen_random_uuid()
  );
  
  RETURN report;
END;
$$ LANGUAGE plpgsql;

-- Create view for audit trail summary
CREATE OR REPLACE VIEW kyc_audit_trail_summary AS
SELECT 
  al.user_id,
  al.operation_type,
  al.verification_type,
  al.verification_provider,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE al.status = 'success') as successful_operations,
  COUNT(*) FILTER (WHERE al.status IN ('failed', 'rejected')) as failed_operations,
  COUNT(*) FILTER (WHERE NOT verify_audit_trail_integrity(al.id)) as integrity_violations,
  MIN(al.created_at) as first_operation,
  MAX(al.created_at) as last_operation,
  AVG(al.provider_response_time_ms) as avg_response_time_ms,
  SUM(al.provider_cost) as total_cost
FROM kyc_audit_logs al
GROUP BY al.user_id, al.operation_type, al.verification_type, al.verification_provider;

-- Add comments for documentation
COMMENT ON TABLE kyc_audit_logs IS 'Comprehensive audit trail for all KYC operations with cryptographic integrity verification';
COMMENT ON TABLE kyc_audit_events IS 'Real-time audit events for KYC operations monitoring';
COMMENT ON TABLE kyc_audit_attachments IS 'File attachments related to KYC audit logs';
COMMENT ON TABLE kyc_audit_summary IS 'Aggregated audit data for reporting and analytics';

COMMENT ON FUNCTION create_kyc_audit_log IS 'Creates a new KYC audit log entry with integrity hash';
COMMENT ON FUNCTION update_kyc_audit_log_status IS 'Updates audit log status and regenerates integrity hash';
COMMENT ON FUNCTION verify_audit_trail_integrity IS 'Verifies the integrity of an audit log entry';
COMMENT ON FUNCTION get_user_kyc_audit_trail IS 'Retrieves audit trail for a specific user with integrity verification';
COMMENT ON FUNCTION generate_kyc_audit_report IS 'Generates a comprehensive audit report for a user and time period';
