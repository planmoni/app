/*
  # Add mid_plan_push_sent_at to payout_plans (Phase 2 retention)

  Tracks that we sent the "mid-plan" nudge for this plan so we only send once.
*/

ALTER TABLE payout_plans
ADD COLUMN IF NOT EXISTS mid_plan_push_sent_at timestamptz;

COMMENT ON COLUMN payout_plans.mid_plan_push_sent_at IS 'When the mid-plan push notification was sent (once per plan)';

CREATE INDEX IF NOT EXISTS idx_payout_plans_mid_plan_unsent
ON payout_plans(status, completed_payouts, duration)
WHERE status = 'active' AND mid_plan_push_sent_at IS NULL;
