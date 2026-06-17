-- Align weekly and weekly_specific advancement with biweekly: derive the next occurrence from the
-- scheduled payout date we just honored (next_payout_date at call time), not only start_date + n×interval.
-- Prevents drift when clients set an initial next_payout_date that does not match start_date + n×7 days.

ALTER TABLE public.payout_plans
  ADD COLUMN IF NOT EXISTS day_of_week integer;

COMMENT ON COLUMN public.payout_plans.day_of_week IS
  'For weekly_specific: target weekday (0=Sunday .. 6=Saturday). Supplemented by metadata.dayOfWeek when null.';

CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
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
  v_anchor_date date;
  v_current_day_of_week integer;
  v_days_to_add integer;
  v_payout_time time;
  v_last_paid_date date;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;

  v_new_completed_count := v_plan.completed_payouts + 1;

  IF v_new_completed_count >= v_plan.duration THEN
    v_new_status := 'completed';
    v_next_date := NULL;
  ELSE
    v_new_status := v_plan.status;

    IF v_plan.frequency = 'custom' THEN
      v_last_paid_date := (v_plan.next_payout_date)::date;
      SELECT payout_date INTO v_next_date
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > COALESCE(v_last_paid_date, CURRENT_DATE - 1)
      ORDER BY payout_date
      LIMIT 1;
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
        v_anchor_date := (v_plan.next_payout_date)::date + INTERVAL '7 days';
        v_current_day_of_week := EXTRACT(DOW FROM v_anchor_date)::integer;
        v_days_to_add := (v_day_of_week - v_current_day_of_week + 7) % 7;
        v_next_date := v_anchor_date + (v_days_to_add || ' days')::interval;
      ELSE
        RAISE WARNING 'Plan % has weekly_specific frequency but invalid day_of_week (%). Falling back to weekly calculation.', p_plan_id, v_day_of_week;
        v_next_date := (v_plan.next_payout_date)::date + INTERVAL '7 days';
      END IF;
    ELSIF v_plan.frequency = 'weekly' THEN
      v_next_date := (v_plan.next_payout_date)::date + INTERVAL '7 days';
    ELSIF v_plan.frequency = 'biweekly' THEN
      v_next_date := (v_plan.next_payout_date)::date + INTERVAL '2 weeks';
    ELSE
      v_next_date := calculate_next_payout_date(
        v_plan.start_date,
        v_plan.frequency,
        v_new_completed_count
      );
    END IF;
  END IF;

  IF v_next_date IS NOT NULL THEN
    IF v_plan.next_payout_date IS NOT NULL THEN
      v_payout_time := v_plan.next_payout_date::time;
      IF v_payout_time = '00:00:00'::time THEN
        v_payout_time := '09:00:00'::time;
      END IF;
    ELSE
      v_payout_time := '09:00:00'::time;
    END IF;
    v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
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

COMMENT ON FUNCTION update_payout_plan_progress(uuid) IS
  'Updates payout plan progress and next_payout_date. Weekly / weekly_specific / biweekly: next anchor uses last scheduled payout date (+7 / snap DOW / +14). Custom: next row in custom_payout_dates after last paid. Other frequencies: calculate_next_payout_date.';
