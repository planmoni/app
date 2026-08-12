/*
  After a failed payout is refunded to locked balance:
  - 1st failure: allow automatic retry (do not treat transfer_reference as a permanent block)
  - 2nd failure: manual_hold; user is told to contact support for a manual transfer

  Also: claim_payout_installment must re-debit after refund with a new payment reference.
*/

-- ---------------------------------------------------------------------------
-- get_due: allow retry when failed + refunded + not manual_hold
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_due_payout_plans(check_at timestamptz)
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  payout_account_id uuid,
  next_payout_date timestamptz,
  completed_payouts integer,
  duration integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id AS plan_id,
    pp.user_id,
    pp.name,
    pp.payout_amount,
    pp.payout_account_id,
    pp.next_payout_date,
    pp.completed_payouts,
    pp.duration
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= check_at
    AND pp.completed_payouts < pp.duration
    AND pp.payout_account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.status = 'completed'
        AND ap.scheduled_date = (pp.next_payout_date AT TIME ZONE 'Africa/Lagos')::date
    )
    AND NOT EXISTS (
      SELECT 1
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.installment_index = pp.completed_payouts
        AND (
          ap.status = 'completed'
          OR (
            ap.status IN ('pending', 'processing')
            AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
            AND COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
          )
          OR (
            ap.status = 'failed'
            AND (
              COALESCE((ap.metadata->>'manual_hold')::boolean, false)
              OR (
                NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
                AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
              )
              OR (
                COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
                AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
              )
            )
          )
        )
    );
END;
$$;

COMMENT ON FUNCTION public.get_due_payout_plans(timestamptz) IS
  'Due plans excluding completed installments, in-flight SafeHaven transfers, unreimbursed failed debits, and manual_hold. Failed+refunded installments are eligible for one automatic retry.';

-- ---------------------------------------------------------------------------
-- claim: after refund, re-debit with a fresh payment reference
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_payout_installment(
  p_plan_id uuid,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_installment integer;
  v_amount numeric;
  v_scheduled date;
  v_ap public.automated_payouts%ROWTYPE;
  v_ref text;
  v_tx_id uuid;
  v_transfer_result jsonb;
  v_wallet_debited boolean;
  v_refunded boolean;
  v_manual_hold boolean;
  v_retry_after_refund boolean := false;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  IF v_plan.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan is not active', 'skip', true);
  END IF;

  IF v_plan.completed_payouts >= v_plan.duration THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan is already completed', 'skip', true);
  END IF;

  IF v_plan.payout_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout account not configured');
  END IF;

  v_installment := v_plan.completed_payouts;
  v_amount := public.resolve_payout_installment_amount(p_plan_id, v_installment);

  IF v_plan.frequency = 'custom' THEN
    SELECT cpd.payout_date
    INTO v_scheduled
    FROM custom_payout_dates cpd
    WHERE cpd.payout_plan_id = p_plan_id
    ORDER BY cpd.payout_date, cpd.payout_time
    OFFSET v_installment
    LIMIT 1;
  ELSE
    v_scheduled := (v_plan.next_payout_date)::date;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not resolve installment amount');
  END IF;

  SELECT * INTO v_ap
  FROM automated_payouts
  WHERE payout_plan_id = p_plan_id
    AND installment_index = v_installment
  FOR UPDATE;

  IF FOUND THEN
    IF v_ap.status = 'completed' THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_completed', true,
        'automated_payout_id', v_ap.id,
        'payment_reference', v_ap.transfer_reference,
        'amount', v_ap.amount,
        'installment_index', v_installment,
        'user_id', v_plan.user_id,
        'may_call_safehaven', false
      );
    END IF;

    v_wallet_debited := COALESCE((v_ap.metadata->>'wallet_debited')::boolean, false);
    v_refunded := COALESCE((v_ap.metadata->>'wallet_refund_applied')::boolean, false);
    v_manual_hold := COALESCE((v_ap.metadata->>'manual_hold')::boolean, false);

    IF v_manual_hold THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Installment on manual hold; contact support for a manual transfer',
        'automated_payout_id', v_ap.id,
        'skip', true
      );
    END IF;

    IF v_wallet_debited AND NOT v_refunded THEN
      SELECT t.id INTO v_tx_id
      FROM transactions t
      WHERE t.type = 'payout'
        AND t.metadata->>'automated_payout_id' = v_ap.id::text
      ORDER BY t.created_at
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', true,
        'already_claimed', true,
        'automated_payout_id', v_ap.id,
        'transaction_id', v_tx_id,
        'payment_reference', COALESCE(v_ap.transfer_reference, v_ap.metadata->>'payment_reference'),
        'amount', COALESCE((v_ap.metadata->>'wallet_debited_amount')::numeric, v_ap.amount),
        'installment_index', v_installment,
        'user_id', v_plan.user_id,
        'may_call_safehaven', COALESCE((v_ap.metadata->>'safehaven_transfer_initiated')::boolean, false) = false
      );
    END IF;

    IF v_ap.status = 'failed' AND v_refunded THEN
      v_retry_after_refund := true;
    ELSIF v_ap.status = 'failed' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Installment in failed state without refund; manual review required',
        'automated_payout_id', v_ap.id
      );
    END IF;
  ELSE
    v_ref := COALESCE(
      p_payment_reference,
      format('AUTO_%s_i%s_%s', p_plan_id, v_installment, (extract(epoch from clock_timestamp()) * 1000)::bigint)
    );

    INSERT INTO automated_payouts (
      payout_plan_id,
      user_id,
      scheduled_date,
      installment_index,
      amount,
      status,
      transfer_reference,
      payout_account_id,
      metadata
    ) VALUES (
      p_plan_id,
      v_plan.user_id,
      COALESCE(v_scheduled, CURRENT_DATE),
      v_installment,
      v_amount,
      'processing',
      v_ref,
      v_plan.payout_account_id,
      jsonb_build_object('installment_index', v_installment, 'payment_reference', v_ref)
    )
    RETURNING * INTO v_ap;
  END IF;

  IF v_retry_after_refund THEN
    v_ref := format(
      'AUTO_%s_i%s_%s',
      p_plan_id,
      v_installment,
      (extract(epoch from clock_timestamp()) * 1000)::bigint
    );
  ELSE
    v_ref := COALESCE(v_ap.transfer_reference, p_payment_reference);
    IF v_ref IS NULL OR v_ref = '' THEN
      v_ref := format(
        'AUTO_%s_i%s_%s',
        p_plan_id,
        v_installment,
        (extract(epoch from clock_timestamp()) * 1000)::bigint
      );
    END IF;
  END IF;

  PERFORM set_wallet_op_context(
    'transfer_funds',
    'claim_payout_installment',
    v_ap.id::text,
    jsonb_build_object(
      'automated_payout_id', v_ap.id,
      'plan_id', p_plan_id,
      'installment_index', v_installment,
      'amount', v_amount,
      'retry_after_refund', v_retry_after_refund
    )
  );

  v_transfer_result := public.transfer_funds(v_plan.user_id, v_amount);

  IF COALESCE(v_transfer_result->>'success', 'false') <> 'true' THEN
    UPDATE automated_payouts
    SET status = 'failed',
        error_message = v_transfer_result->>'error',
        updated_at = now()
    WHERE id = v_ap.id;

    RETURN jsonb_build_object('success', false, 'error', v_transfer_result->>'error');
  END IF;

  UPDATE automated_payouts
  SET
    status = 'processing',
    amount = v_amount,
    transfer_reference = v_ref,
    retry_count = CASE
      WHEN v_retry_after_refund THEN COALESCE(retry_count, 0) + 1
      ELSE COALESCE(retry_count, 0)
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'wallet_debited', true,
      'wallet_debited_at', now(),
      'wallet_debited_amount', v_amount,
      'payment_reference', v_ref,
      'installment_index', v_installment,
      'wallet_refund_applied', false,
      'safehaven_transfer_initiated', false,
      'retry_after_refund', v_retry_after_refund
    ),
    updated_at = now()
  WHERE id = v_ap.id
  RETURNING * INTO v_ap;

  SELECT t.id INTO v_tx_id
  FROM transactions t
  WHERE t.type = 'payout'
    AND t.metadata->>'automated_payout_id' = v_ap.id::text
    AND t.reference = v_ref
  LIMIT 1;

  IF v_tx_id IS NULL THEN
    BEGIN
      INSERT INTO transactions (
        user_id, type, amount, status, source, destination,
        reference, payout_plan_id, description, metadata
      ) VALUES (
        v_plan.user_id,
        'payout',
        v_amount,
        'pending',
        'Wallet',
        'Bank Transfer',
        v_ref,
        p_plan_id,
        format('Automated payout installment %s/%s', v_installment + 1, v_plan.duration),
        jsonb_build_object(
          'automated_payout_id', v_ap.id,
          'installment_index', v_installment,
          'payout_plan_id', p_plan_id,
          'source', 'claim_payout_installment',
          'retry_after_refund', v_retry_after_refund
        )
      )
      RETURNING id INTO v_tx_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT t.id INTO v_tx_id
        FROM transactions t
        WHERE t.type = 'payout'
          AND t.metadata->>'automated_payout_id' = v_ap.id::text
        ORDER BY t.created_at DESC
        LIMIT 1;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claimed', true,
    'automated_payout_id', v_ap.id,
    'transaction_id', v_tx_id,
    'payment_reference', v_ref,
    'amount', v_amount,
    'installment_index', v_installment,
    'user_id', v_plan.user_id,
    'may_call_safehaven', true,
    'retry_after_refund', v_retry_after_refund
  );
END;
$$;

COMMENT ON FUNCTION public.claim_payout_installment(uuid, text) IS
  'Atomically claims one plan installment: transfer_funds + automated_payouts + transactions. After a refunded failure, re-debits with a new payment reference for automatic retry.';

GRANT EXECUTE ON FUNCTION public.claim_payout_installment(uuid, text) TO service_role;

-- Keep list_payouts aligned: refunded first fail is not a manual ops item
CREATE OR REPLACE FUNCTION public.list_payouts_needing_manual_action()
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  plan_name text,
  amount numeric,
  next_payout_date timestamptz,
  ap_id uuid,
  ap_status text,
  transfer_reference text,
  reason text,
  suggested_action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id AS plan_id,
    pp.user_id,
    pp.name AS plan_name,
    COALESCE(ap.amount, pp.payout_amount) AS amount,
    pp.next_payout_date,
    ap.id AS ap_id,
    ap.status AS ap_status,
    ap.transfer_reference,
    CASE
      WHEN COALESCE((ap.metadata->>'manual_hold')::boolean, false) THEN 'manual_hold'
      WHEN NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
           AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
        THEN 'has_transfer_reference'
      WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
           AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
        THEN 'wallet_debited_no_refund'
      ELSE 'failed_manual_review'
    END AS reason,
    CASE
      WHEN COALESCE((ap.metadata->>'manual_hold')::boolean, false) THEN
        'User notified to contact support. Pay bank if needed then complete_manual_payout_installment.'
      WHEN NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
           AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false) THEN
        'If bank already paid: complete_manual_payout_installment. Else pay via SafeHaven then complete.'
      WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
           AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false) THEN
        'Wallet debited without refund — do not auto-retry; reconcile wallet then complete or refund.'
      ELSE
        'Manual review required before retry.'
    END AS suggested_action
  FROM payout_plans pp
  JOIN automated_payouts ap
    ON ap.payout_plan_id = pp.id
   AND ap.installment_index = pp.completed_payouts
   AND ap.status = 'failed'
   AND (
     COALESCE((ap.metadata->>'manual_hold')::boolean, false)
     OR (
       NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
       AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
     )
     OR (
       COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
       AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
     )
   )
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= now()
    AND pp.completed_payouts < pp.duration
  ORDER BY pp.next_payout_date ASC;
END;
$$;
