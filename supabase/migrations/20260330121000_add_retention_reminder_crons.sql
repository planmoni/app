/*
  # Add zero-balance and unfunded-vault reminder crons

  Both jobs run daily. Function-level cooldown logic controls actual send cadence.
*/

DO $$
DECLARE
  zero_balance_job_id bigint;
  unfunded_vault_job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-zero-balance-reminder',
    '0 11 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-zero-balance-reminder',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO zero_balance_job_id;

  SELECT cron.schedule(
    'send-unfunded-vault-reminder',
    '30 11 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-unfunded-vault-reminder',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $cron$
  ) INTO unfunded_vault_job_id;

  RAISE NOTICE 'Success: zero-balance reminder cron created (job_id = %)', zero_balance_job_id;
  RAISE NOTICE 'Success: unfunded-vault reminder cron created (job_id = %)', unfunded_vault_job_id;
END;
$$;
