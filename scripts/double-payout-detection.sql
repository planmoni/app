-- =============================================================================
-- PlanMoni DOUBLE PAYOUT detection
-- Run in Supabase SQL Editor (production). Fintech investigation only.
-- Do NOT blindly retry anyone on this list.
--
-- Goal: find users/installments that may have been paid more than once,
-- then verify each transfer_reference / sessionId on SafeHaven dashboard.
-- =============================================================================

-- Edit window once:
--   timestamptz '2026-08-01 00:00:00+00'

-- =============================================================================
-- A) HARD SIGNAL: same plan installment has >1 automated_payouts rows
--    (unique index should prevent this when installment_index is set;
--     still check — null indexes / legacy rows can slip)
-- =============================================================================
SELECT
  'A_multiple_ap_rows_same_installment' AS signal,
  ap.payout_plan_id,
  ap.installment_index,
  pp.user_id,
  p.email,
  pp.name AS plan_name,
  count(*) AS ap_rows,
  count(*) FILTER (WHERE ap.status = 'completed') AS completed_rows,
  coalesce(sum(ap.amount) FILTER (WHERE ap.status = 'completed'), 0) AS completed_amount_sum,
  array_agg(ap.id ORDER BY ap.created_at) AS ap_ids,
  array_agg(ap.status ORDER BY ap.created_at) AS statuses,
  array_agg(ap.transfer_reference ORDER BY ap.created_at) AS transfer_refs,
  array_agg(ap.amount ORDER BY ap.created_at) AS amounts,
  array_agg(ap.created_at ORDER BY ap.created_at) AS created_ats
FROM automated_payouts ap
JOIN payout_plans pp ON pp.id = ap.payout_plan_id
LEFT JOIN profiles p ON p.id = pp.user_id
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND ap.installment_index IS NOT NULL
GROUP BY ap.payout_plan_id, ap.installment_index, pp.user_id, p.email, pp.name
HAVING count(*) > 1
   OR count(*) FILTER (WHERE ap.status = 'completed') > 1
ORDER BY completed_rows DESC, completed_amount_sum DESC;

-- =============================================================================
-- B) HARD SIGNAL: same transfer_reference on more than one AP row
--    (one SafeHaven payment reference attached to multiple installments)
-- =============================================================================
SELECT
  'B_duplicate_transfer_reference' AS signal,
  ap.transfer_reference,
  count(*) AS ap_rows,
  count(DISTINCT ap.user_id) AS users,
  count(DISTINCT ap.payout_plan_id) AS plans,
  array_agg(DISTINCT ap.user_id) AS user_ids,
  array_agg(ap.id ORDER BY ap.created_at) AS ap_ids,
  array_agg(ap.status ORDER BY ap.created_at) AS statuses,
  array_agg(ap.amount ORDER BY ap.created_at) AS amounts
FROM automated_payouts ap
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
  AND ap.transfer_reference NOT LIKE 'auto_payout_%'  -- local claim refs before provider
GROUP BY ap.transfer_reference
HAVING count(*) > 1
ORDER BY ap_rows DESC;

-- =============================================================================
-- C) HARD SIGNAL: >1 completed payout transactions for same automated_payout_id



{
  "provider": "safehaven",
  "response": {
    "data": {
      "__v": 0,
      "_id": "6a9cf48094d93d00246615ca",
      "vat": 0.75,
      "fees": 10,
      "type": "Outwards",
      "amount": 2944.25,
      "client": "68cc5b647c6ed100244e2359",
      "queued": false,
      "status": "Processing",
      "account": "68cc5b657c6ed100244e235e",
      "provider": "NIBSS",
      "createdAt": "2026-09-06T05:05:04.112Z",
      "createdBy": "68cc5acc7c6ed100244e0f50",
      "isDeleted": false,
      "narration": "Automated payout: Internet & Data",
      "sessionId": "090286260906050504272764355476",
      "stampDuty": 0,
      "updatedAt": "2026-09-06T05:05:04.112Z",
      "isReversed": false,
      "responseCode": "30",
      "debitKYCLevel": "3",
      "limitExceeded": false,
      "creditKYCLevel": "2",
      "providerChannel": "NIP",
      "responseMessage": "Format error",
      "debitAccountName": "PLANMONI TECHNOLOGIES LIMITED",
      "mandateReference": null,
      "paymentReference": "AUTO_101aca4b-498d-4ed0-bad1-7e188d0d3316_i0_1788671102763",
      "creditAccountName": "JONAH EMMANUEL ABORE",
      "reversalReference": null,
      "debitAccountNumber": "0117753301",
      "creditAccountNumber": "7062591415",
      "providerChannelCode": "2",
      "transactionLocation": "9.0932,7.4429",
      "nameEnquiryReference": "090286260906050502981107716252",
      "destinationInstitutionCode": "090405",
      "debitBankVerificationNumber": null,
      "creditBankVerificationNumber": null
    },
    "message": "Processing",
    "statusCode": 202,
    "responseCode": "30"
  },
  "manual_hold": true,
  "transfer_code": "AUTO_101aca4b-498d-4ed0-bad1-7e188d0d3316_i0_1788671102763",
  "wallet_debited": true,
  "transfer_status": "Processing",
  "installment_index": 0,
  "payment_reference": "AUTO_101aca4b-498d-4ed0-bad1-7e188d0d3316_i0_1788671102763",
  "wallet_debited_at": "2026-09-06T05:05:02.757336+00:00",
  "retry_after_refund": true,
  "wallet_refunded_at": "2026-09-06T05:06:05.304Z",
  "automated_payout_id": "abdf919f-fa8a-4c48-a7e7-6c7a2012df86",
  "wallet_refund_amount": 2944.25,
  "wallet_refund_reason": "Unable to locate record",
  "wallet_refund_wallet": {
    "balance": 2944.25,
    "success": true,
    "locked_balance": 2944.25,
    "available_balance": 0
  },
  "wallet_debited_amount": 2944.25,
  "wallet_refund_applied": true,
  "refunded_failure_count": 2,
  "previous_transfer_references": [
    "AUTO_101aca4b-498d-4ed0-bad1-7e188d0d3316_i0_1788670816038",
    "AUTO_101aca4b-498d-4ed0-bad1-7e188d0d3316_i0_1788671102763"
  ],
  "safehaven_transfer_initiated": true
}
-- =============================================================================
SELECT
  'C_multiple_txs_same_ap' AS signal,
  t.metadata->>'automated_payout_id' AS automated_payout_id,
  t.user_id,
  p.email,
  count(*) AS tx_count,
  count(*) FILTER (WHERE t.status = 'completed') AS completed_tx,
  coalesce(sum(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS completed_amount_sum,
  array_agg(t.id ORDER BY t.created_at) AS tx_ids,
  array_agg(t.reference ORDER BY t.created_at) AS tx_refs,
  array_agg(t.status ORDER BY t.created_at) AS tx_statuses,
  array_agg(t.amount ORDER BY t.created_at) AS amounts
FROM transactions t
LEFT JOIN profiles p ON p.id = t.user_id
WHERE t.type = 'payout'
  AND t.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND t.metadata->>'automated_payout_id' IS NOT NULL
GROUP BY t.metadata->>'automated_payout_id', t.user_id, p.email
HAVING count(*) FILTER (WHERE t.status = 'completed') > 1
ORDER BY completed_amount_sum DESC;

-- =============================================================================
-- D) SUSPECT: installment completed once in DB, but metadata shows prior
--    SafeHaven refs (retry / previous_transfer_references) — VERIFY ON SAFEHAVEN
--    Each previous ref that Succeeded on SafeHaven = possible double pay.
-- =============================================================================
SELECT
  'D_completed_with_previous_provider_refs' AS signal,
  ap.id AS ap_id,
  ap.user_id,
  p.email,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status,
  ap.transfer_reference AS current_ref,
  ap.metadata->>'previous_transfer_references' AS previous_refs_json,
  ap.metadata->>'safehaven_transfer_id' AS safehaven_transfer_id,
  ap.metadata->>'payment_reference' AS payment_reference,
  ap.completed_at,
  ap.updated_at
FROM automated_payouts ap
LEFT JOIN profiles p ON p.id = ap.user_id
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND ap.status = 'completed'
  AND (
    jsonb_typeof(ap.metadata->'previous_transfer_references') = 'array'
    AND jsonb_array_length(ap.metadata->'previous_transfer_references') > 0
  )
ORDER BY ap.completed_at DESC NULLS LAST;

-- =============================================================================
-- E) SUSPECT: SafeHaven initiated + wallet debited, then another AP attempt
--    for same plan/installment after refund/retry — check both refs on SH
-- =============================================================================
SELECT
  'E_initiated_then_retry_path' AS signal,
  ap.id,
  ap.user_id,
  p.email,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status,
  ap.transfer_reference,
  ap.retry_count,
  COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false) AS sh_initiated,
  COALESCE((ap.metadata->>'wallet_debited')::boolean, false) AS wallet_debited,
  COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false) AS wallet_refunded,
  ap.metadata->>'previous_transfer_references' AS previous_refs_json,
  ap.error_message,
  ap.updated_at
FROM automated_payouts ap
LEFT JOIN profiles p ON p.id = ap.user_id
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
  AND (
    ap.retry_count > 0
    OR (
      jsonb_typeof(ap.metadata->'previous_transfer_references') = 'array'
      AND jsonb_array_length(ap.metadata->'previous_transfer_references') > 0
    )
  )
ORDER BY ap.updated_at DESC;

-- =============================================================================
-- F) EXPORT LIST FOR SAFEHAVEN LOOKUP
--    Every distinct provider reference that must be checked on SafeHaven.
--    Match order: transfer_reference → payment_reference → safehaven_transfer_id
-- =============================================================================
SELECT DISTINCT
  ap.user_id,
  p.email,
  ap.id AS ap_id,
  ap.payout_plan_id,
  ap.installment_index,
  ap.amount,
  ap.status AS internal_status,
  ap.transfer_reference,
  ap.metadata->>'payment_reference' AS payment_reference,
  ap.metadata->>'safehaven_transfer_id' AS safehaven_transfer_id,
  ap.metadata->>'session_id' AS session_id,
  COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false) AS sh_initiated,
  ap.created_at,
  ap.completed_at
FROM automated_payouts ap
LEFT JOIN profiles p ON p.id = ap.user_id
WHERE ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
  AND (
    COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
    OR NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
    OR NULLIF(BTRIM(ap.metadata->>'safehaven_transfer_id'), '') IS NOT NULL
  )
ORDER BY ap.created_at DESC;

-- =============================================================================
-- G) USER-LEVEL: who has the most completed payout amount vs expected
--    (duration * installment can oversimplify custom plans — use as triage)
-- =============================================================================
SELECT
  pp.user_id,
  p.email,
  pp.id AS plan_id,
  pp.name,
  pp.status AS plan_status,
  pp.duration,
  pp.completed_payouts,
  pp.payout_amount,
  pp.total_amount AS plan_total,
  count(ap.*) FILTER (WHERE ap.status = 'completed') AS completed_ap_count,
  coalesce(sum(ap.amount) FILTER (WHERE ap.status = 'completed'), 0) AS completed_ap_amount,
  CASE
    WHEN coalesce(sum(ap.amount) FILTER (WHERE ap.status = 'completed'), 0)
         > (pp.total_amount * 1.05)  -- 5% tolerance
      THEN 'OVERPAID_VS_PLAN_TOTAL'
    WHEN count(ap.*) FILTER (WHERE ap.status = 'completed') > pp.duration
      THEN 'MORE_COMPLETED_APS_THAN_DURATION'
    ELSE 'OK_OR_CHECK_MANUAL'
  END AS triage
FROM payout_plans pp
LEFT JOIN profiles p ON p.id = pp.user_id
LEFT JOIN automated_payouts ap
  ON ap.payout_plan_id = pp.id
 AND ap.created_at >= timestamptz '2026-08-01 00:00:00+00'
WHERE pp.created_at >= timestamptz '2026-07-01 00:00:00+00'
GROUP BY pp.user_id, p.email, pp.id, pp.name, pp.status, pp.duration,
         pp.completed_payouts, pp.payout_amount, pp.total_amount
HAVING
  coalesce(sum(ap.amount) FILTER (WHERE ap.status = 'completed'), 0) > (pp.total_amount * 1.05)
  OR count(ap.*) FILTER (WHERE ap.status = 'completed') > pp.duration
ORDER BY completed_ap_amount DESC;

-- =============================================================================
-- H) HOW TO VERIFY ON SAFEHAVEN (ops checklist — not SQL)
-- =============================================================================
-- For each row in A–F:
--   1. Copy transfer_reference / payment_reference / safehaven_transfer_id
--   2. Look up on SafeHaven dashboard (Outward transfers)
--   3. Record provider status: Success | Failed | Pending | Not found
--   4. Classify:
--        DOUBLE_PAID     = ≥2 Success refs for same (plan_id, installment_index)
--        PAID_ONCE_OK    = exactly 1 Success, internal completed
--        PAID_USER_OURS_FAILED = Success on SH, internal failed/unrefunded
--        NOT_PAID_USER_OURS_COMPLETED = no Success on SH, we marked completed
--        UNKNOWN         = Pending / timeout / no ref
--   5. Do NOT retry anyone with a Success or Pending provider ref
-- =============================================================================
