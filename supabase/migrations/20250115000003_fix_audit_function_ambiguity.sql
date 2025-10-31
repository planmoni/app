/*
  # Fix KYC Audit Function Ambiguity
  
  This migration fixes the ambiguous column reference in the create_kyc_audit_log function.
*/

-- Drop and recreate the function with fixed ambiguity
DROP FUNCTION IF EXISTS create_kyc_audit_log(
  uuid, text, text, text, jsonb, jsonb, jsonb, text, text, text, numeric, inet, text, text, jsonb, text, integer, numeric, jsonb, jsonb, numeric, jsonb, text[]
);

-- Recreate the function with fixed ambiguity
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
  calculated_integrity_hash text;
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
  calculated_integrity_hash := generate_audit_integrity_hash(
    p_user_id, p_operation_type, p_request_data, p_response_data, now()
  );
  
  UPDATE kyc_audit_logs 
  SET integrity_hash = calculated_integrity_hash
  WHERE id = audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;
