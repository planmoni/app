-- Add transaction_id to events INSERT in process_mono_deposit (Paystack parity)
-- So events can be joined/filtered by transaction_id like Paystack deposits.

-- Ensure events has metadata column (Paystack uses it; add if missing)
ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION process_mono_deposit(
  arg_user_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_mono_data jsonb
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
  v_event_id uuid;
  v_already_processed boolean := false;
  v_result jsonb;
  v_source text;
  v_description text;
BEGIN
  -- SECURITY: Check if transaction already exists (idempotency)
  -- Supports both mono_directpay and mono_directdebit
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE reference = arg_reference 
    AND type = 'deposit'
    AND source IN ('mono_directpay', 'mono_directdebit')
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    -- Return existing transaction info
    SELECT id INTO v_transaction_id
    FROM transactions
    WHERE reference = arg_reference
    AND type = 'deposit'
    AND source = 'mono_directpay'
    LIMIT 1;
    
    SELECT balance INTO v_new_balance
    FROM wallets
    WHERE user_id = arg_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed',
      'transaction_id', v_transaction_id,
      'new_balance', v_new_balance
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
  
  -- SECURITY: Atomic update - wallet balance and transaction in single transaction
  BEGIN
    -- Update wallet balance
    UPDATE wallets 
    SET 
      balance = v_new_balance,
      updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Create transaction record (source from mono_data)
    v_source := COALESCE(
      arg_mono_data->>'source',
      CASE
        WHEN arg_mono_data->>'mono_debit_id' IS NOT NULL THEN 'mono_directdebit'
        WHEN arg_mono_data->>'mono_payment_id' IS NOT NULL THEN 'mono_directpay'
        ELSE 'mono_directdebit'
      END
    );
    v_description := CASE
      WHEN v_source = 'mono_directdebit' THEN 'Mono DirectDebit deposit'
      ELSE 'Mono DirectPay deposit'
    END;
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
        v_source,
        'wallet',
        arg_reference,
        v_description,
      jsonb_build_object(
        'mono_payment_id', arg_mono_data->>'mono_payment_id',
        'mono_reference', arg_mono_data->>'mono_reference',
        'verified_status', arg_mono_data->>'verified_status',
        'processed_by', arg_mono_data->>'processed_by',
        'processed_at', arg_mono_data->>'processed_at',
        'mono_data', arg_mono_data
      )
    RETURNING id INTO v_transaction_id;

    -- Create event for notification (include transaction_id for Paystack parity)
    -- Use INSERT then SELECT to avoid "INTO specified more than once" (INSERT INTO + RETURNING INTO)
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
      'Deposit Successful',
      format('₦%s has been added to your wallet via Mono DirectPay', to_char(arg_amount, 'FM999,999,999.00')),
      'unread',
      v_transaction_id,
      jsonb_build_object(
        'transaction_id', v_transaction_id,
        'amount', arg_amount,
        'reference', arg_reference,
        'source', 'mono_directpay'
      )
    );
    v_event_id := (
      SELECT id FROM events
      WHERE user_id = arg_user_id AND transaction_id = v_transaction_id AND type = 'deposit_successful'
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic, but log the error
      RAISE EXCEPTION 'Error processing deposit: %', SQLERRM;
  END;
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'event_id', v_event_id,
    'new_balance', v_new_balance,
    'previous_balance', v_current_balance,
    'amount', arg_amount
  );
END;
$$;

COMMENT ON FUNCTION process_mono_deposit IS 'Atomically processes Mono DirectPay deposits with idempotency checks';
