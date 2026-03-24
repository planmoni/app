/*
  # Add cron job for daily digest push (Phase 2 retention)

  Invokes send-daily-digest once daily at 08:00 UTC.
  Note: cron.schedule() returns the new job ID (e.g. 58) — that means success.
*/

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-daily-digest',
    '0 8 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-daily-digest',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: daily digest cron job created (job_id = %)', job_id;
END;
$$;
