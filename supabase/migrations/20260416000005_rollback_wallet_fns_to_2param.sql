/*
  ROLLBACK — Restore 2-param wallet functions (drop 5-param audit versions)
  ==========================================================================

  When to run this
  ----------------
  Only run this if 20260416000004_drop_old_wallet_fn_overloads.sql does NOT
  fix the "could not choose best candidate function" error, meaning the 5-param
  versions themselves are still conflicting with something in the live DB.

  What this does
  --------------
  1. DROPs the 5-param (audit) versions of all four wallet functions.
  2. Recreates clean 2-param versions taken from the last known-working
     migration (20250115000004 / 20250621235108), with allow_wallet_update()
     explicitly included so the prevent_direct_wallet_updates trigger passes.

  After this runs
  ---------------
  • Payouts, lock, unlock, add-funds all work exactly as before the audit
    migration was applied.
  • Wallet ledger entries will NOT be written (no trigger context) — that is
    the trade-off of this rollback.
  • Run 20260416000004 first and only run this if that is not sufficient.
*/

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. DROP the 5-param audit versions
-- ══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.transfer_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.add_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.lock_funds(uuid, numeric, text, text, jsonb);
DROP FUNCTION IF EXISTS public.unlock_funds(uuid, numeric, text, text, jsonb);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Restore 2-param versions (last known-working bodies + allow_wallet_update)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── transfer_funds ────────────────────────────────────────────────────────────
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

  -- Required by prevent_direct_wallet_updates trigger
  PERFORM allow_wallet_update();

  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

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

  -- Deducts from both balance AND locked_balance (available_balance stays the same)
  UPDATE wallets
  SET balance        = COALESCE(balance, 0)        - arg_amount,
      locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      updated_at     = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           wallet_record.balance,
    'locked_balance',    wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, numeric) TO authenticated, service_role;

-- ── add_funds ─────────────────────────────────────────────────────────────────
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

  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id;

  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_amount, 0, arg_amount)
    RETURNING * INTO wallet_record;
  ELSE
    UPDATE wallets
    SET balance           = COALESCE(balance, 0) + arg_amount,
        available_balance = COALESCE(balance, 0) + arg_amount - COALESCE(locked_balance, 0),
        updated_at        = now()
    WHERE user_id = arg_user_id
    RETURNING * INTO wallet_record;
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           wallet_record.balance,
    'locked_balance',    wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(uuid, numeric) TO authenticated, service_role;

-- ── lock_funds ────────────────────────────────────────────────────────────────
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
  wallet_record     wallets%ROWTYPE;
  v_available       numeric;
BEGIN
  PERFORM allow_wallet_update();

  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

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
  SET locked_balance    = COALESCE(locked_balance, 0) + arg_amount,
      available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) + arg_amount),
      updated_at        = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           wallet_record.balance,
    'locked_balance',    wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric) TO authenticated, service_role;

-- ── unlock_funds ──────────────────────────────────────────────────────────────
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
  PERFORM allow_wallet_update();

  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

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
  SET locked_balance    = COALESCE(locked_balance, 0) - arg_amount,
      available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) - arg_amount),
      updated_at        = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           wallet_record.balance,
    'locked_balance',    wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_funds(uuid, numeric) TO authenticated, service_role;
pl