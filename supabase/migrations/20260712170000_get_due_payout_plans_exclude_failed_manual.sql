-- Exclude failed installments that are unsafe to auto-retry (manual ops / duplicate at SafeHaven).

CREATE OR REPLACE FUNCTION public.get_due_payout_plans(check_at timestamptz)
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  payout_account_id uuid,
  next_payout_date timestamptz,
  completed_payouts integer,
  duration integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id AS plan_id,
    pp.user_id,
    pp.name,
    pp.payout_amount,
    pp.payout_account_id,
    pp.next_payout_date,
    pp.completed_payouts,
    pp.duration
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= check_at
    AND pp.completed_payouts < pp.duration
    AND pp.payout_account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.installment_index = pp.completed_payouts
        AND (
          ap.status = 'completed'
          OR (
            ap.status IN ('pending', 'processing')
            AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
            AND COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
          )
          OR (
            ap.status = 'failed'
            AND (
              COALESCE((ap.metadata->>'manual_hold')::boolean, false)
              OR NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
              OR (
                COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
                AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
              )
            )
          )
        )
    );
END;
$$;

COMMENT ON FUNCTION public.get_due_payout_plans(timestamptz) IS
  'Due plans excluding completed installments, in-flight SafeHaven transfers, and failed rows pending manual review.';
