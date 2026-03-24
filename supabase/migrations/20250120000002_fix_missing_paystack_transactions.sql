/*
  # Fix Missing Paystack Transactions and Balances
  
  This migration fixes Paystack payments that were successful but not properly
  recorded in the database.
  
  1. Fix wallet available_balance for all users
  2. Create a function to manually process Paystack payments by reference
  3. Provide SQL queries to identify and fix missing transactions
  
  NOTE: This migration does not automatically process payments. You need to:
  1. Query Paystack API for successful payments
  2. Use the fix_paystack_payment_by_reference function for each payment
  3. Or use the batch processing function if you have a list of references
*/

-- Ensure all wallets have correct available_balance
UPDATE wallets
SET available_balance = COALESCE(balance, 0) - COALESCE(locked_balance, 0)
WHERE available_balance IS NULL 
   OR available_balance != (COALESCE(balance, 0) - COALESCE(locked_balance, 0));

-- Function to manually process a Paystack payment by reference
-- This should be called after verifying the payment with Paystack API
CREATE OR REPLACE FUNCTION fix_paystack_payment_by_reference(
  p_user_id uuid,
  p_reference text,
  p_amount numeric,
  p_paystack_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Use the existing process_paystack_deposit function
  SELECT process_paystack_deposit(
    p_user_id,
    p_amount,
    p_reference,
    jsonb_build_object(
      'processed_by', 'manual_fix',
      'processed_at', now(),
      'paystack_data', p_paystack_data
    ) || p_paystack_data
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Function to batch process multiple Paystack payments
CREATE OR REPLACE FUNCTION batch_fix_paystack_payments(
  p_payments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment jsonb;
  v_result jsonb;
  v_results jsonb[] := '{}';
  v_success_count integer := 0;
  v_failed_count integer := 0;
BEGIN
  -- Process each payment in the array
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    BEGIN
      SELECT fix_paystack_payment_by_reference(
        (v_payment->>'user_id')::uuid,
        v_payment->>'reference',
        (v_payment->>'amount')::numeric,
        COALESCE(v_payment->'paystack_data', '{}'::jsonb)
      ) INTO v_result;
      
      v_results := array_append(v_results, jsonb_build_object(
        'reference', v_payment->>'reference',
        'result', v_result
      ));
      
      IF v_result->>'success' = 'true' THEN
        v_success_count := v_success_count + 1;
      ELSE
        v_failed_count := v_failed_count + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_failed_count := v_failed_count + 1;
        v_results := array_append(v_results, jsonb_build_object(
          'reference', v_payment->>'reference',
          'error', SQLERRM
        ));
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total', jsonb_array_length(p_payments),
    'succeeded', v_success_count,
    'failed', v_failed_count,
    'results', to_jsonb(v_results)
  );
END;
$$;

-- Query to find transactions that might need fixing
-- Run this to identify potential issues:
/*
SELECT 
  t.id,
  t.user_id,
  t.reference,
  t.amount,
  t.status,
  t.created_at,
  t.metadata->>'paystack_transaction_id' as paystack_id,
  w.balance,
  w.available_balance,
  w.locked_balance,
  (w.balance - w.locked_balance) as calculated_available_balance
FROM transactions t
LEFT JOIN wallets w ON w.user_id = t.user_id
WHERE t.type = 'deposit'
  AND t.source LIKE '%Paystack%'
  AND (
    t.status != 'completed'
    OR w.available_balance IS NULL
    OR w.available_balance != (w.balance - COALESCE(w.locked_balance, 0))
  )
ORDER BY t.created_at DESC;
*/

-- Query to find users with successful Paystack payments that weren't recorded
-- You'll need to cross-reference with Paystack API:
/*
-- Example: After querying Paystack API for successful payments,
-- use this function to process them:
SELECT fix_paystack_payment_by_reference(
  'user-uuid-here'::uuid,
  'paystack-reference-here',
  amount_in_naira,
  jsonb_build_object(
    'paystack_transaction_id', 'transaction-id-from-paystack',
    'customer_email', 'customer@email.com',
    'channel', 'card'
  )
);
*/

COMMENT ON FUNCTION fix_paystack_payment_by_reference IS 'Manually processes a Paystack payment by reference. Use after verifying payment with Paystack API.';
COMMENT ON FUNCTION batch_fix_paystack_payments IS 'Batch processes multiple Paystack payments. Input is a JSON array of payment objects with user_id, reference, amount, and optional paystack_data.';

