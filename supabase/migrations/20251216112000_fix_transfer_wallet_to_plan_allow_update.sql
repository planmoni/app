/*
  # Fix transfer_wallet_to_plan function to allow wallet updates
  
  The function needs to call allow_wallet_update() before updating wallets
  to bypass the trigger that prevents direct wallet updates.
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

COMMENT ON FUNCTION transfer_wallet_to_plan IS 'Transfers funds from user wallet to expense plan. Creates plan_transaction with type manual_topup, which triggers automatic updates to plan_wallets.balance and expense_plans.current_balance.';

