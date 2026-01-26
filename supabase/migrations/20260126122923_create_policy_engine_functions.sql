/*
  # Create Policy Engine Database Functions
  
  Database functions for policy evaluation and restriction checking.
  These functions are called by the application layer to evaluate
  policies and restrictions before allowing transactions.
*/

-- Function to check wallet restrictions
CREATE OR REPLACE FUNCTION check_wallet_restrictions(
  p_wallet_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_purpose text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_restrictions jsonb;
  v_result jsonb := '{"passed": true, "violations": []}'::jsonb;
  v_restriction_record RECORD;
  v_daily_total numeric := 0;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('passed', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate daily total for this wallet (transactions today)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
  FROM transactions
  WHERE wallet_id = p_wallet_id
    AND DATE(created_at) = CURRENT_DATE
    AND type = p_transaction_type
    AND status = 'completed';

  -- Get all active restrictions for this wallet
  FOR v_restriction_record IN
    SELECT * FROM wallet_restrictions
    WHERE wallet_id = p_wallet_id
      AND is_active = true
  LOOP
    -- Check max_balance restriction
    IF v_restriction_record.restriction_type = 'max_balance' THEN
      IF v_wallet.balance > (v_restriction_record.restriction_value->>'amount')::numeric THEN
        v_result := jsonb_set(
          v_result,
          '{passed}',
          'false'::jsonb
        );
        v_result := jsonb_set(
          v_result,
          '{violations}',
          (v_result->'violations') || jsonb_build_object(
            'type', 'max_balance',
            'message', 'Balance exceeds maximum allowed',
            'current', v_wallet.balance,
            'limit', (v_restriction_record.restriction_value->>'amount')::numeric
          )
        );
      END IF;
    END IF;

    -- Check min_balance restriction
    IF v_restriction_record.restriction_type = 'min_balance' THEN
      IF v_wallet.balance < (v_restriction_record.restriction_value->>'amount')::numeric THEN
        v_result := jsonb_set(
          v_result,
          '{passed}',
          'false'::jsonb
        );
        v_result := jsonb_set(
          v_result,
          '{violations}',
          (v_result->'violations') || jsonb_build_object(
            'type', 'min_balance',
            'message', 'Balance below minimum required',
            'current', v_wallet.balance,
            'limit', (v_restriction_record.restriction_value->>'amount')::numeric
          )
        );
      END IF;
    END IF;

    -- Check transaction_limit restriction
    IF v_restriction_record.restriction_type = 'transaction_limit' THEN
      IF p_amount > (v_restriction_record.restriction_value->>'amount')::numeric THEN
        v_result := jsonb_set(
          v_result,
          '{passed}',
          'false'::jsonb
        );
        v_result := jsonb_set(
          v_result,
          '{violations}',
          (v_result->'violations') || jsonb_build_object(
            'type', 'transaction_limit',
            'message', 'Transaction amount exceeds limit',
            'amount', p_amount,
            'limit', (v_restriction_record.restriction_value->>'amount')::numeric
          )
        );
      END IF;
    END IF;

    -- Check daily_limit restriction
    IF v_restriction_record.restriction_type = 'daily_limit' THEN
      IF (v_daily_total + p_amount) > (v_restriction_record.restriction_value->>'daily_amount')::numeric THEN
        v_result := jsonb_set(
          v_result,
          '{passed}',
          'false'::jsonb
        );
        v_result := jsonb_set(
          v_result,
          '{violations}',
          (v_result->'violations') || jsonb_build_object(
            'type', 'daily_limit',
            'message', 'Daily limit would be exceeded',
            'current_daily', v_daily_total,
            'requested', p_amount,
            'limit', (v_restriction_record.restriction_value->>'daily_amount')::numeric
          )
        );
      END IF;
    END IF;

    -- Check withdrawal_limit restriction
    IF v_restriction_record.restriction_type = 'withdrawal_limit' 
       AND p_transaction_type = 'withdrawal' THEN
      IF p_amount > (v_restriction_record.restriction_value->>'amount')::numeric THEN
        v_result := jsonb_set(
          v_result,
          '{passed}',
          'false'::jsonb
        );
        v_result := jsonb_set(
          v_result,
          '{violations}',
          (v_result->'violations') || jsonb_build_object(
            'type', 'withdrawal_limit',
            'message', 'Withdrawal amount exceeds limit',
            'amount', p_amount,
            'limit', (v_restriction_record.restriction_value->>'amount')::numeric
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Function to get required approvals for a transaction
CREATE OR REPLACE FUNCTION get_required_approvals(
  p_wallet_id uuid,
  p_transaction_type text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_restriction_record RECORD;
  v_result jsonb := '{"requires_approval": false}'::jsonb;
  v_threshold numeric;
  v_workflow_id uuid;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('requires_approval', false, 'error', 'Wallet not found');
  END IF;

  -- Check if wallet requires approval globally
  IF v_wallet.requires_approval THEN
    RETURN jsonb_build_object(
      'requires_approval', true,
      'reason', 'Wallet requires approval for all transactions'
    );
  END IF;

  -- Check approval_required restrictions
  FOR v_restriction_record IN
    SELECT * FROM wallet_restrictions
    WHERE wallet_id = p_wallet_id
      AND restriction_type = 'approval_required'
      AND is_active = true
  LOOP
    v_threshold := (v_restriction_record.restriction_value->>'threshold')::numeric;
    v_workflow_id := (v_restriction_record.restriction_value->>'workflow_id')::uuid;

    -- If amount exceeds threshold, require approval
    IF v_threshold IS NOT NULL AND p_amount >= v_threshold THEN
      RETURN jsonb_build_object(
        'requires_approval', true,
        'threshold', v_threshold,
        'workflow_id', v_workflow_id,
        'reason', format('Amount %s exceeds approval threshold %s', p_amount, v_threshold)
      );
    END IF;

    -- If no threshold but workflow_id is set, always require approval
    IF v_threshold IS NULL AND v_workflow_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'requires_approval', true,
        'workflow_id', v_workflow_id,
        'reason', 'Approval required for this transaction type'
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Function to evaluate wallet policy
CREATE OR REPLACE FUNCTION evaluate_wallet_policy(
  p_wallet_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_purpose text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_policy wallet_policies%ROWTYPE;
  v_policy_rules jsonb;
  v_result jsonb := '{"decision": "allow"}'::jsonb;
  v_rule jsonb;
  v_condition jsonb;
BEGIN
  -- Get wallet details
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('decision', 'deny', 'error', 'Wallet not found');
  END IF;

  -- If wallet has no policy, allow (for backward compatibility)
  IF v_wallet.policy_id IS NULL THEN
    RETURN jsonb_build_object('decision', 'allow', 'reason', 'No policy configured');
  END IF;

  -- Get policy
  SELECT * INTO v_policy FROM wallet_policies WHERE id = v_wallet.policy_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('decision', 'allow', 'reason', 'Policy not found or inactive');
  END IF;

  -- Get policy rules
  v_policy_rules := v_policy.policy_rules;

  -- Evaluate each rule (simplified - full evaluation done in application layer)
  -- This function provides basic policy checking, detailed evaluation in app
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_policy_rules->'rules')
  LOOP
    -- Check if rule matches (simplified check)
    -- Full evaluation should be done in application layer using PolicyEngine
    IF (v_rule->>'action')::text = 'deny' THEN
      -- Basic deny rule check would go here
      -- For now, return allow and let application layer handle detailed evaluation
      NULL;
    END IF;
  END LOOP;

  -- Return result (detailed evaluation done in application)
  RETURN jsonb_build_object(
    'decision', 'allow',
    'policy_id', v_policy.id,
    'policy_name', v_policy.name,
    'note', 'Detailed evaluation should be done in application layer'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_wallet_restrictions(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_required_approvals(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_wallet_policy(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_restrictions(uuid, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_required_approvals(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_wallet_policy(uuid, text, numeric, text) TO service_role;
