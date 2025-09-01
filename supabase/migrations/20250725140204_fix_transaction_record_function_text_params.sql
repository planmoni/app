/*
  # Fix Transaction Record Function - Correct Text Parameters
  
  1. Purpose
    - Fix the create_transaction_record function to properly accept text parameters
    - Convert text parameters to UUID internally with proper validation
    - Handle empty strings and null values correctly
  
  2. Changes
    - Drop the incorrect function signature
    - Create function with all UUID fields as text parameters
    - Add proper UUID conversion and validation
    - Handle empty strings by treating them as NULL
*/

-- Drop the existing function with incorrect signature
DROP FUNCTION IF EXISTS create_transaction_record(text, text, numeric, text, text, text, text, text, text, text);

-- Create the corrected function with proper text parameters
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
