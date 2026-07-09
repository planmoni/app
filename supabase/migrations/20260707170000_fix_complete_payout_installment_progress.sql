-- Fix complete_payout_installment: when automated_payout is already 'completed'
-- (e.g. process-due-payouts updated status before calling this RPC), load the plan
-- and advance next_payout_date / completed_payouts when the installment matches.

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
  v_should_advance boolean;
BEGIN
  SELECT * INTO v_ap FROM automated_payouts WHERE id = p_automated_payout_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'automated_payout not found');
  END IF;

  SELECT * INTO v_plan FROM payout_plans WHERE id = v_ap.payout_plan_id FOR UPDATE;
  v_installment := COALESCE(v_ap.installment_index, v_plan.completed_payouts);
  v_should_advance := v_plan.completed_payouts = v_installment;

  IF v_ap.status = 'completed' THEN
    IF v_should_advance THEN
      PERFORM public.update_payout_plan_progress(v_plan.id);
      PERFORM public.recalculate_locked_balance(v_plan.user_id);
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'automated_payout_id', v_ap.id,
      'installment_index', v_installment,
      'plan_advanced', v_should_advance
    );
  END IF;

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

  IF v_should_advance THEN
    PERFORM public.update_payout_plan_progress(v_plan.id);
  END IF;

  PERFORM public.recalculate_locked_balance(v_plan.user_id);

  RETURN jsonb_build_object(
    'success', true,
    'completed', true,
    'automated_payout_id', p_automated_payout_id,
    'installment_index', v_installment,
    'plan_id', v_plan.id,
    'plan_advanced', v_should_advance
  );
END;
$$;

COMMENT ON FUNCTION public.complete_payout_installment(uuid, jsonb) IS
  'Marks installment completed and advances plan when installment_index matches completed_payouts. Idempotent when already completed.';

GRANT EXECUTE ON FUNCTION public.complete_payout_installment(uuid, jsonb) TO service_role;

-- Plans with a completed installment but stale plan progress were hidden from the cron
-- (NOT EXISTS matched status = 'completed'). Include them so claim + repair can advance.
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
    -- Only skip when SafeHaven transfer is already in-flight for the current installment.
    -- Completed installments are handled by claim → complete_payout_installment (repair path).
    AND NOT EXISTS (
      SELECT 1
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.installment_index = pp.completed_payouts
        AND ap.status IN ('pending', 'processing')
        AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
        AND COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
    );
END;
$$;

COMMENT ON FUNCTION public.get_due_payout_plans(timestamptz) IS
  'Due plans excluding installments with an in-flight SafeHaven transfer. Completed-but-not-advanced plans are included for repair.';

GRANT EXECUTE ON FUNCTION public.get_due_payout_plans(timestamptz) TO authenticated, service_role;
