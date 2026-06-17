/*
  HOTFIX — Drop old 2-param wallet function overloads
  ====================================================

  Root cause
  ----------
  Migration 20260416000001_wallet_ledger_audit.sql introduced new 5-param
  versions of the wallet mutation functions (add_funds, lock_funds,
  unlock_funds, transfer_funds) with optional arg_source_kind / arg_source_ref
  / arg_metadata parameters that default to safe values.

  However, CREATE OR REPLACE FUNCTION in PostgreSQL only replaces a function
  when the parameter list matches exactly.  Because the old functions had a
  DIFFERENT signature (2 params: uuid, numeric), PostgreSQL kept the old
  versions alive as separate overloads instead of replacing them.

  This left two live candidates for every call that only supplies 2 args:

      public.transfer_funds(arg_user_id => uuid, arg_amount => numeric)
      public.transfer_funds(arg_user_id => uuid, arg_amount => numeric,
                            arg_source_kind => text, arg_source_ref => text,
                            arg_metadata => jsonb)

  PostgreSQL raises "could not choose the best candidate function" and the
  entire payout run fails.

  Fix
  ---
  Drop every old 2-param overload.  After this migration:
    • Only the 5-param (with defaults) versions exist.
    • Edge function calls that supply only (arg_user_id, arg_amount) will
      resolve unambiguously to the 5-param version, using default values for
      the three optional params — behaviour is identical to before the audit
      migration, plus the new ledger context is attached.

  Also drops:
    • p_user_id / p_amount named 2-param variants (same type signature)
    • The reversed lock_funds(numeric, uuid) overload from an early migration
*/

-- ── transfer_funds ────────────────────────────────────────────────────────────
-- Old: transfer_funds(arg_user_id uuid, arg_amount numeric)  [2 params]
DROP FUNCTION IF EXISTS public.transfer_funds(uuid, numeric);

-- ── add_funds ─────────────────────────────────────────────────────────────────
-- Old: add_funds(arg_user_id uuid, arg_amount numeric)  [2 params]
-- Old: add_funds(p_user_id   uuid, p_amount   numeric)  [2 params, p_ prefix]
-- Both have the same type signature (uuid, numeric) — one DROP covers both
DROP FUNCTION IF EXISTS public.add_funds(uuid, numeric);

-- ── lock_funds ────────────────────────────────────────────────────────────────
-- Old: lock_funds(arg_user_id uuid, arg_amount numeric)  [2 params]
-- Old: lock_funds(p_user_id   uuid, p_amount   numeric)  [2 params, p_ prefix]
DROP FUNCTION IF EXISTS public.lock_funds(uuid, numeric);

-- Old: lock_funds(p_amount numeric, p_user_id uuid)  [reversed params, from quick_bonus migration]
DROP FUNCTION IF EXISTS public.lock_funds(numeric, uuid);

-- ── unlock_funds ──────────────────────────────────────────────────────────────
-- Old: unlock_funds(arg_user_id uuid, arg_amount numeric)  [2 params]
DROP FUNCTION IF EXISTS public.unlock_funds(uuid, numeric);

-- ── Verify nothing was missed ─────────────────────────────────────────────────
-- After this migration, each function should appear exactly once in:
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('transfer_funds','add_funds','lock_funds','unlock_funds');
