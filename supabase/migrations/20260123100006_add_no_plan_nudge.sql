/*
  # No-plan-after-signup nudge (Phase 3 continuation)

  - Add no_plan_nudge_sent_at to profiles (sent once per user until they create a plan).
  - Add no_plan_nudge to push_notifications (default true).
  - Schedule send-no-plan-nudge daily at 11:00 UTC.
*/

-- Track that we sent the "create your first plan" nudge (so we send at most once)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS no_plan_nudge_sent_at timestamptz;

COMMENT ON COLUMN profiles.no_plan_nudge_sent_at IS 'When the no-plan nudge was sent (at most once per user)';

CREATE INDEX IF NOT EXISTS idx_profiles_no_plan_nudge_unsent
ON profiles(created_at)
WHERE no_plan_nudge_sent_at IS NULL;

-- Add no_plan_nudge to push_notifications (only if missing)
UPDATE profiles
SET push_notifications = push_notifications
  || jsonb_build_object(
       'no_plan_nudge', COALESCE((push_notifications->>'no_plan_nudge')::boolean, true)
     )
WHERE push_notifications IS NOT NULL
  AND (push_notifications ? 'no_plan_nudge') = false;

-- Cron: no-plan nudge daily at 11:00 UTC
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-no-plan-nudge',
    '0 11 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-no-plan-nudge',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: no-plan nudge cron job created (job_id = %)', job_id;
END;
$$;
