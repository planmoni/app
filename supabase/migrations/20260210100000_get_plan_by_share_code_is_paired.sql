-- Add is_paired to get_plan_by_share_code so clients can block adding the same code twice.
CREATE OR REPLACE FUNCTION get_plan_by_share_code(p_share_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_name text;
  v_payout_amount numeric;
  v_frequency text;
  v_next_payout_date timestamptz;
  v_creator_first_name text;
  v_status text;
  v_is_owner boolean;
  v_is_paired boolean;
BEGIN
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid code');
  END IF;

  SELECT pp.id, pp.name, pp.payout_amount, pp.frequency, pp.next_payout_date, pp.status,
         COALESCE(p.first_name, 'Someone')
  INTO v_plan_id, v_name, v_payout_amount, v_frequency, v_next_payout_date, v_status, v_creator_first_name
  FROM payout_plans pp
  LEFT JOIN profiles p ON p.id = pp.user_id
  WHERE pp.share_code = trim(p_share_code)
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Plan not found or link expired');
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('found', false, 'error', 'This plan is no longer active');
  END IF;

  v_is_owner := (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM payout_plans WHERE id = v_plan_id AND user_id = auth.uid()));
  v_is_paired := (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM payout_plan_pairings WHERE payout_plan_id = v_plan_id AND paired_user_id = auth.uid()));

  RETURN jsonb_build_object(
    'found', true,
    'id', v_plan_id,
    'name', v_name,
    'payout_amount', v_payout_amount,
    'frequency', v_frequency,
    'next_payout_date', v_next_payout_date,
    'creator_first_name', v_creator_first_name,
    'is_owner', v_is_owner,
    'is_paired', v_is_paired
  );
END;
$$;

COMMENT ON FUNCTION get_plan_by_share_code(text) IS 'Returns plan info by share code. Includes is_owner and is_paired so clients can prevent adding the same plan twice.';
