/*
  # Add transfer_plan_to_wallet function
  
  This function transfers funds from expense plan wallet back to user's main wallet.
  It validates plan exists, checks for sufficient balance, and creates transaction records.
*/

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
  FROM expense_plans
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION transfer_plan_to_wallet TO authenticated, service_role;

COMMENT ON FUNCTION transfer_plan_to_wallet IS 'Transfers funds from expense plan wallet back to user main wallet. Creates plan_transaction with type withdrawal (positive amount), which triggers automatic updates to plan_wallets.balance and expense_plans.current_balance.';

