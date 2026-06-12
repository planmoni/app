-- Fix PostgREST PGRST203: ambiguous get_due_payout_plans overloads.
-- Causes: (1) old date overload coexisting with timestamptz overload;
--         (2) DEFAULT on check_at makes PostgREST expose both () and (check_at) candidates.
-- Drop every signature and recreate a single required-parameter version.

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
        AND ap.scheduled_date = pp.next_payout_date
        AND ap.status IN ('pending', 'processing', 'completed')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_payout_plans(timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_due_payout_plans(timestamptz) IS
  'Returns active payout plans whose next_payout_date is due at or before check_at. Callers must pass check_at (e.g. now()).';
