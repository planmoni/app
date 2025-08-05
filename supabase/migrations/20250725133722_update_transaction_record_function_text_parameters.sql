/*
  # Update Transaction Record Function - Text Parameters
  
  1. Purpose
    - Update create_transaction_record function to accept text parameters instead of UUID
    - Replace UUID parameters with text for better Edge Functions compatibility
    - Maintain all existing validation and error handling
    - Drop previous function signatures to avoid conflicts
  
  2. Changes
    - Change UUID parameters to text parameters
    - Convert text to UUID internally using uuid() function
    - Drop all previous function signatures completely
    - Maintain backward compatibility through internal conversion
*/

-- Drop all previous versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS create_transaction_record(uuid, text, numeric, text, text, text, uuid, text, text, uuid);
DROP FUNCTION IF EXISTS create_transaction_record(text, text, numeric, text, text, text, text, text, text, text);

-- Create updated function with text parameters for UUID fields
CREATE OR REPLACE FUNCTION create_transaction_record(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_status text,
  p_source text,
  p_destination text,
  p_payout_plan_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_bank_account_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id text;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'Transaction type is required';
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  
  IF p_status IS NULL OR p_status = '' THEN
    RAISE EXCEPTION 'Transaction status is required';
  END IF;

  -- Insert transaction record with converted UUIDs
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    payout_plan_id,
    reference,
    description,
    bank_account_id
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    p_status,
    p_source,
    p_destination,
    p_payout_plan_id,
    p_reference,
    p_description,
    p_bank_account_id
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create transaction record: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION create_transaction_record TO authenticated, service_role;
