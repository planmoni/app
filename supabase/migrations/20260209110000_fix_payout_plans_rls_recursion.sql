/*
  Fix infinite recursion between payout_plans and payout_plan_pairings RLS.

  Cause: payout_plans SELECT policy uses a subquery on payout_plan_pairings;
  payout_plan_pairings "Plan owner" policy uses a subquery on payout_plans → recursion.

  Fix: Use a SECURITY DEFINER function to check plan ownership so the pairings
  policy does not trigger payout_plans RLS when evaluated.
*/

-- Function: returns true if the given plan_id is owned by the current user.
-- SECURITY DEFINER so it reads payout_plans without going through RLS (breaks cycle).
CREATE OR REPLACE FUNCTION public.is_payout_plan_owner(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payout_plans
    WHERE id = p_plan_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_payout_plan_owner(uuid) TO authenticated;

-- Replace the "Plan owner can view pairings" policy so it does not reference payout_plans.
DROP POLICY IF EXISTS "Plan owner can view pairings for their plans" ON payout_plan_pairings;

CREATE POLICY "Plan owner can view pairings for their plans"
  ON payout_plan_pairings
  FOR SELECT
  TO authenticated
  USING (public.is_payout_plan_owner(payout_plan_id));
