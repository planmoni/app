-- Label wallet_ledger operations: lock_funds / unlock_funds / transfer_funds instead of unknown.
-- 1) Wallet mutation functions call set_wallet_op_context before UPDATE.
-- 2) Trigger infers operation from balance deltas when context is still unknown.

-- =============================================================================
-- 1. Infer operation from deltas when context was not set
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_wallet_ledger_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation   text;
  v_source_kind text;
  v_source_ref  text;
  v_metadata    jsonb;
  v_bal_delta   numeric;
  v_locked_delta numeric;
  v_avail_delta numeric;
BEGIN
  IF (
    OLD.balance            IS NOT DISTINCT FROM NEW.balance AND
    OLD.locked_balance     IS NOT DISTINCT FROM NEW.locked_balance AND
    OLD.available_balance  IS NOT DISTINCT FROM NEW.available_balance
  ) THEN
    RETURN NEW;
  END IF;

  v_operation   := COALESCE(NULLIF(current_setting('wallet.operation',   true), ''), 'unknown');
  v_source_kind := NULLIF(current_setting('wallet.source_kind', true), '');
  v_source_ref  := NULLIF(current_setting('wallet.source_ref',  true), '');
  v_metadata    := COALESCE(
    (NULLIF(current_setting('wallet.metadata', true), ''))::jsonb,
    '{}'::jsonb
  );

  v_bal_delta    := COALESCE(NEW.balance, 0)           - COALESCE(OLD.balance, 0);
  v_locked_delta := COALESCE(NEW.locked_balance, 0)  - COALESCE(OLD.locked_balance, 0);
  v_avail_delta  := COALESCE(NEW.available_balance, 0) - COALESCE(OLD.available_balance, 0);

  IF v_operation = 'unknown' THEN
    -- available → locked (plan creation, recalculate increase)
    IF v_bal_delta = 0 AND v_locked_delta > 0 AND v_avail_delta < 0
       AND abs(v_locked_delta + v_avail_delta) < 0.02 THEN
      v_operation := 'lock_funds';
    -- locked → available (plan cancel, recalculate decrease, refund)
    ELSIF v_bal_delta = 0 AND v_locked_delta < 0 AND v_avail_delta > 0
       AND abs(v_locked_delta + v_avail_delta) < 0.02 THEN
      v_operation := 'unlock_funds';
    -- Payout / withdrawal: balance and locked both decrease, available unchanged
    ELSIF v_bal_delta < 0 AND v_locked_delta < 0 AND abs(v_avail_delta) < 0.02 THEN
      v_operation := 'transfer_funds';
    -- Refund failed payout: balance and locked both increase
    ELSIF v_bal_delta > 0 AND v_locked_delta > 0 AND abs(v_avail_delta) < 0.02 THEN
      v_operation := 'refund_payout_wallet_debit';
    -- Deposit / credit
    ELSIF v_bal_delta > 0 AND v_locked_delta = 0 THEN
      v_operation := 'add_funds';
    -- Fee from balance only
    ELSIF v_bal_delta < 0 AND v_locked_delta = 0 AND v_avail_delta < 0 THEN
      v_operation := 'charge_plan_fee';
    -- Recalculate with only locked/available shift (tolerance)
    ELSIF v_bal_delta = 0 AND v_locked_delta <> 0 THEN
      IF v_locked_delta > 0 THEN
        v_operation := 'lock_funds';
      ELSE
        v_operation := 'unlock_funds';
      END IF;
      v_source_kind := COALESCE(v_source_kind, 'recalculate_locked_balance');
    END IF;
  END IF;

  INSERT INTO wallet_ledger (
    user_id,
    operation,
    source_kind,
    source_ref,
    balance_before,
    locked_balance_before,
    available_balance_before,
    balance_after,
    locked_balance_after,
    available_balance_after,
    metadata
  ) VALUES (
    NEW.user_id,
    v_operation,
    v_source_kind,
    v_source_ref,
    COALESCE(OLD.balance,           0),
    COALESCE(OLD.locked_balance,    0),
    COALESCE(OLD.available_balance, 0),
    COALESCE(NEW.balance,           0),
    COALESCE(NEW.locked_balance,    0),
    COALESCE(NEW.available_balance, 0),
    v_metadata
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. lock_funds — available → locked
-- =============================================================================
-- Drop 5-param audit overloads first; CREATE OR REPLACE on (uuid, numeric) does not remove them (PGRST203).
DROP FUNCTION IF EXISTS public.lock_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.unlock_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.transfer_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.add_funds(uuid, numeric, text, text, jsonb);

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

-- =============================================================================
-- 3. unlock_funds — locked → available
-- =============================================================================
CREATE OR REPLACE FUNCTION public.unlock_funds(
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
BEGIN
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context(
    'unlock_funds',
    'plan_cancelled',
    NULL,
    jsonb_build_object('amount', arg_amount)
  );

  SELECT * INTO wallet_record FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Insufficient locked balance. Locked: %s, Required: %s',
        COALESCE(wallet_record.locked_balance, 0), arg_amount
      )
    );
  END IF;

  UPDATE wallets
  SET
    locked_balance    = COALESCE(locked_balance, 0) - arg_amount,
    available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) - arg_amount),
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

-- =============================================================================
-- 4. transfer_funds — payout disbursement
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transfer_funds(
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
BEGIN
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context(
    'transfer_funds',
    'automated_payout',
    NULL,
    jsonb_build_object('amount', arg_amount)
  );

  SELECT * INTO wallet_record FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Insufficient locked balance for transfer. Locked: %s, Required: %s',
        COALESCE(wallet_record.locked_balance, 0), arg_amount
      )
    );
  END IF;

  UPDATE wallets
  SET
    balance        = COALESCE(balance, 0) - arg_amount,
    locked_balance = COALESCE(locked_balance, 0) - arg_amount,
    updated_at     = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =============================================================================
-- 5. add_funds — deposit / credit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_funds(
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
BEGIN
  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context('add_funds', 'deposit', NULL, jsonb_build_object('amount', arg_amount));

  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO wallet_record FROM wallets WHERE user_id = arg_user_id;

  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_amount, 0, arg_amount)
    RETURNING * INTO wallet_record;
  ELSE
    UPDATE wallets
    SET
      balance           = COALESCE(balance, 0) + arg_amount,
      available_balance = COALESCE(balance, 0) + arg_amount - COALESCE(locked_balance, 0),
      updated_at        = now()
    WHERE user_id = arg_user_id
    RETURNING * INTO wallet_record;
  END IF;

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

-- =============================================================================
-- 6. recalculate_locked_balance — label lock vs unlock by direction
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_wallet wallets%ROWTYPE;
  v_old_locked numeric;
  v_op text;
BEGIN
  PERFORM allow_wallet_update();

  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_old_locked := COALESCE(v_wallet.locked_balance, 0);

  SELECT COALESCE(SUM(public.plan_locked_remaining_for_plan(pp.id)), 0)
  INTO v_calculated_locked_balance
  FROM payout_plans pp
  WHERE pp.user_id = arg_user_id
    AND pp.status IN ('active', 'paused')
    AND public.plan_locked_remaining_for_plan(pp.id) > 0;

  IF v_calculated_locked_balance < 0 THEN
    v_calculated_locked_balance := 0;
  END IF;
  IF v_calculated_locked_balance > v_wallet.balance THEN
    v_calculated_locked_balance := GREATEST(0, v_wallet.balance);
  END IF;

  IF v_calculated_locked_balance > v_old_locked THEN
    v_op := 'lock_funds';
  ELSIF v_calculated_locked_balance < v_old_locked THEN
    v_op := 'unlock_funds';
  ELSE
    v_op := 'recalculate_locked_balance';
  END IF;

  PERFORM set_wallet_op_context(
    v_op,
    'recalculate_locked_balance',
    arg_user_id::text,
    jsonb_build_object(
      'calculated_locked_balance', v_calculated_locked_balance,
      'previous_locked_balance', v_old_locked
    )
  );

  UPDATE wallets
  SET
    locked_balance = v_calculated_locked_balance,
    available_balance = GREATEST(0, balance - v_calculated_locked_balance),
    updated_at = now()
  WHERE user_id = arg_user_id;

  SELECT balance, locked_balance, (balance - locked_balance)
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets
  WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance,
    'calculated_locked_balance', v_calculated_locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =============================================================================
-- 7. refund_payout_wallet_debit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refund_payout_wallet_debit(
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
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context(
    'refund_payout_wallet_debit',
    'payout_refund',
    NULL,
    jsonb_build_object('amount', arg_amount)
  );

  SELECT * INTO wallet_record FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  UPDATE wallets
  SET
    balance        = COALESCE(balance, 0) + arg_amount,
    locked_balance = COALESCE(locked_balance, 0) + arg_amount,
    updated_at     = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlock_funds(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_funds(uuid, numeric) TO authenticated, service_role;

-- =============================================================================
-- 8. charge_plan_fee
-- =============================================================================
CREATE OR REPLACE FUNCTION public.charge_plan_fee(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       payout_plans%ROWTYPE;
  v_existing   uuid;
  v_fee_amount numeric;
  v_wallet     wallets%ROWTYPE;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  SELECT id INTO v_existing
  FROM user_fee_events
  WHERE source_type = 'payout_plan'
    AND source_id   = p_plan_id
    AND fee_type    = 'plan_creation'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_charged', true, 'event_id', v_existing);
  END IF;

  v_fee_amount := COALESCE(v_plan.fee_amount, 0);

  IF v_fee_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'message', 'No fee to charge');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context(
    'charge_plan_fee',
    'payout_plan_creation',
    p_plan_id::text,
    jsonb_build_object('plan_id', p_plan_id, 'fee_amount', v_fee_amount)
  );

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_plan.user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_new_balance := v_wallet.balance - v_fee_amount;

  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to charge fee');
  END IF;

  UPDATE wallets
  SET
    balance           = v_new_balance,
    available_balance = v_new_balance - GREATEST(0, COALESCE(locked_balance, 0)),
    updated_at        = now()
  WHERE user_id = v_plan.user_id
  RETURNING * INTO v_wallet;

  INSERT INTO user_fee_events (
    user_id, source_type, source_id, fee_type, amount, currency, metadata
  ) VALUES (
    v_plan.user_id,
    'payout_plan',
    p_plan_id,
    'plan_creation',
    v_fee_amount,
    'NGN',
    jsonb_build_object(
      'plan_id',        p_plan_id,
      'fee_percentage', v_plan.fee_percentage,
      'fee_amount',     v_fee_amount,
      'net_payout',     v_plan.net_payout_amount
    )
  )
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object(
    'success', true,
    'already_charged', false,
    'event_id', v_existing,
    'fee_charged', v_fee_amount,
    'new_balance', v_wallet.balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_plan_fee(uuid) TO authenticated, service_role;
