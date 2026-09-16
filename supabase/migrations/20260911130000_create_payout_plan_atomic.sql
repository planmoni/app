/*
  Phase 1: atomic, idempotent payout plan creation.

  Semantics (match current client create path):
  - User commits p_total_amount from available balance.
  - Fees are taken FROM that total (not added on top).
  - Available must be >= p_total_amount.
  - Locked reservation = p_net_payout_amount (= total - fees).
  - Plan INSERT triggers deduct_plan_fee_on_insert (fee from balance).
  - Custom dates inserted in the same transaction.

  Do NOT drop lock_funds — other flows (vault, expense) still use it.
  This RPC calls lock_funds internally so ledger labels stay consistent.
*/

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

  -- Idempotent replay
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

  -- Fee + net must equal total (₦0.02 tolerance for rounding)
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

  -- Lock wallet row and validate available >= total_amount
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

  -- All money + plan writes below share one transaction.
  -- On failure we RAISE so lock + insert + fee trigger roll back together.
  BEGIN
    -- Reserve net for scheduled payouts (fees deducted on plan insert via trigger)
    v_lock := lock_funds(v_uid, p_net_payout_amount);
    IF COALESCE((v_lock->>'success')::boolean, false) IS NOT TRUE THEN
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
        -- Normalize HH:MM → HH:MM:00
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
      -- Concurrent insert with same idempotency key; this tx's lock rolls back.
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
  'Atomically validates available balance (>= total), locks net payout, inserts payout plan + custom dates. Idempotent on (user_id, idempotency_key).';

GRANT EXECUTE ON FUNCTION public.create_payout_plan_atomic(
  text, text, numeric, numeric, numeric, numeric, numeric, text, integer, date, timestamptz,
  uuid, uuid, boolean, integer, integer, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_payout_plan_atomic(
  text, text, numeric, numeric, numeric, numeric, numeric, text, integer, date, timestamptz,
  uuid, uuid, boolean, integer, integer, integer, text, text, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;
