/*
  Deposit reconciliation (email-only — no wallet / credit fixes)

  - deposit_reconciliation_runs: log each cron run + emailed finding keys
  - pg_cron hourly → reconcile-deposits edge function
*/

CREATE TABLE IF NOT EXISTS public.deposit_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  paystack_checked integer NOT NULL DEFAULT 0,
  safehaven_checked integer NOT NULL DEFAULT 0,
  finding_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_deposit_reconciliation_runs_ran_at
  ON public.deposit_reconciliation_runs (ran_at DESC);

ALTER TABLE public.deposit_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deposit_reconciliation_runs'
      AND policyname = 'Service role can manage deposit reconciliation runs'
  ) THEN
    CREATE POLICY "Service role can manage deposit reconciliation runs"
      ON public.deposit_reconciliation_runs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.deposit_reconciliation_runs IS
  'Ops audit log for reconcile-deposits. Findings are emailed only — no auto-credit.';

-- Hourly deposit reconciliation (read + email only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-deposits-1h') THEN
    PERFORM cron.unschedule('reconcile-deposits-1h');
  END IF;

  PERFORM cron.schedule(
    'reconcile-deposits-1h',
    '45 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_internal_supabase_url() || '/functions/v1/reconcile-deposits',
      headers := public.get_internal_supabase_auth_headers(),
      body := '{}'::jsonb
    );
    $cron$
  );
END;
$$;
