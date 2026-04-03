/*
  # Hourly lifecycle retargeting (abandonment) push

  Calls process-lifecycle-retargeting Edge Function.

  IMPORTANT: Ensure cron HTTP headers include a valid service role JWT (and apikey if required).
  If current_setting('app.settings.service_role_key', true) is NULL, set the database setting
  or replace this job with an explicit key via Dashboard SQL (do not commit secrets to git).
*/

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'process-lifecycle-retargeting',
    '0 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-lifecycle-retargeting',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), ''),
        'apikey', coalesce(current_setting('app.settings.service_role_key', true), '')
      )
    );
    $cron$
  ) INTO job_id;

  RAISE NOTICE 'Success: process-lifecycle-retargeting cron created (job_id = %)', job_id;
END;
$$;
