-- Visibility-only materialization of every planned payout date per plan.
-- Does NOT change get_due_payout_plans or payout execution.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_plan_schedule_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid NOT NULL REFERENCES public.payout_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  installment_index integer NOT NULL CHECK (installment_index >= 0),
  scheduled_date date NOT NULL,
  scheduled_time time without time zone,
  amount numeric,
  source text NOT NULL CHECK (source IN ('custom', 'generated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_plan_schedule_dates_plan_index_unique
    UNIQUE (payout_plan_id, installment_index)
);

CREATE INDEX IF NOT EXISTS payout_plan_schedule_dates_user_date_idx
  ON public.payout_plan_schedule_dates (user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS payout_plan_schedule_dates_plan_date_idx
  ON public.payout_plan_schedule_dates (payout_plan_id, scheduled_date);

COMMENT ON TABLE public.payout_plan_schedule_dates IS
  'Visibility-only full payout schedule per plan. Custom rows mirror custom_payout_dates; recurring rows are generated. Not used by the payout engine.';

-- ---------------------------------------------------------------------------
-- 2. Refresh function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_payout_plan_schedule(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public.payout_plans%ROWTYPE;
  v_i integer;
  v_date date;
  v_time time;
  v_day_of_week integer;
  v_base_date date;
  v_current_dow integer;
  v_days_to_add integer;
  v_duration integer;
BEGIN
  SELECT * INTO v_plan FROM public.payout_plans WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.payout_plan_schedule_dates WHERE payout_plan_id = p_plan_id;

  -- Prefer Lagos wall-clock from next_payout_date; default 09:00
  IF v_plan.next_payout_date IS NOT NULL THEN
    v_time := (v_plan.next_payout_date AT TIME ZONE 'Africa/Lagos')::time;
  ELSE
    v_time := '09:00:00'::time;
  END IF;

  IF v_plan.frequency = 'custom' THEN
    INSERT INTO public.payout_plan_schedule_dates (
      payout_plan_id,
      user_id,
      installment_index,
      scheduled_date,
      scheduled_time,
      amount,
      source
    )
    SELECT
      p_plan_id,
      v_plan.user_id,
      (ROW_NUMBER() OVER (ORDER BY cpd.payout_date, cpd.created_at NULLS LAST) - 1)::integer,
      cpd.payout_date,
      COALESCE(cpd.payout_time, v_time),
      COALESCE(cpd.amount, v_plan.payout_amount),
      'custom'
    FROM public.custom_payout_dates cpd
    WHERE cpd.payout_plan_id = p_plan_id
    ORDER BY cpd.payout_date, cpd.created_at NULLS LAST;

    RETURN;
  END IF;

  v_duration := GREATEST(COALESCE(v_plan.duration, 0), 0);
  IF v_duration = 0 THEN
    RETURN;
  END IF;

  v_day_of_week := v_plan.day_of_week;
  IF v_day_of_week IS NULL AND v_plan.metadata IS NOT NULL THEN
    BEGIN
      v_day_of_week := (v_plan.metadata->>'dayOfWeek')::integer;
    EXCEPTION
      WHEN OTHERS THEN
        v_day_of_week := NULL;
    END;
  END IF;

  FOR v_i IN 0..(v_duration - 1) LOOP
    IF v_plan.frequency = 'weekly_specific'
       AND v_day_of_week IS NOT NULL
       AND v_day_of_week >= 0
       AND v_day_of_week <= 6 THEN
      v_base_date := v_plan.start_date + (v_i * INTERVAL '7 days');
      v_current_dow := EXTRACT(DOW FROM v_base_date)::integer;
      v_days_to_add := (v_day_of_week - v_current_dow + 7) % 7;
      v_date := (v_base_date + (v_days_to_add || ' days')::interval)::date;
    ELSE
      v_date := public.calculate_next_payout_date(v_plan.start_date, v_plan.frequency, v_i);
    END IF;

    INSERT INTO public.payout_plan_schedule_dates (
      payout_plan_id,
      user_id,
      installment_index,
      scheduled_date,
      scheduled_time,
      amount,
      source
    ) VALUES (
      p_plan_id,
      v_plan.user_id,
      v_i,
      v_date,
      v_time,
      v_plan.payout_amount,
      'generated'
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.refresh_payout_plan_schedule(uuid) IS
  'Rebuilds visibility-only payout_plan_schedule_dates for a plan from custom_payout_dates or generated frequency dates.';

GRANT EXECUTE ON FUNCTION public.refresh_payout_plan_schedule(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_refresh_payout_plan_schedule_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_payout_plan_schedule(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_plans_refresh_schedule ON public.payout_plans;
CREATE TRIGGER payout_plans_refresh_schedule
  AFTER INSERT OR UPDATE OF frequency, start_date, duration, day_of_week, payout_amount
  ON public.payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_payout_plan_schedule_from_plan();

CREATE OR REPLACE FUNCTION public.trg_refresh_payout_plan_schedule_from_custom_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  v_plan_id := COALESCE(NEW.payout_plan_id, OLD.payout_plan_id);
  IF v_plan_id IS NOT NULL THEN
    PERFORM public.refresh_payout_plan_schedule(v_plan_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_payout_dates_refresh_schedule ON public.custom_payout_dates;
CREATE TRIGGER custom_payout_dates_refresh_schedule
  AFTER INSERT OR UPDATE OR DELETE
  ON public.custom_payout_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_payout_plan_schedule_from_custom_dates();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.payout_plan_schedule_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout schedule dates" ON public.payout_plan_schedule_dates;
CREATE POLICY "Users can view own payout schedule dates"
  ON public.payout_plan_schedule_dates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all payout schedule dates" ON public.payout_plan_schedule_dates;
CREATE POLICY "Admins can view all payout schedule dates"
  ON public.payout_plan_schedule_dates
  FOR SELECT
  TO authenticated
  USING (public.is_user_admin((SELECT auth.uid())));

-- No user INSERT/UPDATE/DELETE — schedule is maintained by SECURITY DEFINER refresh.

GRANT SELECT ON public.payout_plan_schedule_dates TO authenticated;
GRANT ALL ON public.payout_plan_schedule_dates TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Status view (planned vs paid)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.payout_plan_schedule_with_status
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.payout_plan_id,
  s.user_id,
  s.installment_index,
  s.scheduled_date,
  s.scheduled_time,
  s.amount,
  s.source,
  s.created_at,
  s.updated_at,
  pp.name AS plan_name,
  pp.frequency AS plan_frequency,
  pp.status AS plan_status,
  pp.completed_payouts,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.automated_payouts ap
      WHERE ap.payout_plan_id = s.payout_plan_id
        AND ap.status = 'completed'
        AND (
          ap.installment_index = s.installment_index
          OR ap.scheduled_date = s.scheduled_date
        )
    ) THEN 'paid'
    WHEN s.installment_index < COALESCE(pp.completed_payouts, 0) THEN 'paid'
    ELSE 'planned'
  END AS payout_status
FROM public.payout_plan_schedule_dates s
JOIN public.payout_plans pp ON pp.id = s.payout_plan_id;

COMMENT ON VIEW public.payout_plan_schedule_with_status IS
  'Visibility helper: schedule dates with planned/paid status. Not used by the payout engine.';

GRANT SELECT ON public.payout_plan_schedule_with_status TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Backfill existing plans
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.payout_plans LOOP
    PERFORM public.refresh_payout_plan_schedule(r.id);
  END LOOP;
END;
$$;
