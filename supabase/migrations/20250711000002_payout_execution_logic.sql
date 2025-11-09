/*
  # Phase 2: Transfer Execution Logic and Retry Functions
  
  1. Wallet balance management functions
  2. Retry logic for failed transfers
  3. Transfer status reconciliation
*/

-- Function to reverse locked funds back to available balance
CREATE OR REPLACE FUNCTION reverse_locked_funds(
  arg_user_id uuid,
  arg_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Get current wallet state
  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Validate locked balance
  IF v_wallet.locked_balance < arg_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient locked balance');
  END IF;
  
  -- Reverse the funds (add back to balance and remove from locked)
  UPDATE wallets 
  SET 
    balance = balance + arg_amount,
    locked_balance = locked_balance - arg_amount,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
  -- Return updated wallet state
  SELECT balance, locked_balance, (balance - locked_balance) as available_balance
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = arg_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
END;
$$;

-- Function to process retry payouts
CREATE OR REPLACE FUNCTION get_retry_payouts()
RETURNS TABLE(
  payout_id uuid,
  payout_plan_id uuid,
  user_id uuid,
  amount numeric,
  -- bank_account_id uuid,
  transfer_reference text,
  retry_count integer,
  error_message text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id as payout_id,
    ap.payout_plan_id,
    ap.user_id,
    ap.amount,
    -- ap.bank_account_id,
    ap.transfer_reference,
    ap.retry_count,
    ap.error_message
  FROM automated_payouts ap
  WHERE ap.status = 'retrying'
    AND ap.retry_after IS NOT NULL
    AND ap.retry_after <= now()
    AND ap.retry_count <= 3;
END;
$$;

-- Function to update automated payout retry status
CREATE OR REPLACE FUNCTION update_payout_retry_status(
  p_payout_id uuid,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_paystack_transfer_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count integer;
  v_retry_after timestamptz;
BEGIN
  -- Get current retry count
  SELECT retry_count INTO v_retry_count 
  FROM automated_payouts 
  WHERE id = p_payout_id;
  
  -- Calculate next retry time if needed
  IF p_status = 'retrying' THEN
    v_retry_count := v_retry_count + 1;
    v_retry_after := now() + (POWER(2, v_retry_count) * INTERVAL '1 minute'); -- Exponential backoff
  ELSE
    v_retry_after := NULL;
  END IF;
  
  -- Update the record
  UPDATE automated_payouts
  SET 
    status = p_status,
    retry_count = COALESCE(v_retry_count, retry_count),
    retry_after = v_retry_after,
    error_message = COALESCE(p_error_message, error_message),
    paystack_transfer_id = COALESCE(p_paystack_transfer_id, paystack_transfer_id),
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_payout_id;
END;
$$;

-- Function to validate payout eligibility
CREATE OR REPLACE FUNCTION validate_payout_eligibility(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_bank_account bank_accounts%ROWTYPE;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout plan not found');
  END IF;
  
  -- Check plan status
  IF v_plan.status != 'active' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Plan is not active');
  END IF;
  
  -- Check if plan is completed
  IF v_plan.completed_payouts >= v_plan.duration THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Plan is already completed');
  END IF;
  
  -- Check payout date
  IF v_plan.next_payout_date IS NULL OR v_plan.next_payout_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout date has not arrived');
  END IF;
  
  -- Get wallet details
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_plan.user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Wallet not found');
  END IF;
  
  -- Check wallet balance
  IF v_wallet.locked_balance < v_plan.payout_amount THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Insufficient locked balance');
  END IF;
  
  -- Get bank account details
  -- SELECT * INTO v_bank_account FROM bank_accounts WHERE id = v_plan.bank_account_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Bank account not found');
  END IF;
  
  -- Check if bank account is active
  IF v_bank_account.status != 'active' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Bank account is not active');
  END IF;
  
  -- Check for existing processing payout
  IF EXISTS (
    SELECT 1 FROM automated_payouts 
    WHERE payout_plan_id = p_plan_id 
      AND scheduled_date = v_plan.next_payout_date
      AND status IN ('pending', 'processing')
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout already being processed');
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', true,
    'plan', row_to_json(v_plan),
    'wallet_balance', v_wallet.locked_balance,
    'bank_account', row_to_json(v_bank_account)
  );
END;
$$;

-- Function to mark payout plan as completed when all payouts are done
CREATE OR REPLACE FUNCTION check_and_complete_payout_plan(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if plan should be completed
  IF v_plan.completed_payouts >= v_plan.duration THEN
    UPDATE payout_plans
    SET 
      status = 'completed',
      next_payout_date = NULL,
      updated_at = now()
    WHERE id = p_plan_id;
    
    -- Create completion notification
    INSERT INTO events (
      user_id,
      type,
      title,
      description,
      status,
      payout_plan_id
    ) VALUES (
      v_plan.user_id,
      'payout_plan_completed',
      'Payout Plan Completed',
      format('Your payout plan "%s" has been completed successfully. All %s payouts have been processed.', 
             v_plan.name, v_plan.duration),
      'unread',
      p_plan_id
    );
  END IF;
END;
$$;

-- Function to get payout statistics for monitoring
CREATE OR REPLACE FUNCTION get_payout_statistics(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'date', p_date,
    'total_due', (
      SELECT COUNT(*) FROM payout_plans 
      WHERE status = 'active' 
        AND next_payout_date = p_date
        AND completed_payouts < duration
    ),
    'total_processed', (
      SELECT COUNT(*) FROM automated_payouts 
      WHERE scheduled_date = p_date 
        AND status = 'completed'
    ),
    'total_failed', (
      SELECT COUNT(*) FROM automated_payouts 
      WHERE scheduled_date = p_date 
        AND status = 'failed'
    ),
    'total_retrying', (
      SELECT COUNT(*) FROM automated_payouts 
      WHERE scheduled_date = p_date 
        AND status = 'retrying'
    ),
    'total_amount_processed', (
      SELECT COALESCE(SUM(amount), 0) FROM automated_payouts 
      WHERE scheduled_date = p_date 
        AND status = 'completed'
    ),
    'total_amount_failed', (
      SELECT COALESCE(SUM(amount), 0) FROM automated_payouts 
      WHERE scheduled_date = p_date 
        AND status = 'failed'
    )
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION reverse_locked_funds TO authenticated;
GRANT EXECUTE ON FUNCTION get_retry_payouts TO authenticated;
GRANT EXECUTE ON FUNCTION update_payout_retry_status TO authenticated;
GRANT EXECUTE ON FUNCTION validate_payout_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_complete_payout_plan TO authenticated;
GRANT EXECUTE ON FUNCTION get_payout_statistics TO authenticated;
