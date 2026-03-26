/*
  Phase 2: hourly invoke process-vault-payout-schedules (stub).
  Replace URL with your project ref if different from existing vault email cron.
*/

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'process-vault-payout-schedules-hourly',
    '15 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-vault-payout-schedules',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      )::jsonb,
      body := '{}'::text
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: vault payout schedule cron job created (job_id = %)', job_id;
END;
$$;
