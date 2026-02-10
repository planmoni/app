-- Fix: weekly_specific next_payout_date was skipping one week (e.g. pay Monday then next set to Monday 2 weeks later).
-- Cause: When base_date was already the target weekday (e.g. next Monday), the code forced +7 days.
-- Fix: When days_to_add = 0, use base_date as next date; do not add 7 days.

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
  v_base_date date;
  v_current_day_of_week integer;
  v_days_to_add integer;
  v_payout_time time;
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
      SELECT payout_date INTO v_next_date
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > CURRENT_DATE
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
        v_base_date := v_plan.start_date + (v_new_completed_count * INTERVAL '7 days');
        v_current_day_of_week := EXTRACT(DOW FROM v_base_date)::integer;
        v_days_to_add := (v_day_of_week - v_current_day_of_week + 7) % 7;
        -- When 0, base_date is already the next occurrence (e.g. next Monday). Do NOT add 7.
        v_next_date := v_base_date + (v_days_to_add || ' days')::interval;
      ELSE
        RAISE WARNING 'Plan % has weekly_specific frequency but invalid day_of_week (%). Falling back to weekly calculation.', p_plan_id, v_day_of_week;
        v_next_date := v_plan.start_date + (v_new_completed_count * INTERVAL '1 week');
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
  'Updates payout plan progress and next_payout_date. For weekly_specific, when base date is already the target weekday (days_to_add=0), uses that date instead of adding 7 days.';
