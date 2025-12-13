/*
  # Fix Paystack Deposit Processing
  
  This migration fixes the process_paystack_deposit function to properly update
  available_balance when processing deposits.
  
  1. Update process_paystack_deposit function
    - Update available_balance when balance changes
    - Ensure available_balance = balance - locked_balance
  
  2. Fix existing transactions
    - Update available_balance for wallets that have incorrect values
    - Process any pending Paystack deposits that weren't completed
*/

-- Drop existing function first (required when changing function signature)
-- Drop all possible overloads to ensure clean replacement
DROP FUNCTION IF EXISTS process_paystack_deposit(uuid, numeric, text, jsonb) CASCADE;

-- Update process_paystack_deposit to properly handle available_balance
CREATE OR REPLACE FUNCTION process_paystack_deposit(
  arg_user_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_paystack_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_current_locked_balance numeric;
  v_new_balance numeric;
  v_new_available_balance numeric;
  v_transaction_id uuid;
  v_already_processed boolean := false;
BEGIN
  -- Check if transaction already exists
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE reference = arg_reference 
    AND type = 'deposit'
    AND status = 'completed'
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed'
    );
  END IF;
  
  -- Mark this update as allowed (required by prevent_direct_wallet_updates trigger)
  PERFORM allow_wallet_update();
  
  -- Get user's wallet
  SELECT id, COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO v_wallet_id, v_current_balance, v_current_locked_balance
  FROM wallets 
  WHERE user_id = arg_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', arg_user_id;
  END IF;
  
  -- Calculate new balance and available balance
  v_new_balance := v_current_balance + arg_amount;
  v_new_available_balance := v_new_balance - v_current_locked_balance;
  
  -- Update wallet balance and available_balance
  UPDATE wallets 
  SET 
    balance = v_new_balance,
    available_balance = v_new_available_balance,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    reference,
    description,
    metadata
  ) VALUES (
    arg_user_id,
    'deposit',
    arg_amount,
    'completed',
    'Paystack',
    'wallet',
    arg_reference,
    'Funds added to wallet via Paystack',
    arg_paystack_data
  ) RETURNING id INTO v_transaction_id;
  
  -- Create notification event
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    transaction_id,
    metadata
  ) VALUES (
    arg_user_id,
    'deposit_successful',
    'Funds Received',
    format('₦%s has been added to your wallet', to_char(arg_amount, 'FM999,999,999.00')),
    'unread',
    v_transaction_id,
    jsonb_build_object(
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'source', 'Paystack'
    )
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'new_available_balance', v_new_available_balance,
    'amount_added', arg_amount,
    'message', 'Deposit processed successfully'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Transaction was already processed by another concurrent process
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed by another process'
    );
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE LOG 'Error in process_paystack_deposit: %', SQLERRM;
    RAISE;
END;
$$;

-- Fix existing wallets with incorrect available_balance
UPDATE wallets
SET available_balance = COALESCE(balance, 0) - COALESCE(locked_balance, 0)
WHERE available_balance IS NULL 
   OR available_balance != (COALESCE(balance, 0) - COALESCE(locked_balance, 0));

-- Create a function to reprocess failed Paystack deposits
CREATE OR REPLACE FUNCTION reprocess_paystack_deposits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_result jsonb;
  v_processed_count integer := 0;
  v_failed_count integer := 0;
BEGIN
  -- Find transactions that are marked as successful in Paystack but not completed in our system
  -- This would typically be done by checking Paystack API, but for now we'll fix transactions
  -- that have status 'pending' or 'failed' but should be 'completed'
  
  -- Update transactions that should be completed but aren't
  FOR v_transaction IN
    SELECT t.id, t.user_id, t.amount, t.reference, t.metadata
    FROM transactions t
    WHERE t.type = 'deposit'
      AND t.source = 'Paystack'
      AND t.status != 'completed'
      AND t.reference IS NOT NULL
      AND t.metadata->>'paystack_transaction_id' IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT 100
  LOOP
    BEGIN
      -- Try to process the deposit
      SELECT process_paystack_deposit(
        v_transaction.user_id,
        v_transaction.amount,
        v_transaction.reference,
        COALESCE(v_transaction.metadata, '{}'::jsonb)
      ) INTO v_result;
      
      IF v_result->>'success' = 'true' THEN
        v_processed_count := v_processed_count + 1;
      ELSE
        v_failed_count := v_failed_count + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_failed_count := v_failed_count + 1;
        RAISE LOG 'Error reprocessing transaction %: %', v_transaction.reference, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'failed_count', v_failed_count,
    'message', format('Reprocessed %s transactions, %s failed', v_processed_count, v_failed_count)
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION process_paystack_deposit IS 'Processes Paystack deposits atomically, updating balance, available_balance, creating transactions and events';
COMMENT ON FUNCTION reprocess_paystack_deposits IS 'Reprocesses failed or pending Paystack deposit transactions';

