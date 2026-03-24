-- RPC: cancel_payout_plan
-- Sets plan status to 'cancelled'. Only owner can cancel; only active/paused plans.
-- Processing fee (1.5% capped at ₦500) is NOT refunded.
-- Stamp duty (₦50) and transaction fees (₦10.75) for REMAINING (unused) payouts ARE refunded.
-- Trigger recalculates locked balance, releasing remaining net amount to available balance.

CREATE OR REPLACE FUNCTION cancel_payout_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_remaining integer;
  v_stamp_refund numeric := 0;
  v_transaction_refund numeric := 0;
  v_fee_refund numeric := 0;
  v_per_amount numeric;
  v_cpd RECORD;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  IF v_plan.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to cancel this plan');
  END IF;

  IF v_plan.status NOT IN ('active', 'paused') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',
      format('Plan cannot be cancelled (current status: %s)', v_plan.status)
    );
  END IF;

  -- Remaining payouts = those not yet completed
  v_remaining := GREATEST(0, COALESCE(v_plan.duration, 0) - COALESCE(v_plan.completed_payouts, 0));
  IF v_remaining <= 0 THEN
    -- No remaining payouts; just cancel
    UPDATE payout_plans SET status = 'cancelled', updated_at = now() WHERE id = p_plan_id;
    RETURN jsonb_build_object('success', true, 'message', 'Plan cancelled', 'fee_refund', 0);
  END IF;

  -- Calculate refund: stamp duty + transaction fees for remaining payouts only
  IF v_plan.frequency = 'custom' THEN
    -- Custom: use custom_payout_dates, ordered by date; skip first completed_payouts
    FOR v_cpd IN
      SELECT cpd.amount
      FROM custom_payout_dates cpd
      WHERE cpd.payout_plan_id = p_plan_id
      ORDER BY cpd.payout_date
      OFFSET COALESCE(v_plan.completed_payouts, 0)
      LIMIT v_remaining
    LOOP
      v_per_amount := COALESCE(v_cpd.amount, v_plan.payout_amount);
      IF v_per_amount > 9999 THEN
        v_stamp_refund := v_stamp_refund + 50;
      END IF;
      v_transaction_refund := v_transaction_refund + 10.75;
    END LOOP;
  ELSE
    -- Regular: per-payout amount from plan
    v_per_amount := COALESCE(v_plan.payout_amount, 0);
    IF v_per_amount > 9999 THEN
      v_stamp_refund := 50 * v_remaining;
    END IF;
    v_transaction_refund := 10.75 * v_remaining;
  END IF;

  v_fee_refund := v_stamp_refund + v_transaction_refund;

  -- Refund stamp + transaction fees to user's balance (processing fee not refunded)
  IF v_fee_refund > 0 THEN
    PERFORM allow_wallet_update();
    UPDATE wallets
    SET balance = balance + v_fee_refund, updated_at = now()
    WHERE user_id = v_plan.user_id;
  END IF;

  -- Cancel the plan; trigger will recalculate locked_balance (releases remaining net)
  UPDATE payout_plans
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Plan cancelled',
    'fee_refund', v_fee_refund,
    'stamp_refund', v_stamp_refund,
    'transaction_refund', v_transaction_refund
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION cancel_payout_plan(uuid) IS 'Cancels plan. Refunds stamp+transaction fees for remaining payouts; processing fee not refunded. Trigger releases locked balance.';

GRANT EXECUTE ON FUNCTION cancel_payout_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_payout_plan(uuid) TO service_role;
