/*
  # Add vault retention cron
  Sends vault low-balance reminders daily.
*/

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-vault-retention-push',
    '0 9 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-vault-retention-push',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO job_id;

  RAISE NOTICE 'Success: vault retention cron created (job_id = %)', job_id;
END;
$$;

