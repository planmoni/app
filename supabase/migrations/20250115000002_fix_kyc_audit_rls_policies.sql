/*
  # Fix KYC Audit RLS Policies
  
  This migration adds missing RLS policies to allow authenticated users
  to insert their own audit logs, which is needed for the KYC audit trail system.
*/

-- Allow authenticated users to insert their own audit logs
CREATE POLICY "Users can insert own kyc audit logs"
  ON kyc_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert their own audit events
CREATE POLICY "Users can insert own kyc audit events"
  ON kyc_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert their own audit attachments
CREATE POLICY "Users can insert own kyc audit attachments"
  ON kyc_audit_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kyc_audit_logs 
      WHERE kyc_audit_logs.id = kyc_audit_attachments.audit_log_id 
      AND kyc_audit_logs.user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert their own audit summary
CREATE POLICY "Users can insert own kyc audit summary"
  ON kyc_audit_summary
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own audit logs (for status updates)
CREATE POLICY "Users can update own kyc audit logs"
  ON kyc_audit_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own audit events
CREATE POLICY "Users can update own kyc audit events"
  ON kyc_audit_events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own audit summary
CREATE POLICY "Users can update own kyc audit summary"
  ON kyc_audit_summary
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
