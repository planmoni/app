/*
  # Vault email notifications

  Sends two emails:
  1) When a vault becomes fully funded (current_balance >= total_budget)
  2) On the vault start date

  Implementation:
  - Edge function `send-vault-emails` runs on a cron schedule.
  - `vault_email_logs` ensures idempotency (one email per vault per type).
*/

-- Track sent vault emails (idempotency + observability)
CREATE TABLE IF NOT EXISTS public.vault_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.budget_plans(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('vault_fully_funded', 'vault_started')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  to_email text,
  subject text,
  provider_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vault_email_logs_plan_type
  ON public.vault_email_logs(plan_id, type);

ALTER TABLE public.vault_email_logs ENABLE ROW LEVEL SECURITY;

-- Service role manages these logs (scheduler/edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vault_email_logs'
      AND policyname = 'Service role can manage vault email logs'
  ) THEN
    CREATE POLICY "Service role can manage vault email logs"
      ON public.vault_email_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Run every hour (UTC) to catch funding + start-day emails.
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'send-vault-emails-hourly',
    '0 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-vault-emails',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      )::jsonb,
      body := '{}'::text
    );
    $cron$
  ) INTO job_id;
  RAISE NOTICE 'Success: vault emails cron job created (job_id = %)', job_id;
END;
$$;

