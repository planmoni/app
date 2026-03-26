/*
  # Add withdraw_plan_extra_funds function
  
  This function handles withdrawing extra funds from expense plans.
  It validates extra funds exist, updates plan balances, and creates transaction records.
  
  The actual Paystack transfer is handled by the edge function.
*/

-- Create function to withdraw plan extra funds
CREATE OR REPLACE FUNCTION withdraw_plan_extra_funds(
  arg_plan_id uuid,
  arg_amount numeric,
  arg_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan expense_plans%ROWTYPE;
  v_user_id uuid;
  v_plan_wallet plan_wallets%ROWTYPE;
  v_current_balance numeric;
  v_total_budget numeric;
  v_extra_funds numeric;
  v_payout_account payout_accounts%ROWTYPE;
  v_plan_transaction_id uuid;
  v_reference text;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan
  FROM expense_plans
  WHERE id = arg_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan not found'
    );
  END IF;
  
  v_user_id := v_plan.user_id;
  v_current_balance := COALESCE(v_plan.current_balance, 0);
  v_total_budget := COALESCE(v_plan.total_budget, 0);
  v_extra_funds := v_current_balance - v_total_budget;
  
  -- Validate extra funds exist
  IF v_extra_funds <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No extra funds available in this plan'
    );
  END IF;
  
  -- Validate withdrawal amount doesn't exceed extra funds
  IF arg_amount > v_extra_funds THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawal amount exceeds available extra funds'
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
  v_reference := 'PLAN_WITHDRAW_' || extract(epoch from now())::text || '_' || substring(md5(random()::text) from 1 for 8);
  
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
    'Withdrawal of extra funds to ' || v_payout_account.bank_name || ' ••••' || right(v_payout_account.account_number, 4)
  ) RETURNING id INTO v_plan_transaction_id;
  
  -- Update plan wallet balance (decrease by withdrawal amount)
  UPDATE plan_wallets
  SET balance = balance - arg_amount,
      updated_at = now()
  WHERE id = v_plan_wallet.id;
  
  -- Update expense plan current_balance
  UPDATE expense_plans
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

