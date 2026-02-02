/*
  # Re-engagement push preference and cron (Phase 3 retention)

  - Add re_engagement to push_notifications for existing profiles (default true).
  - Schedule send-re-engagement-push daily at 10:00 UTC.
*/

-- Add re_engagement to push_notifications (only if missing)
UPDATE profiles
SET push_notifications = push_notifications
  || jsonb_build_object(
       're_engagement', COALESCE((push_notifications->>'re_engagement')::boolean, true)
     )
WHERE push_notifications IS NOT NULL
  AND (push_notifications ? 're_engagement') = false;

-- Cron: re-engagement push daily at 10:00 UTC
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-re-engagement-push',
    '0 10 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-re-engagement-push',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: re-engagement cron job created (job_id = %)', job_id;
END;
$$;
