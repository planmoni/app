/*
  Fix payout account removal failing with FK / API errors.

  safe_delete_payout_account deletes from payout_accounts, but:
  - emergency_withdrawals.payout_account_id had NO ACTION (blocks delete)
  - vault_payout_schedules.payout_account_id had NO ACTION (blocks delete)

  Align both FKs to ON DELETE SET NULL and update the RPC to detach
  emergency_withdrawals before deleting the account.
*/

ALTER TABLE public.emergency_withdrawals
  DROP CONSTRAINT IF EXISTS emergency_withdrawals_payout_account_id_fkey;

ALTER TABLE public.emergency_withdrawals
  ADD CONSTRAINT emergency_withdrawals_payout_account_id_fkey
  FOREIGN KEY (payout_account_id)
  REFERENCES public.payout_accounts(id)
  ON DELETE SET NULL;

ALTER TABLE public.vault_payout_schedules
  DROP CONSTRAINT IF EXISTS vault_payout_schedules_payout_account_id_fkey;

ALTER TABLE public.vault_payout_schedules
  ADD CONSTRAINT vault_payout_schedules_payout_account_id_fkey
  FOREIGN KEY (payout_account_id)
  REFERENCES public.payout_accounts(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.safe_delete_payout_account(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_account public.payout_accounts%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_account
  FROM public.payout_accounts
  WHERE id = p_account_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout account not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payout_plans
    WHERE payout_account_id = p_account_id
      AND user_id = v_user_id
      AND status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION 'This account is used by an active or paused payout plan and cannot be removed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vault_payout_schedules
    WHERE payout_account_id = p_account_id
      AND user_id = v_user_id
      AND status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION 'This account is used by an active or paused payout plan and cannot be removed.';
  END IF;

  UPDATE public.payout_plans pp
  SET
    metadata = COALESCE(pp.metadata, '{}'::jsonb) || jsonb_build_object(
      'archived_payout_account',
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', v_account.id,
          'account_name', v_account.account_name,
          'account_number', v_account.account_number,
          'bank_name', v_account.bank_name,
          'bank_code', v_account.bank_code,
          'removed_at', now()
        )
      )
    ),
    payout_account_id = NULL
  WHERE pp.payout_account_id = p_account_id
    AND pp.user_id = v_user_id
    AND pp.status IN ('completed', 'cancelled');

  UPDATE public.vault_payout_schedules
  SET payout_account_id = NULL
  WHERE payout_account_id = p_account_id
    AND user_id = v_user_id
    AND status IN ('completed', 'cancelled');

  UPDATE public.emergency_withdrawals
  SET payout_account_id = NULL
  WHERE payout_account_id = p_account_id
    AND user_id = v_user_id;

  UPDATE public.automated_payouts
  SET payout_account_id = NULL
  WHERE payout_account_id = p_account_id
    AND user_id = v_user_id;

  DELETE FROM public.payout_accounts
  WHERE id = p_account_id
    AND user_id = v_user_id;
END;
$$;

COMMENT ON FUNCTION public.safe_delete_payout_account(uuid) IS
  'Deletes a payout account when unused by active/paused plans. Detaches emergency withdrawals, inactive plans, and vault schedules first.';

GRANT EXECUTE ON FUNCTION public.safe_delete_payout_account(uuid) TO authenticated;
