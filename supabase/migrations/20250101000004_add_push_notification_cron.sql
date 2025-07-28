/*
  # Add push notification cron job
  
  This migration sets up a cron job to process push notifications from the queue.
  
  1. Cron Jobs
    - send-push-notifications: Runs every 2 minutes to process pending notifications
*/

-- Create cron job to process push notifications every 2 minutes
SELECT cron.schedule(
  'send-push-notifications',
  '*/2 * * * *', -- Every 2 minutes
  'SELECT net.http_post(
    url := ''https://your-project-ref.supabase.co/functions/v1/send-push-notifications'',
    headers := ''{"Authorization": "Bearer " || current_setting(''app.settings.service_role_key'')}''::jsonb
  );'
); 