/*
  Wallet Ledger Audit — Security, Reliability, Idempotency, Monitoring
  =====================================================================

  What this migration does
  ─────────────────────────
  1. Creates `wallet_ledger` — an immutable, append-only audit trail that
     records every wallet balance change (balance, locked_balance,
     available_balance) with full before/after snapshots and deltas.

  2. Installs an AFTER UPDATE trigger on `wallets` that automatically writes
     to `wallet_ledger` whenever a balance column changes.
     The trigger is SECURITY DEFINER so it always fires, even inside
     other SECURITY DEFINER functions.

  3. Adds `set_wallet_op_context(operation, source_kind, source_ref, metadata)`
     — a thin helper that calling code invokes BEFORE a wallet operation to
     attach a human-readable label and rich context to the ledger entry.
     Session-local (transaction-scoped) so context never leaks across requests.

  4. Re-creates ALL wallet mutation functions with:
     a. `PERFORM allow_wallet_update()` — satisfies the existing
        prevent_direct_wallet_updates trigger.
     b. `PERFORM set_wallet_op_context(...)` — labels the ledger entry.
     c. `FOR UPDATE` row-lock to prevent concurrent double-mutations.

  Wallet operation map
  ─────────────────────
  Operation name         | Trigger                                | Balance effect
  ─────────────────────────────────────────────────────────────────────────────────
  add_funds              | Deposit / Mono / Paystack webhook       | balance ↑, available ↑
  lock_funds             | Payout plan creation                    | locked ↑, available ↓
  unlock_funds           | Plan cancelled / emergency              | locked ↓, available ↑
  transfer_funds         | Automated payout / emergency withdrawal | balance ↓, locked ↓
  charge_plan_fee        | Plan fee deduction at creation          | balance ↓, available ↓
  vault_credit           | Vault schedule (withdraw from vault)    | balance ↑, available ↑
  vault_fee_deduct       | Vault schedule fee charge               | balance ↓, available ↓
*/

-- ============================================================================
-- 1. wallet_ledger table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id                       bigserial        PRIMARY KEY,
  user_id                  uuid             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Operation that triggered this entry (set via set_wallet_op_context)
  operation                text             NOT NULL DEFAULT 'unknown',

  -- Optional rich context set by the caller
  source_kind              text,   -- e.g. 'payout_plan_creation', 'automated_payout', 'deposit'
  source_ref               text,   -- e.g. plan_id, withdrawal_id, transaction reference

  -- Balance snapshots (before → after)
  balance_before           numeric(20,4)    NOT NULL DEFAULT 0,
  locked_balance_before    numeric(20,4)    NOT NULL DEFAULT 0,
  available_balance_before numeric(20,4)    NOT NULL DEFAULT 0,

  balance_after            numeric(20,4)    NOT NULL DEFAULT 0,
  locked_balance_after     numeric(20,4)    NOT NULL DEFAULT 0,
  available_balance_after  numeric(20,4)    NOT NULL DEFAULT 0,

  -- Computed deltas (positive = increase, negative = decrease)
  balance_delta            numeric(20,4)    GENERATED ALWAYS AS (balance_after - balance_before)                     STORED,
  locked_balance_delta     numeric(20,4)    GENERATED ALWAYS AS (locked_balance_after - locked_balance_before)       STORED,
  available_balance_delta  numeric(20,4)    GENERATED ALWAYS AS (available_balance_after - available_balance_before) STORED,

  -- Arbitrary metadata (plan_id, withdrawal_id, transfer_ref, etc.)
  metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,

  recorded_at              timestamptz      NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_recorded
  ON wallet_ledger (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_operation
  ON wallet_ledger (operation, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_source_kind
  ON wallet_ledger (source_kind, recorded_at DESC);

-- Prevent delete/update on ledger rows (immutable)
CREATE OR REPLACE RULE wallet_ledger_no_delete AS
  ON DELETE TO wallet_ledger DO INSTEAD NOTHING;

CREATE OR REPLACE RULE wallet_ledger_no_update AS
  ON UPDATE TO wallet_ledger DO INSTEAD NOTHING;

-- RLS: users can only read their own ledger
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet ledger" ON wallet_ledger;
CREATE POLICY "Users can view own wallet ledger"
  ON wallet_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role and functions can insert (no RLS restriction for INSERT)
GRANT SELECT ON wallet_ledger TO authenticated;
GRANT INSERT ON wallet_ledger TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wallet_ledger_id_seq TO service_role;

COMMENT ON TABLE wallet_ledger IS
  'Immutable audit trail of every wallet balance change. '
  'Written automatically by trg_wallet_ledger (AFTER UPDATE on wallets). '
  'Rows cannot be deleted or modified.';

-- ============================================================================
-- 2. set_wallet_op_context — caller sets transaction-scoped context
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_wallet_op_context(
  p_operation   text,
  p_source_kind text    DEFAULT NULL,
  p_source_ref  text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- `true` = local (transaction-scoped); cleared automatically on commit/rollback
  PERFORM set_config('wallet.operation',   COALESCE(p_operation,   'unknown'), true);
  PERFORM set_config('wallet.source_kind', COALESCE(p_source_kind, ''),        true);
  PERFORM set_config('wallet.source_ref',  COALESCE(p_source_ref,  ''),        true);
  PERFORM set_config('wallet.metadata',    COALESCE(p_metadata::text, '{}'),   true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_wallet_op_context(text, text, text, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.set_wallet_op_context IS
  'Set transaction-local context consumed by trg_wallet_ledger. '
  'Call this BEFORE invoking add_funds / lock_funds / unlock_funds / transfer_funds '
  'to attach a human-readable operation label and source context to the ledger entry.';

-- ============================================================================
-- 3. Trigger function — writes to wallet_ledger after each balance change
-- ============================================================================
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
BEGIN
  -- Only record when at least one balance column actually changed
  IF (
    OLD.balance            IS NOT DISTINCT FROM NEW.balance AND
    OLD.locked_balance     IS NOT DISTINCT FROM NEW.locked_balance AND
    OLD.available_balance  IS NOT DISTINCT FROM NEW.available_balance
  ) THEN
    RETURN NEW;
  END IF;

  -- Read session context (set by set_wallet_op_context or wallet functions directly)
  v_operation   := COALESCE(NULLIF(current_setting('wallet.operation',   true), ''), 'unknown');
  v_source_kind := NULLIF(current_setting('wallet.source_kind', true), '');
  v_source_ref  := NULLIF(current_setting('wallet.source_ref',  true), '');
  v_metadata    := COALESCE(
    (NULLIF(current_setting('wallet.metadata', true), ''))::jsonb,
    '{}'::jsonb
  );

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
  -- Ledger failure must NEVER break the actual wallet operation
  -- The error is swallowed here; monitor wallet_ledger gaps separately
  RETURN NEW;
END;
$$;

-- Install trigger (idempotent)
DROP TRIGGER IF EXISTS trg_wallet_ledger ON wallets;
CREATE TRIGGER trg_wallet_ledger
  AFTER UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION record_wallet_ledger_entry();

-- ============================================================================
-- 4. Re-create wallet mutation functions
--    Each function now:
--    (a) calls allow_wallet_update()       — required by prevent_direct_wallet_updates trigger
--    (b) calls set_wallet_op_context(...)  — labels the ledger entry
--    (c) uses FOR UPDATE row-lock          — prevents concurrent double-mutations
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 4a. add_funds — credit main wallet (deposits, vault withdrawals)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_funds(
  arg_user_id   uuid,
  arg_amount    numeric,
  arg_source_kind text DEFAULT 'deposit',
  arg_source_ref  text DEFAULT NULL,
  arg_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Allow wallet mutation (bypasses prevent_direct_wallet_updates trigger)
  PERFORM allow_wallet_update();
  -- Label this ledger entry
  PERFORM set_wallet_op_context('add_funds', arg_source_kind, arg_source_ref, arg_metadata);

  -- Row-lock the wallet to prevent concurrent mutations
  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create wallet if missing
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_amount, 0, arg_amount)
    RETURNING * INTO v_wallet;

    RETURN jsonb_build_object(
      'success',           true,
      'balance',           v_wallet.balance,
      'locked_balance',    v_wallet.locked_balance,
      'available_balance', v_wallet.available_balance
    );
  END IF;

  UPDATE wallets
  SET
    balance           = COALESCE(balance, 0) + arg_amount,
    available_balance = COALESCE(balance, 0) + arg_amount - COALESCE(locked_balance, 0),
    updated_at        = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           v_wallet.balance,
    'locked_balance',    v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(uuid, numeric, text, text, jsonb)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4b. lock_funds — move funds from available → locked (payout plan creation)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lock_funds(
  arg_user_id     uuid,
  arg_amount      numeric,
  arg_source_kind text DEFAULT 'payout_plan_creation',
  arg_source_ref  text DEFAULT NULL,
  arg_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet          wallets%ROWTYPE;
  v_available       numeric;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context('lock_funds', arg_source_kind, arg_source_ref, arg_metadata);

  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_available := COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.locked_balance, 0);

  IF v_available < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   format(
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
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           v_wallet.balance,
    'locked_balance',    v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_funds(uuid, numeric, text, text, jsonb)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4c. unlock_funds — move funds from locked → available (plan cancelled / error)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unlock_funds(
  arg_user_id     uuid,
  arg_amount      numeric,
  arg_source_kind text DEFAULT 'plan_cancelled',
  arg_source_ref  text DEFAULT NULL,
  arg_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context('unlock_funds', arg_source_kind, arg_source_ref, arg_metadata);

  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF COALESCE(v_wallet.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   format(
        'Insufficient locked balance. Locked: %s, Required: %s',
        v_wallet.locked_balance, arg_amount
      )
    );
  END IF;

  UPDATE wallets
  SET
    locked_balance    = COALESCE(locked_balance, 0) - arg_amount,
    available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) - arg_amount),
    updated_at        = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           v_wallet.balance,
    'locked_balance',    v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_funds(uuid, numeric, text, text, jsonb)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4d. transfer_funds — disburse a payout (reduces balance AND locked_balance)
--     Previously this function lacked allow_wallet_update() which would have
--     caused the prevent_direct_wallet_updates trigger to block it.
--     Fixed here.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_funds(
  arg_user_id     uuid,
  arg_amount      numeric,
  arg_source_kind text DEFAULT 'automated_payout',
  arg_source_ref  text DEFAULT NULL,
  arg_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();
  PERFORM set_wallet_op_context('transfer_funds', arg_source_kind, arg_source_ref, arg_metadata);

  SELECT * INTO v_wallet FROM wallets WHERE user_id = arg_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF COALESCE(v_wallet.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   format(
        'Insufficient locked balance for transfer. Locked: %s, Required: %s',
        v_wallet.locked_balance, arg_amount
      )
    );
  END IF;

  -- Deducts from both balance and locked_balance; available_balance stays the same
  -- because the money was already excluded from available when it was locked.
  UPDATE wallets
  SET
    balance        = COALESCE(balance, 0)        - arg_amount,
    locked_balance = COALESCE(locked_balance, 0) - arg_amount,
    updated_at     = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           v_wallet.balance,
    'locked_balance',    v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, numeric, text, text, jsonb)
  TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4e. charge_plan_fee — deduct plan fee from balance only (not locked)
-- ────────────────────────────────────────────────────────────────────────────
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

  -- Idempotency: if already charged, return early
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

  -- Deduct fee from balance only; locked_balance already excludes the fee
  UPDATE wallets
  SET
    balance           = v_new_balance,
    available_balance = v_new_balance - GREATEST(0, COALESCE(locked_balance, 0)),
    updated_at        = now()
  WHERE user_id = v_plan.user_id
  RETURNING * INTO v_wallet;

  -- Record in user fee ledger
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
    'success',       true,
    'already_charged', false,
    'event_id',      v_existing,
    'fee_charged',   v_fee_amount,
    'new_balance',   v_wallet.balance,
    'available_balance', v_wallet.available_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_plan_fee(uuid) TO authenticated, service_role;

-- ============================================================================
-- 5. Convenience view — last 7 days wallet activity per user (monitoring)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_wallet_ledger_recent AS
SELECT
  wl.id,
  wl.user_id,
  concat_ws(' ', p.first_name, p.last_name) AS full_name,
  wl.operation,
  wl.source_kind,
  wl.source_ref,
  wl.balance_before,
  wl.balance_after,
  wl.balance_delta,
  wl.locked_balance_before,
  wl.locked_balance_after,
  wl.locked_balance_delta,
  wl.available_balance_before,
  wl.available_balance_after,
  wl.available_balance_delta,
  wl.metadata,
  wl.recorded_at
FROM wallet_ledger wl
JOIN profiles p ON p.id = wl.user_id
WHERE wl.recorded_at >= now() - interval '7 days'
ORDER BY wl.recorded_at DESC;

COMMENT ON VIEW public.v_wallet_ledger_recent IS
  'Shows wallet balance changes from the last 7 days for monitoring. '
  'Restricted to service_role for admin dashboards.';

REVOKE ALL ON public.v_wallet_ledger_recent FROM authenticated;
GRANT  SELECT ON public.v_wallet_ledger_recent TO service_role;

-- ============================================================================
-- 6. RPC: get_my_wallet_ledger — paginated self-service ledger for the mobile app
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_wallet_ledger(
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id                       bigint,
  operation                text,
  source_kind              text,
  source_ref               text,
  balance_before           numeric,
  balance_after            numeric,
  balance_delta            numeric,
  locked_balance_before    numeric,
  locked_balance_after     numeric,
  locked_balance_delta     numeric,
  available_balance_before numeric,
  available_balance_after  numeric,
  available_balance_delta  numeric,
  metadata                 jsonb,
  recorded_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    wl.id,
    wl.operation,
    wl.source_kind,
    wl.source_ref,
    wl.balance_before,
    wl.balance_after,
    wl.balance_delta,
    wl.locked_balance_before,
    wl.locked_balance_after,
    wl.locked_balance_delta,
    wl.available_balance_before,
    wl.available_balance_after,
    wl.available_balance_delta,
    wl.metadata,
    wl.recorded_at
  FROM wallet_ledger wl
  WHERE wl.user_id = v_uid
  ORDER BY wl.recorded_at DESC
  LIMIT  LEAST(p_limit, 200)
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_wallet_ledger(integer, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_wallet_ledger IS
  'Paginated wallet ledger for the authenticated user. '
  'Returns up to 200 entries per call (capped for safety). '
  'Use p_offset for pagination.';
