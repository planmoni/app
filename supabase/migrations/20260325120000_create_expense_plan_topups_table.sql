/*
  # Expense Plan Topups (separate from transactions)

  This migration creates a dedicated ledger table for expense plan top-ups,
  so we can track plan funding events without relying exclusively on the
  generic `transactions` table.

  The functions that currently create `transactions.type = 'expense_plan_topup'`
  are also updated to insert into `expense_plan_topups`.
*/

-- Create expense_plan_topups table
CREATE TABLE IF NOT EXISTS expense_plan_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Exactly one of these should be present depending on which plan system is used
  expense_plan_id uuid REFERENCES expense_plans(id) ON DELETE SET NULL,
  budget_plan_id uuid REFERENCES budget_plans(id) ON DELETE SET NULL,

  -- Links back to the plan_transaction created for the credit to the plan wallet
  plan_transaction_id uuid REFERENCES plan_transactions(id) ON DELETE SET NULL,

  -- Optional idempotency/reference (e.g. Paystack reference)
  reference text,

  amount numeric NOT NULL CHECK (amount > 0),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'processing')),
  description text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure we don't accidentally associate a topup with both plan types
  CONSTRAINT expense_plan_topups_plan_scope_check CHECK (
    (expense_plan_id IS NOT NULL AND budget_plan_id IS NULL)
    OR
    (expense_plan_id IS NULL AND budget_plan_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expense_plan_topups_user_id ON expense_plan_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_plan_topups_expense_plan_id ON expense_plan_topups(expense_plan_id);
CREATE INDEX IF NOT EXISTS idx_expense_plan_topups_budget_plan_id ON expense_plan_topups(budget_plan_id);
CREATE INDEX IF NOT EXISTS idx_expense_plan_topups_created_at ON expense_plan_topups(created_at);

-- If reference is present, make it unique (helps prevent double inserts for provider webhooks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_plan_topups_reference
  ON expense_plan_topups(reference)
  WHERE reference IS NOT NULL;

-- RLS
ALTER TABLE expense_plan_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expense plan topups"
  ON expense_plan_topups
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own expense plan topups"
  ON expense_plan_topups
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own expense plan topups"
  ON expense_plan_topups
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own expense plan topups"
  ON expense_plan_topups
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_expense_plan_topups_updated_at ON expense_plan_topups;
CREATE TRIGGER trg_expense_plan_topups_updated_at
  BEFORE UPDATE ON expense_plan_topups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
  Update: process_expense_plan_topup (auto top-ups)
  - Captures the plan_transaction id and writes a row into expense_plan_topups
*/
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

  -- Create transaction record for wallet debit (kept for backward compatibility)
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
  ) RETURNING id INTO v_plan_transaction_id;

  -- Write to dedicated topups table
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

/*
  Update: transfer_wallet_to_plan (manual wallet transfers)
  - Captures plan_transaction id and writes a row into expense_plan_topups
*/
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
  -- Validate input
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Verify plan exists and belongs to user (expense_plans)
  SELECT user_id INTO v_plan_user_id
  FROM expense_plans
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

  -- Get or create plan wallet (plan_wallets)
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (p_plan_id, 0)
    RETURNING id INTO v_plan_wallet_id;
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

  -- Create transaction record for wallet debit (kept for backward compatibility)
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
  ) RETURNING id INTO v_plan_transaction_id;

  -- Write to dedicated topups table
  INSERT INTO expense_plan_topups (
    user_id,
    expense_plan_id,
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

  -- Get updated plan balance
  SELECT current_balance INTO v_new_plan_balance
  FROM expense_plans
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

/*
  Update: process_paystack_plan_deposit (direct plan funding via Paystack)
  - Writes a row into expense_plan_topups using the provider reference for idempotency
*/
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
  v_transaction_id uuid;
  v_main_transaction_id uuid;
  v_already_processed boolean := false;
  v_current_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Validate input parameters
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

  -- Check if transaction already exists (by checking reference in transactions table)
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE reference = arg_reference 
    AND type = 'expense_plan_topup'
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
  
  -- Get or create plan wallet
  SELECT id INTO v_wallet_id
  FROM plan_wallets
  WHERE plan_id = arg_plan_id;
  
  IF v_wallet_id IS NULL THEN
    -- Create wallet if it doesn't exist (shouldn't happen due to trigger, but safety check)
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (arg_plan_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM plan_wallets
  WHERE id = v_wallet_id;
  
  -- Calculate new balance
  v_new_balance := COALESCE(v_current_balance, 0) + arg_amount;
  
  -- Create transaction record in main transactions table
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
    'expense_plan_topup',
    arg_amount,
    'completed',
    'Paystack',
    'budget_plan',
    arg_reference,
    format('Paystack deposit to budget plan (Reference: %s)', arg_reference),
    jsonb_build_object(
      'plan_id', arg_plan_id,
      'transaction_reference', arg_reference,
      'source', 'Paystack',
      'is_plan_deposit', true
    ) || arg_paystack_data
  ) RETURNING id INTO v_main_transaction_id;

  -- Create plan_transaction with type 'manual_topup'
  -- The trigger will automatically update plan_wallets.balance and budget_plans.current_balance
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
  ) RETURNING id INTO v_transaction_id;

  -- Write to dedicated topups table (separate from `transactions`)
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
    v_transaction_id,
    arg_reference,
    arg_amount,
    'Paystack',
    'completed',
    format('Paystack deposit to budget plan (Reference: %s)', arg_reference)
  );

  -- Note: Excess funds from over-funded plans are kept in the plan
  -- They are displayed in the "Available to spend" balance on the Plans tab
  -- which sums up all excess funds (current_balance - total_budget) from all plans

  -- Create notification event (use 'deposit_successful' as it's an allowed event type)
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
    v_main_transaction_id, -- Reference the main transaction record
    jsonb_build_object(
      'plan_id', arg_plan_id,
      'plan_transaction_id', v_transaction_id,
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'source', 'Paystack',
      'is_plan_deposit', true
    ) || arg_paystack_data
  );

  -- Return success result (keep JSON shape compatible with the app)
  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'plan_id', arg_plan_id,
    'wallet_id', v_wallet_id,
    'transaction_id', v_main_transaction_id,
    'plan_transaction_id', v_transaction_id,
    'old_balance', COALESCE(v_current_balance, 0),
    'new_balance', v_new_balance,
    'amount_added', arg_amount,
    'message', 'Plan deposit processed successfully'
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
    RAISE LOG 'Error in process_paystack_plan_deposit: %', SQLERRM;
    RAISE;
END;
$$;

