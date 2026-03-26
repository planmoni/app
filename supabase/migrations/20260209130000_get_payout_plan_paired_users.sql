/*
  Paired users list for plan owner.

  The plan owner needs to see who is watching their plan. profiles has RLS
  "view own profile" only, so a direct join from payout_plan_pairings to profiles
  returns null for other users' profiles. This SECURITY DEFINER function returns
  display info (id, first_name, last_name, email) for users paired to the plan,
  only when the caller is the plan owner.
*/

CREATE OR REPLACE FUNCTION public.get_payout_plan_paired_users(p_plan_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'first_name', coalesce(p.first_name, ''),
          'last_name', coalesce(p.last_name, ''),
          'email', p.email
        )
        ORDER BY pp.created_at
      )
      FROM payout_plan_pairings pp
      JOIN profiles p ON p.id = pp.paired_user_id
      WHERE pp.payout_plan_id = p_plan_id
        AND EXISTS (
          SELECT 1 FROM payout_plans pl
          WHERE pl.id = pp.payout_plan_id AND pl.user_id = auth.uid()
        )
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.get_payout_plan_paired_users(uuid) IS
  'Returns list of paired users (id, first_name, last_name, email) for a plan. Callable only by plan owner.';

GRANT EXECUTE ON FUNCTION public.get_payout_plan_paired_users(uuid) TO authenticated;
