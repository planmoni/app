/*
  # Deposit-but-no-plan nudge (Phase 3 continuation)

  - Add deposit_no_plan_nudge_sent_at to profiles (sent once per user).
  - Add deposit_no_plan_nudge to push_notifications (default true).
  - Schedule send-deposit-no-plan-nudge daily at 12:00 UTC.
*/

-- Track that we sent the "you've got funds, create a plan" nudge (at most once)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS deposit_no_plan_nudge_sent_at timestamptz;

COMMENT ON COLUMN profiles.deposit_no_plan_nudge_sent_at IS 'When the deposit-but-no-plan nudge was sent (at most once per user)';

CREATE INDEX IF NOT EXISTS idx_profiles_deposit_no_plan_unsent
ON profiles(id)
WHERE deposit_no_plan_nudge_sent_at IS NULL;

-- Add deposit_no_plan_nudge to push_notifications (only if missing)
UPDATE profiles
SET push_notifications = push_notifications
  || jsonb_build_object(
       'deposit_no_plan_nudge', COALESCE((push_notifications->>'deposit_no_plan_nudge')::boolean, true)
     )
WHERE push_notifications IS NOT NULL
  AND (push_notifications ? 'deposit_no_plan_nudge') = false;

-- Cron: deposit-no-plan nudge daily at 12:00 UTC
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-deposit-no-plan-nudge',
    '0 12 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-deposit-no-plan-nudge',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: deposit-no-plan nudge cron job created (job_id = %)', job_id;
END;
$$;
