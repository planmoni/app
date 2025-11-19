-- Fix safehaven_audit_logs operation_type constraint to include missing operation types
-- This fixes the constraint violation error: "new row for relation \"safehaven_audit_logs\" violates check constraint \"safehaven_audit_logs_operation_type_check\""
--
-- Note: If the table already has data, this migration will:
-- 1. Check for any existing operation types that aren't in the new constraint
-- 2. Drop the old constraint
-- 3. Add the new constraint with all required operation types
-- If there are existing rows with invalid operation types, the constraint addition will fail
-- and you'll need to update those rows first.

-- First, check if there are any operation types in the database that aren't in our list
-- This is just for informational purposes - the constraint will enforce it
DO $$
DECLARE
  invalid_types text[];
BEGIN
  SELECT array_agg(DISTINCT operation_type)
  INTO invalid_types
  FROM safehaven_audit_logs
  WHERE operation_type NOT IN (
    'token_refresh', 'token_validation', 'token_initialize', 'token_cleanup',
    'accounts_fetch', 'account_balance_check',
    'transaction_initiated', 'transaction_completed', 'transaction_failed',
    'api_request', 'api_error', 'rate_limit_exceeded',
    'webhook_received', 'anomaly_detected'
  );
  
  IF invalid_types IS NOT NULL AND array_length(invalid_types, 1) > 0 THEN
    RAISE WARNING 'Found operation types in database that are not in the constraint: %', array_to_string(invalid_types, ', ');
    RAISE WARNING 'These will need to be updated before the constraint can be added.';
  END IF;
END $$;

-- Drop the existing constraint
ALTER TABLE safehaven_audit_logs 
DROP CONSTRAINT IF EXISTS safehaven_audit_logs_operation_type_check;

-- Add the constraint with all required operation types
-- This will fail if there are existing rows with invalid operation types
ALTER TABLE safehaven_audit_logs
ADD CONSTRAINT safehaven_audit_logs_operation_type_check 
CHECK (operation_type IN (
  -- Token operations
  'token_refresh', 
  'token_validation', 
  'token_initialize',
  'token_cleanup',
  -- Account operations
  'accounts_fetch', 
  'account_balance_check',
  -- Transaction operations
  'transaction_initiated', 
  'transaction_completed', 
  'transaction_failed',
  -- API operations
  'api_request',
  'api_error', 
  'rate_limit_exceeded',
  -- Webhook operations
  'webhook_received',
  -- Monitoring operations
  'anomaly_detected'
));

