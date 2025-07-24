/*
  # Update Transaction Record Creation Function - UUID Conversion
  
  1. Purpose
    - Update existing create_transaction_record function to use uuid() conversion method
    - Replace ::uuid casting with uuid() function for better type handling
    - Improve compatibility with Edge Functions and JavaScript integration
  
  2. Changes
    - Use uuid() function for UUID parameter conversion
    - Handle nullable UUID parameters with CASE statements
    - Maintain all existing validation and error handling
*/

-- Drop and recreate the function with improved UUID handling
DROP FUNCTION IF EXISTS create_transaction_record(uuid, text, numeric, text, text, text, uuid, text, text, uuid);

-- Create updated function with uuid() conversion method
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
  v_transaction_id uuid;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL THEN
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

  -- Insert transaction record with proper uuid() conversion
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
    uuid(p_user_id::text),
    p_type::text,
    p_amount::numeric,
    p_status::text,
    p_source::text,
    p_destination::text,
    CASE WHEN p_payout_plan_id IS NOT NULL THEN uuid(p_payout_plan_id::text) ELSE NULL END,
    p_reference::text,
    p_description::text,
    CASE WHEN p_bank_account_id IS NOT NULL THEN uuid(p_bank_account_id::text) ELSE NULL END
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create transaction record: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION create_transaction_record TO authenticated, service_role;
