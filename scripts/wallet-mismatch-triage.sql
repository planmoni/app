-- =============================================================================
-- Wallet mismatch triage (PlanMoni)
-- Run in SQL editor. Does NOT auto-fix money — diagnose first.
-- Expected invariants:
--   1) balance ≈ locked_balance + available_balance
--   2) locked_balance ≈ sum of remaining locked on active/paused plans
-- Failures (unrefunded debit, double debit, stuck lock) break these.
-- =============================================================================

-- A) Internal wallet math broken: balance ≠ locked + available
SELECT
  'A_balance_ne_locked_plus_available' AS signal,
  w.user_id,
  p.email,
  w.balance,
  w.locked_balance,
  w.available_balance,
  (w.locked_balance + w.available_balance) AS locked_plus_available,
  (w.balance - (w.locked_balance + w.available_balance)) AS delta
FROM wallets w
LEFT JOIN profiles p ON p.id = w.user_id
WHERE ABS(w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))) >= 0.01
ORDER BY ABS(w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))) DESC
LIMIT 200;

-- B) Unrefunded payout debits (wallet money gone / locked wrong until fixed)
SELECT
  'B_failed_unrefunded_debit' AS signal,
  ap.id AS ap_id,
  ap.user_id,
  p.email,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status,
  ap.transfer_reference,
  ap.metadata->>'wallet_debited' AS wallet_debited,
  ap.metadata->>'wallet_refund_applied' AS wallet_refund_applied,
  ap.metadata->>'safehaven_transfer_initiated' AS sh_initiated,
  ap.error_message,
  ap.updated_at
FROM automated_payouts ap
LEFT JOIN profiles p ON p.id = ap.user_id
WHERE COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
  AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
  AND ap.status IS DISTINCT FROM 'completed'
  AND ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
ORDER BY ap.updated_at DESC
LIMIT 200;

-- C) Per-user: run monitor_user for a suspect (replace UUID)
-- SELECT jsonb_pretty(public.monitor_user('297e2d99-0063-4ebd-8557-6391e15685d9'));

-- D) After review ONLY — recalc locked from active plans (does not invent missing cash)
-- SELECT public.recalculate_locked_balance('297e2d99-0063-4ebd-8557-6391e15685d9');

-- E) Wallet vs ledger sanity (last 30 days deltas) — optional sample
-- Compare wallet_ledger net change to wallet row for a user if you have a case.
