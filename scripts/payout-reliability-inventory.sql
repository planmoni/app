-- PlanMoni payout reliability inventory
-- Run in Supabase SQL editor (service role / dashboard).
-- Set the window, then run sections. Do NOT paste full account numbers into tickets.

-- =============================================================================
-- 0) Parameters
-- =============================================================================
-- Edit these once:
--   window_start / window_end

-- =============================================================================
-- 1) Master inventory (export this)
-- =============================================================================
WITH params AS (
  SELECT
    timestamptz '2026-08-01 00:00:00+00' AS window_start,
    now() AS window_end
)
SELECT
  ap.id AS internal_payout_id,
  ap.payout_plan_id,
  ap.user_id,
  ap.installment_index,
  ap.amount,
  'NGN' AS currency,
  pp.fee_amount AS plan_fee_amount,
  pp.payout_amount AS plan_installment_amount,
  ap.status AS internal_status,
  'safehaven' AS provider_name,
  ap.transfer_reference AS provider_reference,
  ap.paystack_transfer_id AS legacy_provider_id,
  ap.retry_count,
  ap.error_message,
  ap.scheduled_date,
  ap.created_at,
  ap.updated_at,
  ap.completed_at,
  COALESCE((ap.metadata->>'wallet_debited')::boolean, false) AS wallet_debited,
  COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false) AS wallet_refund_applied,
  COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false) AS safehaven_initiated,
  COALESCE((ap.metadata->>'manual_hold')::boolean, false) AS manual_hold,
  NULLIF(BTRIM(ap.metadata->>'wallet_debited_amount'), '')::numeric AS wallet_debit_amount,
  pp.name AS plan_name,
  pp.status AS plan_status,
  pp.completed_payouts,
  pp.duration,
  pp.next_payout_date,
  left(coalesce(pa.account_number, ''), 3) || '****' || right(coalesce(pa.account_number, ''), 2)
    AS destination_masked,
  pa.bank_name AS destination_bank,
  CASE
    WHEN ap.status = 'completed'
         AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
      THEN 'A_success_internal'
    WHEN COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
         AND ap.status IN ('processing', 'pending', 'retrying')
      THEN 'D_unknown_or_pending_provider'
    WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
         AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
         AND ap.status = 'failed'
      THEN 'F_failed_unrefunded'
    WHEN ap.status = 'failed'
         AND COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
         AND COALESCE((ap.metadata->>'manual_hold')::boolean, false)
      THEN 'E2_failed_refunded_manual_hold'
    WHEN ap.status = 'failed'
         AND COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
      THEN 'E_failed_refunded_retry_eligible'
    WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
         AND NOT COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
      THEN 'C_debited_no_provider_post'
    WHEN COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
         AND ap.status IN ('failed', 'retrying')
         AND NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
      THEN 'B_provider_ref_internal_not_completed'
    ELSE 'Z_other'
  END AS reconciliation_bucket
FROM automated_payouts ap
JOIN payout_plans pp ON pp.id = ap.payout_plan_id
LEFT JOIN payout_accounts pa ON pa.id = COALESCE(ap.payout_account_id, pp.payout_account_id)
CROSS JOIN params
WHERE ap.created_at >= params.window_start
  AND ap.created_at <= params.window_end
ORDER BY ap.created_at DESC;

-- =============================================================================
-- 2) Bucket counts + amounts
-- =============================================================================
WITH params AS (
  SELECT timestamptz '2026-08-01 00:00:00+00' AS window_start, now() AS window_end
),
classified AS (
  SELECT
    ap.*,
    CASE
      WHEN ap.status = 'completed'
           AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
        THEN 'A_success_internal'
      WHEN COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
           AND ap.status IN ('processing', 'pending', 'retrying')
        THEN 'D_unknown_or_pending_provider'
      WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
           AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
           AND ap.status = 'failed'
        THEN 'F_failed_unrefunded'
      WHEN ap.status = 'failed'
           AND COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
           AND COALESCE((ap.metadata->>'manual_hold')::boolean, false)
        THEN 'E2_failed_refunded_manual_hold'
      WHEN ap.status = 'failed'
           AND COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
        THEN 'E_failed_refunded_retry_eligible'
      WHEN COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
           AND NOT COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
        THEN 'C_debited_no_provider_post'
      WHEN COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
           AND ap.status IN ('failed', 'retrying')
           AND NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
        THEN 'B_provider_ref_internal_not_completed'
      ELSE 'Z_other'
    END AS bucket
  FROM automated_payouts ap
  CROSS JOIN params
  WHERE ap.created_at >= params.window_start
    AND ap.created_at <= params.window_end
)
SELECT
  bucket,
  count(*) AS payouts,
  coalesce(sum(amount), 0) AS total_amount,
  count(DISTINCT user_id) AS users
FROM classified
GROUP BY bucket
ORDER BY total_amount DESC;

-- =============================================================================
-- 3) Critical: wallet debited, not refunded, not completed
-- =============================================================================
SELECT
  ap.id,
  ap.user_id,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status,
  ap.transfer_reference,
  ap.metadata->>'wallet_debited_at' AS debited_at,
  ap.error_message,
  ap.updated_at
FROM automated_payouts ap
WHERE COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
  AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
  AND ap.status IS DISTINCT FROM 'completed'
  AND ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
ORDER BY ap.updated_at DESC;

-- =============================================================================
-- 4) Critical: UNKNOWN — SafeHaven initiated, still non-terminal
-- =============================================================================
SELECT
  ap.id,
  ap.user_id,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status,
  ap.transfer_reference,
  ap.created_at,
  ap.updated_at,
  now() - ap.updated_at AS age
FROM automated_payouts ap
WHERE COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
  AND ap.status IN ('processing', 'pending', 'retrying')
  AND ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
ORDER BY ap.updated_at ASC;

-- =============================================================================
-- 5) Suspected duplicates: multiple refs / txs per installment
-- =============================================================================
SELECT
  ap.payout_plan_id,
  ap.installment_index,
  count(*) AS ap_rows,
  array_agg(ap.id) AS ap_ids,
  array_agg(DISTINCT ap.transfer_reference) AS refs,
  array_agg(DISTINCT ap.status) AS statuses
FROM automated_payouts ap
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
GROUP BY ap.payout_plan_id, ap.installment_index
HAVING count(*) > 1
    OR count(DISTINCT NULLIF(BTRIM(ap.transfer_reference), '')) > 1;

SELECT
  t.metadata->>'automated_payout_id' AS automated_payout_id,
  count(*) AS tx_count,
  array_agg(t.id) AS tx_ids,
  array_agg(t.reference) AS references,
  array_agg(t.status) AS statuses,
  sum(t.amount) AS sum_amount
FROM transactions t
WHERE t.type = 'payout'
  AND t.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND t.metadata->>'automated_payout_id' IS NOT NULL
GROUP BY t.metadata->>'automated_payout_id'
HAVING count(*) > 1;

-- =============================================================================
-- 6) Progress stuck (completed AP, next date not advanced)
-- =============================================================================
SELECT
  pp.id AS plan_id,
  pp.user_id,
  pp.name,
  pp.completed_payouts,
  pp.duration,
  pp.next_payout_date,
  ap.id AS blocking_ap_id,
  ap.installment_index,
  ap.scheduled_date,
  ap.amount
FROM payout_plans pp
JOIN automated_payouts ap
  ON ap.payout_plan_id = pp.id
 AND ap.status = 'completed'
 AND ap.scheduled_date = (pp.next_payout_date AT TIME ZONE 'Africa/Lagos')::date
 AND ap.installment_index = pp.completed_payouts
WHERE pp.status = 'active'
  AND pp.next_payout_date IS NOT NULL
  AND pp.next_payout_date <= now()
  AND pp.completed_payouts < pp.duration
ORDER BY pp.next_payout_date;

-- =============================================================================
-- 7) Due queue health
-- =============================================================================
SELECT count(*) AS due_now FROM get_due_payout_plans(now());

SELECT * FROM list_payouts_needing_manual_action();

-- =============================================================================
-- 8) Wallet vs plan locked (sample mismatch users from inventory)
-- =============================================================================
-- Replace :user_id after picking users from critical buckets
-- SELECT public.monitor_user('00000000-0000-0000-0000-000000000000');
-- SELECT public.recalculate_locked_balance('00000000-0000-0000-0000-000000000000');

-- =============================================================================
-- 9) Payout tx without AP / AP without payout tx
-- =============================================================================
SELECT t.id AS tx_id, t.user_id, t.amount, t.status, t.reference, t.created_at
FROM transactions t
WHERE t.type = 'payout'
  AND t.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND (
    t.metadata->>'automated_payout_id' IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM automated_payouts ap
      WHERE ap.id::text = t.metadata->>'automated_payout_id'
    )
  );

SELECT ap.id, ap.user_id, ap.amount, ap.status, ap.transfer_reference
FROM automated_payouts ap
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.type = 'payout'
      AND t.metadata->>'automated_payout_id' = ap.id::text
  );

-- =============================================================================
-- 10) Failure message taxonomy (counts)
-- =============================================================================
SELECT
  coalesce(nullif(btrim(ap.error_message), ''), '(null)') AS failure_message,
  count(*) AS n,
  coalesce(sum(ap.amount), 0) AS amount
FROM automated_payouts ap
WHERE ap.status IN ('failed', 'retrying')
  AND ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
GROUP BY 1
ORDER BY n DESC
LIMIT 50;

-- =============================================================================
-- 11) Ops sanity: confirm these are NOT blindly safe
-- =============================================================================
-- retry-pending-safehaven-transfers: on Failed it marks transactions failed ONLY
--   (no automated_payouts fail, no refund_payout_wallet_debit). Prefer webhook
--   or fail_payout_installment for unreimbursed debits (bucket F).
-- retry-failed-payouts: Paystack-era — verify live cron:
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE command ILIKE '%retry-failed%'
   OR command ILIKE '%retry-pending-safehaven%'
   OR command ILIKE '%process-due-payouts%'
   OR command ILIKE '%reconcile-payout%';

