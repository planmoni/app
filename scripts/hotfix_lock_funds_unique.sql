/*
  HOTFIX: lock_funds(uuid, numeric) is not unique (PGRST203 / create payout broken)

  Cause: multiple lock_funds overloads left in public schema.
  CREATE OR REPLACE on (uuid, numeric) does not remove (numeric, uuid) or 5-arg variants.

  Run this in Supabase SQL Editor immediately — no app rebuild required.
*/

-- 1) See what exists (optional — run alone to inspect)
-- SELECT p.oid::regprocedure AS sig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'lock_funds';

-- 2) Drop EVERY lock_funds overload
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'lock_funds'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- 3) Recreate the single canonical lock_funds (includes post-no-debit)
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

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_has_post_no_debit'
  ) AND public.user_has_post_no_debit(arg_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'POST_NO_DEBIT',
      'error', 'Account is restricted (post no debit). Contact support.'
    );
  END IF;

  PERFORM allow_wallet_update();

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_wallet_op_context'
  ) THEN
    PERFORM set_wallet_op_context(
      'lock_funds',
      'payout_plan_creation',
      NULL,
      jsonb_build_object('amount', arg_amount)
    );
  END IF;

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

-- 4) Confirm only one remains
SELECT p.oid::regprocedure AS remaining_lock_funds
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'lock_funds';
-- Expect exactly 1 row: lock_funds(uuid, numeric)
