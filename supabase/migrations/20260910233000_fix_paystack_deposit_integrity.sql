/*
  Fix Paystack deposit integrity:
  - Insert-first / upgrade-pending so unique(reference) cannot skip wallet credit
  - Lock wallet row (FOR UPDATE) to avoid lost updates on concurrent deposits
  - GRANT execute for authenticated + service_role
*/

-- Drop every overload (4-arg, 6-arg fee variants, etc.) so CREATE is unambiguous
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'process_paystack_deposit'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION process_paystack_deposit(
  arg_user_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_paystack_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_current_locked_balance numeric;
  v_new_balance numeric;
  v_new_available_balance numeric;
  v_transaction_id uuid;
  v_existing_id uuid;
  v_existing_status text;
  v_existing_user_id uuid;
  v_existing_amount numeric;
BEGIN
  IF arg_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF arg_reference IS NULL OR btrim(arg_reference) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reference is required');
  END IF;

  -- Existing row for this reference (pending or completed)
  SELECT id, status, user_id, amount
  INTO v_existing_id, v_existing_status, v_existing_user_id, v_existing_amount
  FROM transactions
  WHERE reference = arg_reference
    AND type = 'deposit'
  ORDER BY CASE WHEN status = 'completed' THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'completed' THEN
    SELECT COALESCE(balance, 0) INTO v_new_balance
    FROM wallets
    WHERE user_id = arg_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed',
      'transaction_id', v_existing_id,
      'amount_added', v_existing_amount,
      'new_balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_user_id IS DISTINCT FROM arg_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Deposit reference belongs to a different user'
    );
  END IF;

  -- Lock wallet before mutating balances
  SELECT id, COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO v_wallet_id, v_current_balance, v_current_locked_balance
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', arg_user_id;
  END IF;

  v_new_balance := v_current_balance + arg_amount;
  v_new_available_balance := GREATEST(0, v_new_balance - v_current_locked_balance);

  BEGIN
    IF v_existing_id IS NOT NULL AND v_existing_status IS DISTINCT FROM 'completed' THEN
      -- Upgrade pending/failed row created by USSD (or similar) and credit wallet
      UPDATE transactions
      SET
        user_id = arg_user_id,
        amount = arg_amount,
        status = 'completed',
        source = COALESCE(NULLIF(source, ''), 'Paystack'),
        destination = 'wallet',
        description = 'Funds added to wallet via Paystack',
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(arg_paystack_data, '{}'::jsonb),
        updated_at = now()
      WHERE id = v_existing_id
      RETURNING id INTO v_transaction_id;
    ELSE
      -- Insert-first: unique(reference) prevents double credit
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
        COALESCE(arg_paystack_data, '{}'::jsonb)
      )
      RETURNING id INTO v_transaction_id;
    END IF;

    PERFORM allow_wallet_update();

    UPDATE wallets
    SET
      balance = v_new_balance,
      available_balance = v_new_available_balance,
      updated_at = now()
    WHERE id = v_wallet_id;

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
      SELECT id, amount INTO v_transaction_id, v_existing_amount
      FROM transactions
      WHERE reference = arg_reference
        AND type = 'deposit'
      LIMIT 1;

      SELECT COALESCE(balance, 0) INTO v_new_balance
      FROM wallets
      WHERE user_id = arg_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'message', 'Transaction already processed by another process',
        'transaction_id', v_transaction_id,
        'amount_added', v_existing_amount,
        'new_balance', COALESCE(v_new_balance, 0)
      );
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in process_paystack_deposit: %', SQLERRM;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION process_paystack_deposit(uuid, numeric, text, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION process_paystack_deposit(uuid, numeric, text, jsonb) IS
  'Atomically credits Paystack wallet deposits: upgrades pending refs, insert-first idempotency, wallet FOR UPDATE.';
