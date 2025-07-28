/*
  # Add process_paystack_deposit function
  
  This function provides atomic processing of Paystack deposits with proper
  duplicate prevention and transaction handling.
  
  1. New Functions
    - process_paystack_deposit
      - Handles wallet balance update
      - Creates transaction record
      - Prevents duplicates
      - Returns processing status
*/

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
  v_new_balance numeric;
  v_transaction_id uuid;
  v_already_processed boolean := false;
  v_result jsonb;
BEGIN
  -- Check if transaction already exists
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE reference = arg_reference 
    AND type = 'deposit'
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed'
    );
  END IF;
  
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets 
  WHERE user_id = arg_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', arg_user_id;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + arg_amount;
  
  -- Update wallet balance
  UPDATE wallets 
  SET 
    balance = v_new_balance,
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
    'Paystack Virtual Account',
    'wallet',
    arg_reference,
    'Funds added to wallet',
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
      'amount', arg_amount
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