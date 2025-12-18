/*
  # Update Database Functions for budget_plans Table
  
  This migration updates all database functions that reference expense_plans
  to use budget_plans instead, since we've migrated to the new table structure.
*/

-- Update transfer_wallet_to_plan function
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
BEGIN
  -- Validate input
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Verify plan exists and belongs to user
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

  -- Get user's main wallet with row lock
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

  -- Check if user has sufficient available balance
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
    -- Create plan wallet if it doesn't exist
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (p_plan_id, 0)
    RETURNING id INTO v_plan_wallet_id;
  END IF;

  -- Mark this update as allowed (required to bypass wallet update trigger)
  PERFORM allow_wallet_update();

  -- Debit from main wallet (both balance and available_balance)
  UPDATE wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Create transaction record for wallet debit
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'expense_plan_topup',
    p_amount,
    'completed',
    'wallet',
    'expense_plan',
    format('Manual transfer to expense plan %s', p_plan_id)
  );

  -- Credit to plan wallet via plan_transactions (trigger will update balances)
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
  );

  -- Get updated plan balance
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

COMMENT ON FUNCTION transfer_wallet_to_plan IS 'Transfers funds from user wallet to budget plan. Creates plan_transaction with type manual_topup, which triggers automatic updates to plan_wallets.balance and budget_plans.current_balance.';

-- Update transfer_plan_to_wallet function
CREATE OR REPLACE FUNCTION transfer_plan_to_wallet(
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
  v_plan_current_balance numeric;
  v_new_wallet_balance numeric;
  v_new_plan_balance numeric;
  v_plan_transaction_id uuid;
BEGIN
  -- Validate input
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Verify plan exists and belongs to user
  SELECT user_id, current_balance INTO v_plan_user_id, v_plan_current_balance
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

  -- Check if plan has sufficient balance
  IF v_plan_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient plan balance',
      'required', p_amount,
      'available', v_plan_current_balance
    );
  END IF;

  -- Get user's main wallet with row lock
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

  -- Get plan wallet
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan wallet not found'
    );
  END IF;

  -- Mark this update as allowed (required to bypass wallet update trigger)
  PERFORM allow_wallet_update();

  -- Credit to main wallet (both balance and available_balance)
  UPDATE wallets
  SET balance = balance + p_amount,
      available_balance = available_balance + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Create plan transaction record (debit from plan wallet)
  -- Use 'withdrawal' type with positive amount - trigger will subtract it automatically
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    p_plan_id,
    v_plan_wallet_id,
    'withdrawal',
    p_amount,
    'Transfer to main wallet balance'
  ) RETURNING id INTO v_plan_transaction_id;

  -- Get updated plan balance (trigger will update it automatically)
  SELECT current_balance INTO v_new_plan_balance
  FROM budget_plans
  WHERE id = p_plan_id;

  -- Create transaction record for wallet credit
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    'expense_plan',
    'wallet',
    format('Transfer from expense plan %s', p_plan_id)
  );

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

COMMENT ON FUNCTION transfer_plan_to_wallet IS 'Transfers funds from budget plan wallet back to user main wallet. Creates plan_transaction with type withdrawal (positive amount), which triggers automatic updates to plan_wallets.balance and budget_plans.current_balance.';

-- Update close_plan_with_payout function
CREATE OR REPLACE FUNCTION close_plan_with_payout(
  arg_plan_id uuid,
  arg_amount numeric,
  arg_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan budget_plans%ROWTYPE;
  v_user_id uuid;
  v_plan_wallet plan_wallets%ROWTYPE;
  v_current_balance numeric;
  v_payout_account payout_accounts%ROWTYPE;
  v_plan_transaction_id uuid;
  v_reference text;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan
  FROM budget_plans
  WHERE id = arg_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan not found'
    );
  END IF;
  
  v_user_id := v_plan.user_id;
  v_current_balance := COALESCE(v_plan.current_balance, 0);
  
  -- Validate balance exists
  IF v_current_balance <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No funds available in this plan'
    );
  END IF;
  
  -- Validate withdrawal amount doesn't exceed balance
  IF arg_amount > v_current_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawal amount exceeds available balance'
    );
  END IF;
  
  -- Get payout account
  SELECT * INTO v_payout_account
  FROM payout_accounts
  WHERE id = arg_account_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout account not found'
    );
  END IF;
  
  -- Get plan wallet
  SELECT * INTO v_plan_wallet
  FROM plan_wallets
  WHERE plan_id = arg_plan_id;
  
  IF NOT FOUND THEN
    -- Create plan wallet if it doesn't exist
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (arg_plan_id, v_current_balance)
    RETURNING * INTO v_plan_wallet;
  END IF;
  
  -- Generate reference
  v_reference := 'PLAN_CLOSE_' || extract(epoch from now())::text || '_' || substring(md5(random()::text) from 1 for 8);
  
  -- Create plan transaction record
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    arg_plan_id,
    v_plan_wallet.id,
    'withdrawal',
    arg_amount,
    'Close plan - Withdrawal to ' || v_payout_account.bank_name || ' ••••' || right(v_payout_account.account_number, 4)
  ) RETURNING id INTO v_plan_transaction_id;
  
  -- Update plan wallet balance (decrease by withdrawal amount)
  UPDATE plan_wallets
  SET balance = balance - arg_amount,
      updated_at = now()
  WHERE id = v_plan_wallet.id;
  
  -- Update budget plan current_balance
  UPDATE budget_plans
  SET current_balance = current_balance - arg_amount,
      updated_at = now()
  WHERE id = arg_plan_id;
  
  -- Return success with transaction details
  RETURN jsonb_build_object(
    'success', true,
    'plan_transaction_id', v_plan_transaction_id,
    'reference', v_reference,
    'amount', arg_amount,
    'account_name', v_payout_account.account_name,
    'account_number', v_payout_account.account_number,
    'bank_name', v_payout_account.bank_name
  );
END;
$$;

COMMENT ON FUNCTION close_plan_with_payout IS 'Closes a budget plan by withdrawing all remaining funds to a payout account. Creates plan_transaction with type withdrawal, which triggers automatic updates to plan_wallets.balance and budget_plans.current_balance.';

-- Update process_expense_plan_topup function
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
BEGIN
  -- Validate input
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Get user's main wallet with row lock
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

  -- Check if user has sufficient available balance
  IF (SELECT available_balance FROM wallets WHERE id = v_wallet_id) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds',
      'required', p_amount,
      'available', (SELECT available_balance FROM wallets WHERE id = v_wallet_id)
    );
  END IF;

  -- Get plan wallet ID
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan wallet not found'
    );
  END IF;

  -- Mark this update as allowed (required to bypass wallet update trigger)
  PERFORM allow_wallet_update();

  -- Debit from main wallet
  UPDATE wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Create transaction record for wallet debit
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'expense_plan_topup',
    p_amount,
    'completed',
    'wallet',
    'expense_plan',
    format('Auto top-up to expense plan %s', p_plan_id)
  );

  -- Credit to plan wallet via plan_transactions (trigger will update balances)
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
  );

  -- Get updated plan balance
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

COMMENT ON FUNCTION process_expense_plan_topup IS 'Processes automatic top-up for budget plan. Transfers funds from user wallet to budget plan. Creates plan_transaction with type auto_topup, which triggers automatic updates to plan_wallets.balance and budget_plans.current_balance.';

