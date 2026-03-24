/*
  # Add Auto Top-Up Cron Job
  
  This migration sets up a cron job to automatically process expense plan top-ups.
  
  Cron Job:
    - schedule-expense-plan-topup: Runs daily at 2 AM UTC to process scheduled top-ups
*/

-- Create cron job to process expense plan auto top-ups daily at 2 AM UTC
-- Note: Replace 'rqmpnoaavyizlwzfngpr' with your actual Supabase project reference
SELECT cron.schedule(
  'schedule-expense-plan-topup',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/schedule-expense-plan-topup',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    )::jsonb,
    body := '{}'::text
  );
  $$
);

