/*
  # Fix push notification cron job URL
  
  This migration updates the cron job to use the correct Supabase project URL.
  The cron job serves as a backup to catch any notifications that weren't
  processed by the immediate trigger.
*/

-- Unschedule the old cron job if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-push-notifications'
  ) THEN
    PERFORM cron.unschedule('send-push-notifications');
    RAISE NOTICE 'Unscheduled old send-push-notifications cron job';
  END IF;
END $$;

-- Create/update cron job with correct URL
-- This serves as a backup to catch any missed notifications
-- The cron job runs every 2 minutes as a backup to process any notifications 
-- that may have been missed by the immediate trigger
SELECT cron.schedule(
  'send-push-notifications',
  '*/2 * * * *', -- Every 2 minutes (backup for immediate triggers)
  $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      'https://rqmpnoaavyizlwzfngpr.supabase.co'
    ) || '/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        ''
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::text
  );
  $$
);

