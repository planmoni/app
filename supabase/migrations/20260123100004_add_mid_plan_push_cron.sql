/*
  # Add cron job for mid-plan push (Phase 2 retention)

  Invokes send-mid-plan-push once daily at 09:00 UTC.
*/

SELECT cron.schedule(
  'send-mid-plan-push',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-mid-plan-push',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);
