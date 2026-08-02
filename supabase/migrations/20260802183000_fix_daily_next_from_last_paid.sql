-- Surgical fix: daily (and weekly) next_payout advances from last paid next_payout_date,
-- not start_date + completed_payouts. Prevents same-day double payout when first run was delayed.
-- Applied to production via MCP as fix_daily_next_from_last_paid + guard_due_plans_same_day_completed.
-- See live function bodies; do not overwrite get_due exclusions blindly.

-- (Canonical copy of what was applied — for repo history / local supabase.)

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
        RAISE WARNING 'Plan % has weekly_specific frequency but invalid day_of_week (%). Falling back to weekly calculation.', p_plan_id, v_day_of_week;
        v_next_date := v_plan.start_date + (v_new_completed_count * INTERVAL '1 week');
      END IF;
    ELSIF v_plan.frequency = 'biweekly' THEN
      v_next_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date + INTERVAL '2 weeks';
    ELSIF v_plan.frequency = 'weekly' THEN
      IF v_plan.next_payout_date IS NOT NULL THEN
        v_next_date := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::date + INTERVAL '7 days';
      ELSE
        v_next_date := calculate_next_payout_date(
          v_plan.start_date,
          v_plan.frequency,
          v_new_completed_count
        );
      END IF;
    ELSE
      v_next_date := calculate_next_payout_date(
        v_plan.start_date,
        v_plan.frequency,
        v_new_completed_count
      );
    END IF;
  END IF;

  IF v_next_date IS NOT NULL THEN
    IF v_plan.frequency = 'custom' THEN
      v_payout_time := COALESCE(v_custom_payout_time, '12:00:00'::time);
    ELSIF v_plan.payout_time IS NOT NULL THEN
      v_payout_time := v_plan.payout_time;
    ELSIF v_plan.next_payout_date IS NOT NULL THEN
      v_payout_time := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::time;
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
  'Updates payout plan progress. Daily/weekly/biweekly advance from last next_payout_date. Custom uses custom_payout_dates. Times are Africa/Lagos wall-clock.';

CREATE OR REPLACE FUNCTION public.get_due_payout_plans(check_at timestamp with time zone)
 RETURNS TABLE(
   plan_id uuid,
   user_id uuid,
   name text,
   payout_amount numeric,
   payout_account_id uuid,
   next_payout_date timestamp with time zone,
   completed_payouts integer,
   duration integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
              OR NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
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
  'Due plans excluding completed installments, same-calendar-day completed payouts, in-flight SafeHaven transfers, and failed rows pending manual review.';
