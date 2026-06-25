/*
  Safe payout account deletion.

  - Block removal when an active/paused payout plan or vault schedule uses the account.
  - Archive bank details on completed/cancelled plans, then detach.
  - Relax payout_plans_account_check so inactive plans may have no linked account.
*/

-- Inactive plans may have both account FKs cleared after archival.
ALTER TABLE public.payout_plans
  DROP CONSTRAINT IF EXISTS payout_plans_account_check;

ALTER TABLE public.payout_plans
  ADD CONSTRAINT payout_plans_account_check CHECK (
    status IN ('completed', 'cancelled')
    OR bank_account_id IS NOT NULL
    OR payout_account_id IS NOT NULL
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payout_plans_payout_account_id_fkey'
      AND conrelid = 'public.payout_plans'::regclass
  ) THEN
    ALTER TABLE public.payout_plans
      DROP CONSTRAINT payout_plans_payout_account_id_fkey;

    ALTER TABLE public.payout_plans
      ADD CONSTRAINT payout_plans_payout_account_id_fkey
      FOREIGN KEY (payout_account_id)
      REFERENCES public.payout_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'automated_payouts_payout_account_id_fkey'
      AND conrelid = 'public.automated_payouts'::regclass
  ) THEN
    ALTER TABLE public.automated_payouts
      DROP CONSTRAINT automated_payouts_payout_account_id_fkey;

    ALTER TABLE public.automated_payouts
      ADD CONSTRAINT automated_payouts_payout_account_id_fkey
      FOREIGN KEY (payout_account_id)
      REFERENCES public.payout_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

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

  DELETE FROM public.vault_payout_schedules
  WHERE payout_account_id = p_account_id
    AND user_id = v_user_id
    AND status IN ('completed', 'cancelled');

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
  'Deletes a payout account when it is not used by active/paused plans. Archives bank details on inactive plans first.';

GRANT EXECUTE ON FUNCTION public.safe_delete_payout_account(uuid) TO authenticated;

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
  v_plan_metadata jsonb;
  v_can_see boolean := false;
  v_bank_name text;
  v_account_number text;
  v_account_name text;
  v_last4 text;
  v_archived jsonb;
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id, payout_account_id, bank_account_id, metadata
  INTO v_plan_user_id, v_payout_account_id, v_bank_account_id, v_plan_metadata
  FROM public.payout_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_user_id := auth.uid();
  IF v_plan_user_id = v_user_id THEN
    v_can_see := true;
  ELSIF EXISTS (
    SELECT 1
    FROM public.payout_plan_pairings
    WHERE payout_plan_id = p_plan_id
      AND paired_user_id = v_user_id
  ) THEN
    v_can_see := true;
  END IF;

  IF NOT v_can_see THEN
    RETURN NULL;
  END IF;

  IF v_payout_account_id IS NOT NULL THEN
    SELECT pa.bank_name, pa.account_number, pa.account_name
    INTO v_bank_name, v_account_number, v_account_name
    FROM public.payout_accounts pa
    WHERE pa.id = v_payout_account_id;
  END IF;

  IF v_bank_name IS NULL THEN
    v_archived := v_plan_metadata->'archived_payout_account';
    IF v_archived IS NOT NULL AND v_archived <> 'null'::jsonb THEN
      v_bank_name := NULLIF(v_archived->>'bank_name', '');
      v_account_number := NULLIF(v_archived->>'account_number', '');
      v_account_name := NULLIF(v_archived->>'account_name', '');
    END IF;
  END IF;

  IF v_bank_name IS NULL AND v_bank_account_id IS NOT NULL THEN
    SELECT ba.bank_name, ba.account_number, ba.account_name
    INTO v_bank_name, v_account_number, v_account_name
    FROM public.bank_accounts ba
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
