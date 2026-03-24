/*
  Shared plan bank display for recipients.

  When a paired user views a shared payout plan, they can see the plan row but
  RLS hides the creator's payout_accounts/bank_accounts. This SECURITY DEFINER
  function returns display-only bank info (bank name, last 4, account name) for
  a plan, only if the caller is the plan owner or a paired user.
*/

CREATE OR REPLACE FUNCTION public.get_payout_plan_bank_display(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_user_id uuid;
  v_payout_account_id uuid;
  v_bank_account_id uuid;
  v_can_see boolean := false;
  v_bank_name text;
  v_account_number text;
  v_account_name text;
  v_last4 text;
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Load plan and check access: owner or paired user
  SELECT user_id, payout_account_id, bank_account_id
  INTO v_plan_user_id, v_payout_account_id, v_bank_account_id
  FROM payout_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_user_id := auth.uid();
  IF v_plan_user_id = v_user_id THEN
    v_can_see := true;
  ELSIF EXISTS (
    SELECT 1 FROM payout_plan_pairings
    WHERE payout_plan_id = p_plan_id AND paired_user_id = v_user_id
  ) THEN
    v_can_see := true;
  END IF;

  IF NOT v_can_see THEN
    RETURN NULL;
  END IF;

  -- Prefer payout_accounts, then bank_accounts
  IF v_payout_account_id IS NOT NULL THEN
    SELECT pa.bank_name, pa.account_number, pa.account_name
    INTO v_bank_name, v_account_number, v_account_name
    FROM payout_accounts pa
    WHERE pa.id = v_payout_account_id;
  END IF;

  IF v_bank_name IS NULL AND v_bank_account_id IS NOT NULL THEN
    SELECT ba.bank_name, ba.account_number, ba.account_name
    INTO v_bank_name, v_account_number, v_account_name
    FROM bank_accounts ba
    WHERE ba.id = v_bank_account_id;
  END IF;

  IF v_bank_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_last4 := CASE
    WHEN v_account_number IS NOT NULL AND length(v_account_number) >= 4
    THEN right(v_account_number, 4)
    ELSE ''
  END;

  RETURN jsonb_build_object(
    'bank_name', COALESCE(v_bank_name, ''),
    'account_number_last4', COALESCE(v_last4, ''),
    'account_name', COALESCE(v_account_name, '')
  );
END;
$$;

COMMENT ON FUNCTION public.get_payout_plan_bank_display(uuid) IS
  'Returns display-only bank info for a payout plan. Callable by plan owner or paired user.';

GRANT EXECUTE ON FUNCTION public.get_payout_plan_bank_display(uuid) TO authenticated;
