-- Custom payout fixes: installment-level idempotency, custom locked balance, claim/complete/fail RPCs.
-- Prevents double SafeHaven sends (e.g. retry on next calendar day with new reference).

-- =============================================================================
-- 1. installment_index on automated_payouts (one row per plan installment)
-- =============================================================================
ALTER TABLE public.automated_payouts
  ADD COLUMN IF NOT EXISTS installment_index integer;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY payout_plan_id
      ORDER BY scheduled_date ASC NULLS LAST, created_at ASC
    ) - 1 AS idx
  FROM public.automated_payouts
)
UPDATE public.automated_payouts ap
SET installment_index = ranked.idx
FROM ranked
WHERE ap.id = ranked.id
  AND ap.installment_index IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS automated_payouts_plan_installment_unique
  ON public.automated_payouts (payout_plan_id, installment_index)
  WHERE installment_index IS NOT NULL;

COMMENT ON COLUMN public.automated_payouts.installment_index IS
  '0-based installment number (matches payout_plans.completed_payouts at claim time). Unique per plan.';

-- One payout transaction per automated_payout row.
-- Existing production data may have duplicate links (e.g. retry created a second tx for same ap id).
-- Keep the canonical row per automated_payout_id; unlink duplicates before creating the index.
WITH ranked_payout_tx AS (
  SELECT
    t.id,
    t.metadata->>'automated_payout_id' AS ap_id,
    ROW_NUMBER() OVER (
      PARTITION BY t.metadata->>'automated_payout_id'
      ORDER BY
        CASE t.status
          WHEN 'completed' THEN 0
          WHEN 'pending'   THEN 1
          WHEN 'refunded'  THEN 2
          WHEN 'failed'    THEN 3
          ELSE 4
        END,
        t.updated_at DESC NULLS LAST,
        t.created_at DESC
    ) AS rn
  FROM public.transactions t
  WHERE t.type = 'payout'
    AND t.metadata->>'automated_payout_id' IS NOT NULL
    AND btrim(t.metadata->>'automated_payout_id') <> ''
)
UPDATE public.transactions t
SET
  metadata = COALESCE(t.metadata, '{}'::jsonb) - 'automated_payout_id'
    || jsonb_build_object(
      'superseded_automated_payout_id', ranked_payout_tx.ap_id,
      'dedupe_reason', 'duplicate_automated_payout_tx_link'
    ),
  updated_at = now()
FROM ranked_payout_tx
WHERE t.id = ranked_payout_tx.id
  AND ranked_payout_tx.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_payout_per_automated_payout
  ON public.transactions ((metadata->>'automated_payout_id'))
  WHERE type = 'payout'
    AND metadata->>'automated_payout_id' IS NOT NULL
    AND btrim(metadata->>'automated_payout_id') <> '';

-- =============================================================================
-- 2. Remaining locked amount (custom-aware)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.plan_locked_remaining_for_plan(p_plan_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_net numeric;
  v_remaining numeric;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_net := COALESCE(
    v_plan.net_payout_amount,
    v_plan.total_amount - COALESCE(v_plan.fee_amount, 0),
    v_plan.total_amount
  );

  IF v_plan.frequency = 'custom' THEN
    SELECT COALESCE(SUM(sub.amt), 0)
    INTO v_remaining
    FROM (
      SELECT COALESCE(cpd.amount, v_plan.payout_amount) AS amt
      FROM custom_payout_dates cpd
      WHERE cpd.payout_plan_id = p_plan_id
      ORDER BY cpd.payout_date, cpd.payout_time
      OFFSET COALESCE(v_plan.completed_payouts, 0)
    ) sub;

    RETURN GREATEST(0, v_remaining);
  END IF;

  RETURN GREATEST(0, v_net - (COALESCE(v_plan.completed_payouts, 0) * COALESCE(v_plan.payout_amount, 0)));
END;
$$;

COMMENT ON FUNCTION public.plan_locked_remaining_for_plan(uuid) IS
  'Net locked funds still owed for an active/paused plan. Custom: sum of remaining custom_payout_dates rows.';

-- =============================================================================
-- 3. recalculate_locked_balance — sum plan_locked_remaining_for_plan per active plan
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_wallet wallets%ROWTYPE;
BEGIN
  PERFORM allow_wallet_update();

  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  SELECT COALESCE(SUM(public.plan_locked_remaining_for_plan(pp.id)), 0)
  INTO v_calculated_locked_balance
  FROM payout_plans pp
  WHERE pp.user_id = arg_user_id
    AND pp.status IN ('active', 'paused')
    AND public.plan_locked_remaining_for_plan(pp.id) > 0;

  IF v_calculated_locked_balance < 0 THEN
    v_calculated_locked_balance := 0;
  END IF;
  IF v_calculated_locked_balance > v_wallet.balance THEN
    v_calculated_locked_balance := GREATEST(0, v_wallet.balance);
  END IF;

  UPDATE wallets
  SET
    locked_balance = v_calculated_locked_balance,
    available_balance = GREATEST(0, balance - v_calculated_locked_balance),
    updated_at = now()
  WHERE user_id = arg_user_id;

  SELECT balance, locked_balance, (balance - locked_balance)
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets
  WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance,
    'calculated_locked_balance', v_calculated_locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.recalculate_locked_balance(uuid) IS
  'Recalculates locked_balance from active/paused plans using plan_locked_remaining_for_plan (custom-aware).';

-- =============================================================================
-- 4. Resolve installment amount (custom per-row or plan.payout_amount)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_payout_installment_amount(
  p_plan_id uuid,
  p_installment_index integer
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_amount numeric;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_plan.frequency = 'custom' THEN
    SELECT COALESCE(cpd.amount, v_plan.payout_amount)
    INTO v_amount
    FROM custom_payout_dates cpd
    WHERE cpd.payout_plan_id = p_plan_id
    ORDER BY cpd.payout_date, cpd.payout_time
    OFFSET p_installment_index
    LIMIT 1;
    RETURN v_amount;
  END IF;

  RETURN v_plan.payout_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_payout_installment_amount(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_locked_remaining_for_plan(uuid) TO authenticated, service_role;

-- =============================================================================
-- 5. claim_payout_installment — atomic wallet debit + automated_payout + transaction
-- =============================================================================
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

    IF v_wallet_debited THEN
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

    IF v_ap.status = 'failed' AND COALESCE((v_ap.metadata->>'wallet_refund_applied')::boolean, false) THEN
      NULL;
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

  v_ref := COALESCE(v_ap.transfer_reference, p_payment_reference);
  IF v_ref IS NULL OR v_ref = '' THEN
    v_ref := format('AUTO_%s_i%s_%s', p_plan_id, v_installment, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  END IF;

  PERFORM set_wallet_op_context(
    'transfer_funds',
    'claim_payout_installment',
    v_ap.id::text,
    jsonb_build_object(
      'automated_payout_id', v_ap.id,
      'plan_id', p_plan_id,
      'installment_index', v_installment,
      'amount', v_amount
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
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'wallet_debited', true,
      'wallet_debited_at', now(),
      'wallet_debited_amount', v_amount,
      'payment_reference', v_ref,
      'installment_index', v_installment
    ),
    updated_at = now()
  WHERE id = v_ap.id
  RETURNING * INTO v_ap;

  SELECT t.id INTO v_tx_id
  FROM transactions t
  WHERE t.type = 'payout'
    AND t.metadata->>'automated_payout_id' = v_ap.id::text
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
          'source', 'claim_payout_installment'
        )
      )
      RETURNING id INTO v_tx_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT t.id INTO v_tx_id
        FROM transactions t
        WHERE t.type = 'payout'
          AND t.metadata->>'automated_payout_id' = v_ap.id::text
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
    'may_call_safehaven', true
  );
END;
$$;

COMMENT ON FUNCTION public.claim_payout_installment(uuid, text) IS
  'Atomically claims one plan installment: transfer_funds + automated_payouts + transactions. Idempotent per installment_index.';

GRANT EXECUTE ON FUNCTION public.claim_payout_installment(uuid, text) TO service_role;

-- =============================================================================
-- 6. Mark SafeHaven transfer initiated (after POST /transfers)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_payout_safehaven_initiated(
  p_automated_payout_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE automated_payouts
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('safehaven_transfer_initiated', true)
      || COALESCE(p_metadata, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_automated_payout_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payout_safehaven_initiated(uuid, jsonb) TO service_role;

-- =============================================================================
-- 7. complete_payout_installment — idempotent success path
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_payout_installment(
  p_automated_payout_id uuid,
  p_provider_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap automated_payouts%ROWTYPE;
  v_plan payout_plans%ROWTYPE;
  v_installment integer;
BEGIN
  SELECT * INTO v_ap FROM automated_payouts WHERE id = p_automated_payout_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'automated_payout not found');
  END IF;

  IF v_ap.status = 'completed' THEN
    IF v_plan.completed_payouts = v_installment THEN
      PERFORM public.update_payout_plan_progress(v_plan.id);
      PERFORM public.recalculate_locked_balance(v_plan.user_id);
    END IF;
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'automated_payout_id', v_ap.id);
  END IF;

  SELECT * INTO v_plan FROM payout_plans WHERE id = v_ap.payout_plan_id FOR UPDATE;

  v_installment := COALESCE(v_ap.installment_index, v_plan.completed_payouts);

  UPDATE automated_payouts
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    transferred_at = COALESCE(transferred_at, now()),
    amount = COALESCE((metadata->>'wallet_debited_amount')::numeric, amount),
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_provider_metadata, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_automated_payout_id;

  UPDATE transactions
  SET
    status = 'completed',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_provider_metadata, '{}'::jsonb)
  WHERE type = 'payout'
    AND metadata->>'automated_payout_id' = p_automated_payout_id::text
    AND status IS DISTINCT FROM 'completed';

  IF v_plan.completed_payouts = v_installment THEN
    PERFORM public.update_payout_plan_progress(v_plan.id);
  END IF;

  PERFORM public.recalculate_locked_balance(v_plan.user_id);

  RETURN jsonb_build_object(
    'success', true,
    'completed', true,
    'automated_payout_id', p_automated_payout_id,
    'installment_index', v_installment,
    'plan_id', v_plan.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_payout_installment(uuid, jsonb) TO service_role;

-- =============================================================================
-- 8. fail_payout_installment — refund wallet when SafeHaven definitively failed
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fail_payout_installment(
  p_automated_payout_id uuid,
  p_reason text DEFAULT 'Transfer failed',
  p_provider_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap automated_payouts%ROWTYPE;
  v_refund_amount numeric;
  v_refund_result jsonb;
BEGIN
  SELECT * INTO v_ap FROM automated_payouts WHERE id = p_automated_payout_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'automated_payout not found');
  END IF;

  IF v_ap.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot fail a completed installment');
  END IF;

  IF COALESCE((v_ap.metadata->>'wallet_debited')::boolean, false)
     AND COALESCE((v_ap.metadata->>'wallet_refund_applied')::boolean, false) = false THEN
    v_refund_amount := COALESCE((v_ap.metadata->>'wallet_debited_amount')::numeric, v_ap.amount);
    v_refund_result := public.refund_payout_wallet_debit(v_ap.user_id, v_refund_amount);

    IF COALESCE(v_refund_result->>'success', 'false') <> 'true' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_refund_result->>'error', 'refund failed')
      );
    END IF;
  END IF;

  UPDATE automated_payouts
  SET
    status = 'failed',
    error_message = p_reason,
    completed_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'wallet_refund_applied', true,
      'safehaven_failure_reason', p_reason
    ) || COALESCE(p_provider_metadata, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_automated_payout_id;

  UPDATE transactions
  SET
    status = 'refunded',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'safehaven_failure_reason', p_reason
    ) || COALESCE(p_provider_metadata, '{}'::jsonb)
  WHERE type = 'payout'
    AND metadata->>'automated_payout_id' = p_automated_payout_id::text
    AND status IN ('pending', 'failed');

  PERFORM public.recalculate_locked_balance(v_ap.user_id);

  RETURN jsonb_build_object('success', true, 'failed', true, 'automated_payout_id', p_automated_payout_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_payout_installment(uuid, text, jsonb) TO service_role;

-- =============================================================================
-- 9. get_due_payout_plans — skip installments already completed or in-flight at SafeHaven
-- =============================================================================
-- Must DROP first: live DB may have DEFAULT on check_at; CREATE OR REPLACE cannot remove defaults.
DROP FUNCTION IF EXISTS public.get_due_payout_plans(date);
DROP FUNCTION IF EXISTS public.get_due_payout_plans(timestamptz);

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
        AND ap.installment_index = pp.completed_payouts
        AND (
          ap.status = 'completed'
          OR (
            ap.status IN ('pending', 'processing')
            AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
            AND COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
          )
        )
    );
END;
$$;

COMMENT ON FUNCTION public.get_due_payout_plans(timestamptz) IS
  'Due plans excluding installments already completed or claimed with SafeHaven initiated.';

GRANT EXECUTE ON FUNCTION public.get_due_payout_plans(timestamptz) TO authenticated, service_role;
