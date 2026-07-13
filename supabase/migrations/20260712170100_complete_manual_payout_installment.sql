-- Record an installment paid manually (e.g. SafeHaven dashboard) and advance the plan for the next cron run.

CREATE OR REPLACE FUNCTION public.complete_manual_payout_installment(
  p_automated_payout_id uuid,
  p_external_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_unpause_plan boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap automated_payouts%ROWTYPE;
  v_plan payout_plans%ROWTYPE;
  v_amount numeric;
  v_wallet_debited boolean;
  v_wallet_refund_applied boolean;
  v_net_wallet_debited boolean;
  v_transfer_result jsonb;
  v_provider_metadata jsonb;
  v_complete_result jsonb;
BEGIN
  SELECT * INTO v_ap
  FROM automated_payouts
  WHERE id = p_automated_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'automated_payout not found');
  END IF;

  IF v_ap.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'automated_payout_id', v_ap.id
    );
  END IF;

  SELECT * INTO v_plan
  FROM payout_plans
  WHERE id = v_ap.payout_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'payout plan not found');
  END IF;

  v_amount := COALESCE(
    (v_ap.metadata->>'wallet_debited_amount')::numeric,
    v_ap.amount,
    public.resolve_payout_installment_amount(v_ap.payout_plan_id, COALESCE(v_ap.installment_index, v_plan.completed_payouts))
  );

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not resolve installment amount');
  END IF;

  v_wallet_debited := COALESCE((v_ap.metadata->>'wallet_debited')::boolean, false);
  v_wallet_refund_applied := COALESCE((v_ap.metadata->>'wallet_refund_applied')::boolean, false);
  v_net_wallet_debited := v_wallet_debited AND NOT v_wallet_refund_applied;

  -- Wallet must reflect funds leaving for this installment. If webhook refunded after failure,
  -- debit again before completing (admin paid user externally from corporate SafeHaven).
  IF NOT v_net_wallet_debited THEN
    PERFORM set_wallet_op_context(
      'transfer_funds',
      'complete_manual_payout_installment',
      v_ap.id::text,
      jsonb_build_object(
        'automated_payout_id', v_ap.id,
        'plan_id', v_ap.payout_plan_id,
        'amount', v_amount,
        'external_reference', p_external_reference
      )
    );

    v_transfer_result := public.transfer_funds(v_ap.user_id, v_amount);

    IF COALESCE(v_transfer_result->>'success', 'false') <> 'true' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_transfer_result->>'error', 'transfer_funds failed'),
        'wallet', v_transfer_result
      );
    END IF;

    UPDATE automated_payouts
    SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'wallet_debited', true,
        'wallet_debited_at', now(),
        'wallet_debited_amount', v_amount,
        'wallet_refund_applied', false
      ),
      updated_at = now()
    WHERE id = v_ap.id;
  END IF;

  v_provider_metadata := jsonb_build_object(
    'completed_via', 'manual_safehaven',
    'manual_payment_at', now(),
    'manual_external_reference', p_external_reference,
    'manual_notes', p_notes,
    'manual_hold', false
  );

  v_complete_result := public.complete_payout_installment(
    p_automated_payout_id,
    v_provider_metadata
  );

  IF COALESCE(v_complete_result->>'success', 'false') <> 'true' THEN
    RETURN v_complete_result;
  END IF;

  IF p_unpause_plan AND v_plan.status = 'paused' THEN
    UPDATE payout_plans
    SET status = 'active', updated_at = now()
    WHERE id = v_plan.id;
  END IF;

  RETURN v_complete_result || jsonb_build_object(
    'manual_completion', true,
    'external_reference', p_external_reference,
    'plan_unpaused', p_unpause_plan AND v_plan.status = 'paused'
  );
END;
$$;

COMMENT ON FUNCTION public.complete_manual_payout_installment(uuid, text, text, boolean) IS
  'After paying a user manually (e.g. SafeHaven dashboard), debit wallet if needed and call complete_payout_installment so the next scheduled payout can run.';

GRANT EXECUTE ON FUNCTION public.complete_manual_payout_installment(uuid, text, text, boolean) TO service_role;
