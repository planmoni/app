/*
  Payout reconciliation cron + support email plumbing

  1) Fix update_payout_plan_progress: do not reference payout_plans.payout_time
     (column was dropped; Aug 2 Lagos rewrite broke progress advances).
  2) Log table + RPCs for stuck-progress auto-fix and manual-action listing.
  3) pg_cron every 15m → reconcile-payout-plans edge function.
*/

-- ---------------------------------------------------------------------------
-- 1) Fix update_payout_plan_progress (no payout_plans.payout_time)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_payout_plan_progress(p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_date date;
  v_next_datetime timestamptz;
  v_new_completed_count integer;
  v_new_status text;
  v_day_of_week integer;
  v_base_date date;
  v_current_day_of_week integer;
  v_days_to_add integer;
  v_payout_time time;
  v_last_paid_date date;
  v_custom_payout_time time;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;

  v_new_completed_count := v_plan.completed_payouts + 1;

  IF v_new_completed_count >= v_plan.duration THEN
    v_new_status := 'completed';
    v_next_date := NULL;
    v_custom_payout_time := NULL;
  ELSE
    v_new_status := v_plan.status;

    IF v_plan.frequency = 'custom' THEN
      v_last_paid_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date;
      SELECT payout_date, payout_time INTO v_next_date, v_custom_payout_time
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
        AND payout_date > COALESCE(v_last_paid_date, CURRENT_DATE - 1)
      ORDER BY payout_date
      LIMIT 1;
    ELSIF v_plan.frequency = 'daily' THEN
      v_next_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date + INTERVAL '1 day';
    ELSIF v_plan.frequency = 'weekly_specific' THEN
      v_day_of_week := v_plan.day_of_week;

      IF v_day_of_week IS NULL AND v_plan.metadata IS NOT NULL THEN
        BEGIN
          v_day_of_week := (v_plan.metadata->>'dayOfWeek')::integer;
        EXCEPTION
          WHEN OTHERS THEN
            v_day_of_week := NULL;
        END;
      END IF;

      IF v_day_of_week IS NOT NULL AND v_day_of_week >= 0 AND v_day_of_week <= 6 THEN
        v_base_date := v_plan.start_date + (v_new_completed_count * INTERVAL '7 days');
        v_current_day_of_week := EXTRACT(DOW FROM v_base_date)::integer;
        v_days_to_add := (v_day_of_week - v_current_day_of_week + 7) % 7;
        v_next_date := v_base_date + (v_days_to_add || ' days')::interval;
      ELSE
        RAISE WARNING 'Plan % has weekly_specific frequency but invalid day_of_week (%). Falling back to weekly.', p_plan_id, v_day_of_week;
        v_next_date := v_plan.start_date + (v_new_completed_count * INTERVAL '1 week');
      END IF;
    ELSIF v_plan.frequency = 'biweekly' THEN
      v_next_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date + INTERVAL '2 weeks';
    ELSIF v_plan.frequency = 'weekly' THEN
      IF v_plan.next_payout_date IS NOT NULL THEN
        v_next_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date + INTERVAL '7 days';
      ELSE
        v_next_date := calculate_next_payout_date(
          v_plan.start_date, v_plan.frequency, v_new_completed_count
        );
      END IF;
    ELSE
      v_next_date := calculate_next_payout_date(
        v_plan.start_date, v_plan.frequency, v_new_completed_count
      );
    END IF;
  END IF;

  IF v_next_date IS NOT NULL THEN
    IF v_plan.frequency = 'custom' THEN
      v_payout_time := COALESCE(v_custom_payout_time, '12:00:00'::time);
    ELSIF v_plan.next_payout_date IS NOT NULL THEN
      v_payout_time := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::time;
      IF v_payout_time = '00:00:00'::time THEN
        v_payout_time := '09:00:00'::time;
      END IF;
    ELSE
      v_payout_time := '09:00:00'::time;
    END IF;
    v_next_datetime := (v_next_date + v_payout_time) AT TIME ZONE 'Africa/Lagos';
  ELSE
    v_next_datetime := NULL;
  END IF;

  UPDATE payout_plans
  SET
    completed_payouts = v_new_completed_count,
    next_payout_date = v_next_datetime,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_plan_id;
END;
$$;

COMMENT ON FUNCTION public.update_payout_plan_progress(uuid) IS
  'Updates payout plan progress. Daily/weekly/biweekly advance from last next_payout_date. Custom uses custom_payout_dates. Times are Africa/Lagos wall-clock. Does not use payout_plans.payout_time (column removed).';

-- ---------------------------------------------------------------------------
-- 2) Reconciliation log table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  fixed_count integer NOT NULL DEFAULT 0,
  manual_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_runs_ran_at
  ON public.payout_reconciliation_runs (ran_at DESC);

ALTER TABLE public.payout_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_reconciliation_runs'
      AND policyname = 'Service role can manage payout reconciliation runs'
  ) THEN
    CREATE POLICY "Service role can manage payout reconciliation runs"
      ON public.payout_reconciliation_runs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Auto-fix stuck progress (safe case only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_stuck_payout_progress(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_old_next timestamptz;
  v_old_completed integer;
  v_new_next timestamptz;
  v_new_completed integer;
  v_new_status text;
  v_fixed jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_uid uuid;
  v_count integer := 0;
  v_limit integer := GREATEST(COALESCE(p_limit, 100), 1);
BEGIN
  FOR r IN
    SELECT DISTINCT ON (pp.id)
      pp.id AS plan_id,
      pp.user_id,
      pp.name,
      pp.completed_payouts,
      pp.next_payout_date,
      ap.id AS ap_id,
      ap.installment_index,
      ap.scheduled_date
    FROM payout_plans pp
    JOIN automated_payouts ap
      ON ap.payout_plan_id = pp.id
     AND ap.status = 'completed'
     AND ap.scheduled_date = (pp.next_payout_date AT TIME ZONE 'Africa/Lagos')::date
     AND ap.installment_index = pp.completed_payouts
    WHERE pp.status = 'active'
      AND pp.next_payout_date IS NOT NULL
      AND pp.next_payout_date <= now()
      AND pp.completed_payouts < pp.duration
    ORDER BY pp.id, ap.created_at DESC NULLS LAST
    LIMIT v_limit
  LOOP
    v_old_next := r.next_payout_date;
    v_old_completed := r.completed_payouts;

    BEGIN
      PERFORM public.update_payout_plan_progress(r.plan_id);

      SELECT next_payout_date, completed_payouts, status
      INTO v_new_next, v_new_completed, v_new_status
      FROM payout_plans
      WHERE id = r.plan_id;

      v_fixed := v_fixed || jsonb_build_array(jsonb_build_object(
        'plan_id', r.plan_id,
        'user_id', r.user_id,
        'name', r.name,
        'ap_id', r.ap_id,
        'old_completed_payouts', v_old_completed,
        'new_completed_payouts', v_new_completed,
        'old_next_payout_date', v_old_next,
        'new_next_payout_date', v_new_next,
        'new_status', v_new_status
      ));

      IF NOT (r.user_id = ANY (v_user_ids)) THEN
        v_user_ids := array_append(v_user_ids, r.user_id);
      END IF;

      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'plan_id', r.plan_id,
          'user_id', r.user_id,
          'ap_id', r.ap_id,
          'error', SQLERRM
        ));
    END;
  END LOOP;

  FOREACH v_uid IN ARRAY v_user_ids
  LOOP
    BEGIN
      PERFORM public.recalculate_locked_balance(v_uid);
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_uid,
          'error', 'recalculate_locked_balance: ' || SQLERRM
        ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'fixed_count', v_count,
    'fixed', v_fixed,
    'errors', v_errors,
    'user_ids_recalculated', to_jsonb(v_user_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.reconcile_stuck_payout_progress(integer) IS
  'Auto-advances plans where a completed automated_payout already covers the current installment but next_payout_date was not advanced. Recalculates locked balance for affected users.';

REVOKE ALL ON FUNCTION public.reconcile_stuck_payout_progress(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_payout_progress(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) List payouts needing manual ops / bank payment
-- ---------------------------------------------------------------------------

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

COMMENT ON FUNCTION public.list_payouts_needing_manual_action() IS
  'Active past-due plans blocked from auto payout because the current installment failed with manual_hold, transfer_reference, or unreimbursed wallet debit.';

REVOKE ALL ON FUNCTION public.list_payouts_needing_manual_action() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_payouts_needing_manual_action() TO service_role;

-- ---------------------------------------------------------------------------
-- 5) pg_cron every 15 minutes
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-payout-plans-15m') THEN
    PERFORM cron.unschedule('reconcile-payout-plans-15m');
  END IF;

  PERFORM cron.schedule(
    'reconcile-payout-plans-15m',
    '*/15 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_internal_supabase_url() || '/functions/v1/reconcile-payout-plans',
      headers := public.get_internal_supabase_auth_headers(),
      body := '{}'::jsonb
    );
    $cron$
  );
END;
$$;
