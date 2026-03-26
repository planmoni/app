/*
  # Stop recording expense_plan_topup in `transactions`

  The `expense_plan_topups` table is the source of truth for expense-plan funding
  (auto/manual top-ups + Paystack plan deposits).

  This migration updates the relevant RPC functions to:
  - Never insert rows into `transactions` with `type = 'expense_plan_topup'`
  - Use `expense_plan_topups.reference` for Paystack idempotency
  - Keep the existing plan crediting behavior via `plan_transactions`
*/

-- Update: process_expense_plan_topup (auto topups)
CREATE OR REPLACE FUNCTION process_expense_plan_topup(
  p_plan_id uuid,
  p_user_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_plan_wallet_id uuid;
  v_new_wallet_balance numeric;
  v_new_plan_balance numeric;
  v_plan_transaction_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Lock user's main wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found'
    );
  END IF;

  -- Check available balance
  IF (SELECT available_balance FROM wallets WHERE id = v_wallet_id) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds',
      'required', p_amount,
      'available', (SELECT available_balance FROM wallets WHERE id = v_wallet_id)
    );
  END IF;

  -- Plan wallet ID
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan wallet not found'
    );
  END IF;

  -- Required to bypass wallet update trigger
  PERFORM allow_wallet_update();

  -- Debit from main wallet
  UPDATE wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Credit to plan wallet (updates balances via trigger)
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    p_plan_id,
    v_plan_wallet_id,
    'auto_allocation',
    p_amount,
    'Automatic top-up from main wallet'
  ) RETURNING id INTO v_plan_transaction_id;

  -- Ledger row in dedicated table
  INSERT INTO expense_plan_topups (
    user_id,
    budget_plan_id,
    amount,
    reference,
    source,
    status,
    description,
    plan_transaction_id
  ) VALUES (
    p_user_id,
    p_plan_id,
    p_amount,
    NULL,
    'auto_topup',
    'completed',
    format('Auto top-up to budget plan %s', p_plan_id),
    v_plan_transaction_id
  );

  SELECT current_balance INTO v_new_plan_balance
  FROM budget_plans
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_wallet_balance', v_new_wallet_balance,
    'new_plan_balance', v_new_plan_balance,
    'amount', p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update: transfer_wallet_to_plan (manual wallet transfers)
CREATE OR REPLACE FUNCTION transfer_wallet_to_plan(
  p_user_id uuid,
  p_plan_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_plan_wallet_id uuid;
  v_plan_user_id uuid;
  v_new_wallet_balance numeric;
  v_new_plan_balance numeric;
  v_available_balance numeric;
  v_plan_transaction_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Validate plan belongs to user (budget_plans)
  SELECT user_id INTO v_plan_user_id
  FROM budget_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan not found'
    );
  END IF;

  IF v_plan_user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan does not belong to user'
    );
  END IF;

  -- Lock wallet
  SELECT id, available_balance INTO v_wallet_id, v_available_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found'
    );
  END IF;

  IF v_available_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds',
      'required', p_amount,
      'available', v_available_balance
    );
  END IF;

  -- Get or create plan wallet
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (p_plan_id, 0)
    RETURNING id INTO v_plan_wallet_id;
  END IF;

  -- Required to bypass wallet update trigger
  PERFORM allow_wallet_update();

  -- Debit wallet
  UPDATE wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Credit to plan wallet (updates balances via trigger)
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    p_plan_id,
    v_plan_wallet_id,
    'manual_topup',
    p_amount,
    'Manual transfer from wallet balance'
  ) RETURNING id INTO v_plan_transaction_id;

  -- Ledger row in dedicated table
  INSERT INTO expense_plan_topups (
    user_id,
    budget_plan_id,
    amount,
    reference,
    source,
    status,
    description,
    plan_transaction_id
  ) VALUES (
    p_user_id,
    p_plan_id,
    p_amount,
    NULL,
    'manual_topup',
    'completed',
    format('Manual top-up to expense plan %s', p_plan_id),
    v_plan_transaction_id
  );

  SELECT current_balance INTO v_new_plan_balance
  FROM budget_plans
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_wallet_balance', v_new_wallet_balance,
    'new_plan_balance', v_new_plan_balance,
    'amount', p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update: process_paystack_plan_deposit (Paystack funding directly into a plan)
CREATE OR REPLACE FUNCTION process_paystack_plan_deposit(
  arg_user_id uuid,
  arg_plan_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_paystack_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_user_id uuid;
  v_wallet_id uuid;
  v_plan_transaction_id uuid;
  v_already_processed boolean := false;
  v_current_balance numeric;
  v_new_balance numeric;
BEGIN
  IF arg_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  IF arg_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID is required');
  END IF;

  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF arg_reference IS NULL OR arg_reference = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reference is required');
  END IF;

  -- Idempotency: check the dedicated topups table
  SELECT EXISTS(
    SELECT 1 FROM expense_plan_topups
    WHERE reference = arg_reference
      AND status = 'completed'
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed'
    );
  END IF;

  -- Validate plan exists and belongs to user
  SELECT id, user_id INTO v_plan_id, v_plan_user_id
  FROM budget_plans
  WHERE id = arg_plan_id;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;

  IF v_plan_user_id != arg_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan does not belong to user');
  END IF;

  -- Get/create plan wallet
  SELECT id INTO v_wallet_id
  FROM plan_wallets
  WHERE plan_id = arg_plan_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (arg_plan_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  SELECT balance INTO v_current_balance
  FROM plan_wallets
  WHERE id = v_wallet_id;

  v_new_balance := COALESCE(v_current_balance, 0) + arg_amount;

  -- Credit to plan wallet via plan_transaction trigger
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    arg_plan_id,
    v_wallet_id,
    'manual_topup',
    arg_amount,
    format('Paystack deposit: %s (Reference: %s)',
           to_char(arg_amount, 'FM₦999,999,999.00'),
           arg_reference)
  ) RETURNING id INTO v_plan_transaction_id;

  -- Ledger row in dedicated table
  INSERT INTO expense_plan_topups (
    user_id,
    budget_plan_id,
    plan_transaction_id,
    reference,
    amount,
    source,
    status,
    description
  ) VALUES (
    arg_user_id,
    arg_plan_id,
    v_plan_transaction_id,
    arg_reference,
    arg_amount,
    'Paystack',
    'completed',
    format('Paystack deposit to budget plan (Reference: %s)', arg_reference)
  );

  -- Notification event (no `transactions` FK dependency anymore)
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
    'Plan Funded',
    format('₦%s has been added to your plan via Paystack',
           to_char(arg_amount, 'FM999,999,999.00')),
    'unread',
    NULL,
    jsonb_build_object(
      'plan_id', arg_plan_id,
      'plan_transaction_id', v_plan_transaction_id,
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'source', 'Paystack',
      'is_plan_deposit', true
    ) || arg_paystack_data
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'plan_id', arg_plan_id,
    'wallet_id', v_wallet_id,
    -- Kept for compatibility with callers: treat plan_transaction as the "transaction_id"
    'transaction_id', v_plan_transaction_id,
    'plan_transaction_id', v_plan_transaction_id,
    'old_balance', COALESCE(v_current_balance, 0),
    'new_balance', v_new_balance,
    'amount_added', arg_amount,
    'message', 'Plan deposit processed successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed by another process'
    );
  WHEN OTHERS THEN
    RAISE LOG 'Error in process_paystack_plan_deposit: %', SQLERRM;
    RAISE;
END;
$$;

-- Keep grants (re-apply harmlessly)
GRANT EXECUTE ON FUNCTION process_expense_plan_topup TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION transfer_wallet_to_plan TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_paystack_plan_deposit TO authenticated, service_role;

