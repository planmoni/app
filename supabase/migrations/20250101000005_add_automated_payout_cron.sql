/*
  # Add automated payout cron jobs
  
  This migration sets up cron jobs to automatically process and schedule payouts.
  
  1. Cron Jobs
    - process-automated-payouts: Runs every minute to process due payouts immediately
    - schedule-automated-payouts: Runs daily to schedule future payouts
*/

-- Create cron job to process automated payouts every minute (immediate processing)
SELECT cron.schedule(
  'process-automated-payouts',
  '* * * * *', -- Every minute for immediate processing
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/process-automated-payouts',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- Create cron job to schedule automated payouts daily
SELECT cron.schedule(
  'schedule-automated-payouts',
  '0 0 * * *', -- Daily at midnight
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/schedule-automated-payouts',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
); 