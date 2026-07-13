-- Repair automated_payouts rows created by create_automated_payout before claim_payout_installment
-- ran (installment_index NULL, legacy auto_payout_* reference, mayCallSafehaven crash).

-- 1) Backfill installment_index so claim_payout_installment can find the row.
UPDATE automated_payouts ap
SET
  installment_index = pp.completed_payouts,
  updated_at = now()
FROM payout_plans pp
WHERE ap.payout_plan_id = pp.id
  AND ap.installment_index IS NULL;

-- 2) Clear bogus legacy references so claim + SafeHaven can proceed (no wallet debit occurred).
UPDATE automated_payouts
SET
  transfer_reference = NULL,
  transfer_code = NULL,
  payment_reference = NULL,
  safehaven_transfer_id = NULL,
  session_id = NULL,
  error_message = NULL,
  status = 'processing',
  metadata = '{}'::jsonb,
  updated_at = now()
WHERE status IN ('processing', 'failed')
  AND COALESCE(metadata, '{}'::jsonb) = '{}'::jsonb
  AND COALESCE((metadata->>'wallet_debited')::boolean, false) = false
  AND transfer_reference LIKE 'auto_payout_%'
  AND (
    error_message IS NULL
    OR error_message ILIKE '%mayCallSafehaven%'
    OR error_message ILIKE '%is not defined%'
  );
