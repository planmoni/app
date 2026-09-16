/*
  Post-no-debit (PND): block new payout creation and wallet fund locks.
  Deposits / credits remain allowed. Existing active plans are not auto-paused.

  Ops toggle: UPDATE profiles SET post_no_debit = true, ... WHERE email = ...
  See docs/POST_NO_DEBIT.md
*/

-- ---------------------------------------------------------------------------
-- 1) Flag on profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_no_debit boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_no_debit_reason text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_no_debit_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_no_debit_by text;

CREATE INDEX IF NOT EXISTS idx_profiles_post_no_debit_true
  ON public.profiles (id)
  WHERE post_no_debit = true;

COMMENT ON COLUMN public.profiles.post_no_debit IS
  'When true, user cannot create payout plans or lock funds (post no debit). Deposits still allowed.';

-- ---------------------------------------------------------------------------
-- 2) Helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_post_no_debit(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT post_no_debit FROM public.profiles WHERE id = p_user_id LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_post_no_debit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_post_no_debit(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) lock_funds — refuse when PND (true debit lock block)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lock_funds(
  arg_user_id uuid,
  arg_amount  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
  v_available   numeric;
BEGIN
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF public.user_has_post_no_debit(arg_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'POST_NO_DEBIT',
      'error', 'Account is restricted (post no debit). Contact support.'
    );
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context(
    'lock_funds',
    'payout_plan_creation',
    NULL,
    jsonb_build_object('amount', arg_amount)
  );

  SELECT * INTO wallet_record FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_available := COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0);

  IF v_available < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Insufficient available balance. Available: %s, Required: %s',
        v_available, arg_amount
      )
    );
  END IF;

  UPDATE wallets
  SET
    locked_balance    = COALESCE(locked_balance, 0) + arg_amount,
    available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) + arg_amount),
    updated_at        = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) create_payout_plan_atomic — explicit POST_NO_DEBIT after idempotent replay
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_payout_plan_atomic(
  p_name text,
  p_description text,
  p_total_amount numeric,
  p_payout_amount numeric,
  p_fee_amount numeric,
  p_net_payout_amount numeric,
  p_fee_percentage numeric,
  p_frequency text,
  p_duration integer,
  p_start_date date,
  p_next_payout_date timestamptz,
  p_payout_account_id uuid DEFAULT NULL,
  p_bank_account_id uuid DEFAULT NULL,
  p_emergency_withdrawal_enabled boolean DEFAULT true,
  p_day_of_week integer DEFAULT NULL,
  p_payout_hour integer DEFAULT NULL,
  p_payout_minute integer DEFAULT NULL,
  p_purpose text DEFAULT NULL,
  p_purpose_other_text text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_custom_dates jsonb DEFAULT '[]'::jsonb,
  p_custom_date_amounts jsonb DEFAULT '{}'::jsonb,
  p_custom_date_times jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_idem text;
  v_existing payout_plans%ROWTYPE;
  v_pa_user uuid;
  v_ba_user uuid;
  v_available numeric;
  v_wallet wallets%ROWTYPE;
  v_lock jsonb;
  v_plan_id uuid;
  v_plan payout_plans%ROWTYPE;
  v_custom_date text;
  v_custom_amount numeric;
  v_custom_time text;
  v_fee_check numeric;
  v_meta jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'error', 'Not authenticated'
    );
  END IF;

  v_idem := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  IF v_idem IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Idempotency key is required'
    );
  END IF;

  -- Idempotent replay (allowed even if PND was set after the plan was created)
  SELECT * INTO v_existing
  FROM payout_plans
  WHERE user_id = v_uid
    AND idempotency_key = v_idem
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_uid;
    RETURN jsonb_build_object(
      'success', true,
      'code', 'OK',
      'idempotent', true,
      'plan_id', v_existing.id,
      'plan', to_jsonb(v_existing),
      'wallet', jsonb_build_object(
        'balance', COALESCE(v_wallet.balance, 0),
        'locked_balance', COALESCE(v_wallet.locked_balance, 0),
        'available_balance',
          COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.locked_balance, 0)
      )
    );
  END IF;

  IF public.user_has_post_no_debit(v_uid) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'POST_NO_DEBIT',
      'error', 'Account is restricted (post no debit). You cannot create payout plans. Contact support.'
    );
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Total amount must be greater than zero'
    );
  END IF;

  IF p_net_payout_amount IS NULL OR p_net_payout_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Net payout amount must be greater than zero'
    );
  END IF;

  IF p_fee_amount IS NULL OR p_fee_amount < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Fee amount is invalid'
    );
  END IF;

  IF p_duration IS NULL OR p_duration < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Duration must be at least 1'
    );
  END IF;

  IF p_start_date IS NULL OR p_next_payout_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'Start date and next payout date are required'
    );
  END IF;

  IF p_payout_account_id IS NULL AND p_bank_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'A payout destination is required'
    );
  END IF;

  v_fee_check := round((COALESCE(p_fee_amount, 0) + p_net_payout_amount)::numeric, 2);
  IF abs(v_fee_check - round(p_total_amount::numeric, 2)) > 0.02 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', format(
        'Fee + net (%s) must equal total (%s)',
        v_fee_check, p_total_amount
      )
    );
  END IF;

  IF p_payout_account_id IS NOT NULL THEN
    SELECT user_id INTO v_pa_user
    FROM payout_accounts
    WHERE id = p_payout_account_id;

    IF NOT FOUND OR v_pa_user <> v_uid THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_ACCOUNT',
        'error', 'Payout account not found'
      );
    END IF;
  END IF;

  IF p_bank_account_id IS NOT NULL THEN
    SELECT user_id INTO v_ba_user
    FROM bank_accounts
    WHERE id = p_bank_account_id;

    IF NOT FOUND OR v_ba_user <> v_uid THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_ACCOUNT',
        'error', 'Bank account not found'
      );
    END IF;
  END IF;

  PERFORM allow_wallet_update();
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'WALLET_NOT_FOUND',
      'error', 'Wallet not found'
    );
  END IF;

  v_available := COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.locked_balance, 0);

  IF v_available < p_total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_BALANCE',
      'error', format(
        'Insufficient available balance. Available: %s, Required: %s',
        v_available, p_total_amount
      ),
      'available_balance', v_available,
      'required', p_total_amount
    );
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'idempotency_key', v_idem,
    'originalFrequency', p_frequency,
    'dayOfWeek', p_day_of_week,
    'payoutHour', p_payout_hour,
    'payoutMinute', p_payout_minute
  );

  BEGIN
    v_lock := lock_funds(v_uid, p_net_payout_amount);
    IF COALESCE((v_lock->>'success')::boolean, false) IS NOT TRUE THEN
      IF COALESCE(v_lock->>'code', '') = 'POST_NO_DEBIT' THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'POST_NO_DEBIT',
          'error', COALESCE(
            v_lock->>'error',
            'Account is restricted (post no debit). Contact support.'
          ),
          'lock_result', v_lock
        );
      END IF;
      IF COALESCE(v_lock->>'error', '') ILIKE '%insufficient%' THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'INSUFFICIENT_BALANCE',
          'error', COALESCE(v_lock->>'error', 'Insufficient available balance'),
          'lock_result', v_lock
        );
      END IF;
      RAISE EXCEPTION 'LOCK_FAILED: %', COALESCE(v_lock->>'error', 'Failed to lock funds');
    END IF;

    INSERT INTO payout_plans (
      user_id,
      name,
      description,
      total_amount,
      payout_amount,
      frequency,
      duration,
      start_date,
      bank_account_id,
      payout_account_id,
      status,
      completed_payouts,
      emergency_withdrawal_enabled,
      next_payout_date,
      metadata,
      idempotency_key,
      fee_percentage,
      fee_amount,
      net_payout_amount,
      purpose,
      purpose_other_text
    ) VALUES (
      v_uid,
      COALESCE(NULLIF(trim(p_name), ''), 'Payout Plan'),
      COALESCE(p_description, ''),
      p_total_amount,
      p_payout_amount,
      p_frequency,
      p_duration,
      p_start_date,
      p_bank_account_id,
      p_payout_account_id,
      'active',
      0,
      COALESCE(p_emergency_withdrawal_enabled, true),
      p_next_payout_date,
      v_meta,
      v_idem,
      COALESCE(p_fee_percentage, 1.5),
      p_fee_amount,
      p_net_payout_amount,
      p_purpose,
      p_purpose_other_text
    )
    RETURNING * INTO v_plan;

    v_plan_id := v_plan.id;

    IF p_frequency = 'custom'
       AND jsonb_typeof(p_custom_dates) = 'array'
       AND jsonb_array_length(p_custom_dates) > 0
    THEN
      FOR v_custom_date IN
        SELECT jsonb_array_elements_text(p_custom_dates)
      LOOP
        v_custom_amount := NULLIF(
          replace(COALESCE(p_custom_date_amounts->>v_custom_date, ''), ',', ''),
          ''
        )::numeric;
        v_custom_time := COALESCE(
          NULLIF(p_custom_date_times->>v_custom_date, ''),
          '12:00'
        );
        IF v_custom_time ~ '^\d{1,2}:\d{2}$' THEN
          v_custom_time := v_custom_time || ':00';
        END IF;

        INSERT INTO custom_payout_dates (
          payout_plan_id,
          payout_date,
          payout_time,
          amount
        ) VALUES (
          v_plan_id,
          v_custom_date::date,
          v_custom_time::time,
          v_custom_amount
        );
      END LOOP;
    END IF;

  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM payout_plans
      WHERE user_id = v_uid
        AND idempotency_key = v_idem
      LIMIT 1;

      IF FOUND THEN
        SELECT * INTO v_wallet FROM wallets WHERE user_id = v_uid;
        RETURN jsonb_build_object(
          'success', true,
          'code', 'OK',
          'idempotent', true,
          'plan_id', v_existing.id,
          'plan', to_jsonb(v_existing),
          'wallet', jsonb_build_object(
            'balance', COALESCE(v_wallet.balance, 0),
            'locked_balance', COALESCE(v_wallet.locked_balance, 0),
            'available_balance',
              COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.locked_balance, 0)
          )
        );
      END IF;

      RAISE;
  END;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'OK',
    'idempotent', false,
    'plan_id', v_plan_id,
    'plan', to_jsonb(v_plan),
    'wallet', jsonb_build_object(
      'balance', COALESCE(v_wallet.balance, 0),
      'locked_balance', COALESCE(v_wallet.locked_balance, 0),
      'available_balance',
        COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.locked_balance, 0)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.create_payout_plan_atomic IS
  'Atomically validates available balance (>= total), locks net payout, inserts payout plan + custom dates. Idempotent on (user_id, idempotency_key). Blocks when profiles.post_no_debit.';

GRANT EXECUTE ON FUNCTION public.create_payout_plan_atomic(
  text, text, numeric, numeric, numeric, numeric, numeric, text, integer, date, timestamptz,
  uuid, uuid, boolean, integer, integer, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_payout_plan_atomic(
  text, text, numeric, numeric, numeric, numeric, numeric, text, integer, date, timestamptz,
  uuid, uuid, boolean, integer, integer, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;
