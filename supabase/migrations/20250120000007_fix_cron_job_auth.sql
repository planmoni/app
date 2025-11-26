/*
  # Fix cron job authentication
  
  This migration updates the cron job to remove the Authorization header
  since JWT verification is disabled for the send-push-notifications function.
*/

-- Update the cron job to remove Authorization header (JWT verification is disabled)
SELECT cron.alter_job(
  50,
  schedule := '*/2 * * * *',
  command := $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      'https://rqmpnoaavyizlwzfngpr.supabase.co'
    ) || '/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::text
  );
  $$
);

COMMENT ON FUNCTION cron.alter_job IS 'Updated cron job 50 to remove Authorization header since JWT verification is disabled';

