-- Fix RLS policies for safehaven_tokens and safehaven_audit_logs
-- Add INSERT and UPDATE policies for authenticated users

-- Add INSERT policy for safehaven_tokens
CREATE POLICY "Users can insert own safehaven tokens"
  ON safehaven_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for safehaven_tokens
CREATE POLICY "Users can update own safehaven tokens"
  ON safehaven_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add INSERT policy for safehaven_audit_logs
CREATE POLICY "Users can insert own safehaven audit logs"
  ON safehaven_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for safehaven_audit_logs
CREATE POLICY "Users can update own safehaven audit logs"
  ON safehaven_audit_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

