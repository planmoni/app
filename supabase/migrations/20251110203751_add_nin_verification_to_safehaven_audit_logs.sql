-- Add missing operation types to allowed operation types in safehaven_audit_logs
-- This fixes the constraint violation when logging NIN verification, token initialization, and account creation operations

-- Drop the existing check constraint
ALTER TABLE safehaven_audit_logs
DROP CONSTRAINT IF EXISTS safehaven_audit_logs_operation_type_check;

-- Add the new check constraint with additional operation types
ALTER TABLE safehaven_audit_logs
ADD CONSTRAINT safehaven_audit_logs_operation_type_check
CHECK (operation_type IN (
  'token_refresh', 
  'token_validation', 
  'token_initialize',
  'accounts_fetch', 
  'account_balance_check',
  'transaction_initiated', 
  'transaction_completed', 
  'transaction_failed',
  'webhook_received', 
  'api_error', 
  'rate_limit_exceeded',
  'nin_verification',
  'account_creation'
));

