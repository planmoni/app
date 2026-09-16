/*
  Fraud / user activity risk (v1)

  - user_risk_events: deduped signals for ops
  - fraud_scan_runs: cron run log
  - collect_user_risk_signals: rule scan (read-only money)
  - list_open_fraud_signals: ops helper
  - pg_cron hourly → scan-user-risk edge function

  Critical signals may set profiles.post_no_debit (edge function).
  No auto wallet credit / payout mutation.
*/

-- ---------------------------------------------------------------------------
-- 1) Events + run log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  signal text NOT NULL,
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  action_taken text NOT NULL DEFAULT 'none'
    CHECK (action_taken IN ('none', 'pnd', 'noted')),
  emailed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_risk_events_dedupe_key_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_user_risk_events_open
  ON public.user_risk_events (severity, last_seen_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_risk_events_user
  ON public.user_risk_events (user_id, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fraud_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  signals_found integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  pnd_applied integer NOT NULL DEFAULT 0,
  email_sent boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fraud_scan_runs_ran_at
  ON public.fraud_scan_runs (ran_at DESC);

ALTER TABLE public.user_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_scan_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_risk_events'
      AND policyname = 'Service role can manage user_risk_events'
  ) THEN
    CREATE POLICY "Service role can manage user_risk_events"
      ON public.user_risk_events FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fraud_scan_runs'
      AND policyname = 'Service role can manage fraud_scan_runs'
  ) THEN
    CREATE POLICY "Service role can manage fraud_scan_runs"
      ON public.fraud_scan_runs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.user_risk_events IS
  'Fraud/activity signals. Critical may trigger post_no_debit via scan-user-risk. No money movement.';
COMMENT ON TABLE public.fraud_scan_runs IS
  'Audit log for scan-user-risk cron runs.';

-- ---------------------------------------------------------------------------
-- 2) Upsert helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_user_risk_event(
  p_user_id uuid,
  p_signal text,
  p_severity text,
  p_summary text,
  p_details jsonb,
  p_dedupe_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.user_risk_events (
    user_id, signal, severity, summary, details, dedupe_key, last_seen_at
  ) VALUES (
    p_user_id, p_signal, p_severity, p_summary, COALESCE(p_details, '{}'::jsonb), p_dedupe_key, now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    last_seen_at = now(),
    summary = EXCLUDED.summary,
    details = EXCLUDED.details,
    severity = EXCLUDED.severity,
    -- reopen if previously resolved and signal fires again
    resolved_at = CASE
      WHEN user_risk_events.resolved_at IS NOT NULL THEN NULL
      ELSE user_risk_events.resolved_at
    END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_risk_event(uuid, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_risk_event(uuid, text, text, text, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Collect signals (read-only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.collect_user_risk_signals(
  p_lookback_hours integer DEFAULT 72,
  p_pass_through_min numeric DEFAULT 100000,
  p_pass_through_window_hours integer DEFAULT 6,
  p_dest_velocity_count integer DEFAULT 3,
  p_dest_velocity_hours integer DEFAULT 24,
  p_high_payout_min numeric DEFAULT 100000,
  p_locked_delta_min numeric DEFAULT 100
)
RETURNS TABLE(
  user_id uuid,
  signal text,
  severity text,
  summary text,
  details jsonb,
  dedupe_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(hours => GREATEST(p_lookback_hours, 1));
BEGIN
  -- A) Pass-through: large deposit then payout plan soon after
  RETURN QUERY
  SELECT
    d.user_id,
    'PASS_THROUGH_DEPOSIT_PAYOUT'::text,
    'critical'::text,
    format(
      'Large deposit ₦%s then payout plan within %s hours (plan ₦%s)',
      round(d.amount::numeric, 2),
      p_pass_through_window_hours,
      round(pp.total_amount::numeric, 2)
    ),
    jsonb_build_object(
      'deposit_id', d.id,
      'deposit_amount', d.amount,
      'deposit_at', d.created_at,
      'deposit_reference', d.reference,
      'plan_id', pp.id,
      'plan_total', pp.total_amount,
      'plan_created_at', pp.created_at
    ),
    'pass_through:' || d.user_id::text || ':' || d.id::text || ':' || pp.id::text
  FROM public.transactions d
  JOIN public.payout_plans pp
    ON pp.user_id = d.user_id
   AND pp.created_at >= d.created_at
   AND pp.created_at <= d.created_at + make_interval(hours => p_pass_through_window_hours)
  WHERE d.type = 'deposit'
    AND d.status = 'completed'
    AND d.created_at >= v_since
    AND d.amount >= p_pass_through_min
    AND pp.total_amount >= (p_pass_through_min * 0.5);

  -- B) Destination velocity: many payout accounts added quickly
  RETURN QUERY
  WITH recent AS (
    SELECT
      pa.user_id,
      count(*)::integer AS acct_count,
      min(pa.created_at) AS first_at,
      max(pa.created_at) AS last_at,
      array_agg(pa.id ORDER BY pa.created_at) AS account_ids
    FROM public.payout_accounts pa
    WHERE pa.created_at >= now() - make_interval(hours => p_dest_velocity_hours)
    GROUP BY pa.user_id
    HAVING count(*) >= p_dest_velocity_count
  )
  SELECT
    r.user_id,
    'DESTINATION_VELOCITY'::text,
    'warning'::text,
    format('%s payout destinations added within %s hours', r.acct_count, p_dest_velocity_hours),
    jsonb_build_object(
      'account_count', r.acct_count,
      'first_at', r.first_at,
      'last_at', r.last_at,
      'account_ids', to_jsonb(r.account_ids)
    ),
    'dest_velocity:' || r.user_id::text || ':' || to_char(r.first_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  FROM recent r;

  -- C) Suspicious login + high-value payout plan
  RETURN QUERY
  SELECT DISTINCT ON (pp.user_id, pp.id)
    pp.user_id,
    'SUSPICIOUS_SESSION_HIGH_PAYOUT'::text,
    'warning'::text,
    format(
      'Suspicious login session and high-value payout plan ₦%s',
      round(pp.total_amount::numeric, 2)
    ),
    jsonb_build_object(
      'plan_id', pp.id,
      'plan_total', pp.total_amount,
      'plan_created_at', pp.created_at,
      'session_id', ls.id,
      'session_created_at', ls.created_at
    ),
    'suspicious_high_payout:' || pp.id::text
  FROM public.payout_plans pp
  JOIN public.login_sessions ls
    ON ls.user_id = pp.user_id
   AND ls.is_suspicious IS TRUE
   AND ls.created_at >= v_since - interval '7 days'
  WHERE pp.created_at >= v_since
    AND pp.total_amount >= p_high_payout_min
  ORDER BY pp.user_id, pp.id, ls.created_at DESC;

  -- D) Locked balance vs active/paused plans (integrity)
  RETURN QUERY
  WITH plan_lock AS (
    SELECT
      pp.user_id,
      coalesce(sum(
        greatest(
          0,
          coalesce(pp.net_payout_amount, pp.total_amount, 0)
            - (coalesce(pp.completed_payouts, 0) * coalesce(pp.payout_amount, 0))
        )
      ), 0) AS expected_locked
    FROM public.payout_plans pp
    WHERE pp.status IN ('active', 'paused')
    GROUP BY pp.user_id
  )
  SELECT
    w.user_id,
    'LOCKED_BALANCE_MISMATCH'::text,
    'critical'::text,
    format(
      'Wallet locked ₦%s vs plan-expected ₦%s (delta ₦%s)',
      round(coalesce(w.locked_balance, 0)::numeric, 2),
      round(pl.expected_locked::numeric, 2),
      round(abs(coalesce(w.locked_balance, 0) - pl.expected_locked)::numeric, 2)
    ),
    jsonb_build_object(
      'wallet_locked', coalesce(w.locked_balance, 0),
      'expected_locked', pl.expected_locked,
      'delta', coalesce(w.locked_balance, 0) - pl.expected_locked,
      'wallet_balance', coalesce(w.balance, 0)
    ),
    'locked_mismatch:' || w.user_id::text || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  FROM public.wallets w
  JOIN plan_lock pl ON pl.user_id = w.user_id
  WHERE abs(coalesce(w.locked_balance, 0) - pl.expected_locked) >= p_locked_delta_min;

  -- E) Promote recent deposit recon critical/warning findings (if table exists)
  IF to_regclass('public.deposit_reconciliation_runs') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      NULLIF(f->>'user_id', '')::uuid,
      'DEPOSIT_RECON_' || coalesce(f->>'signal', 'FINDING'),
      CASE
        WHEN lower(coalesce(f->>'severity', '')) = 'critical' THEN 'critical'
        ELSE 'warning'
      END,
      coalesce(f->>'summary', 'Deposit reconciliation finding'),
      f || jsonb_build_object('source', 'deposit_reconciliation_runs'),
      'deposit_recon:' || coalesce(f->>'finding_key', f->>'reference', md5(f::text))
    FROM (
      SELECT jsonb_array_elements(coalesce(details->'findings', '[]'::jsonb)) AS f
      FROM public.deposit_reconciliation_runs
      WHERE ran_at >= v_since
        AND email_sent = true
      ORDER BY ran_at DESC
      LIMIT 5
    ) x
    WHERE coalesce(f->>'severity', '') IN ('critical', 'warning');
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.collect_user_risk_signals(integer, numeric, integer, integer, integer, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_user_risk_signals(integer, numeric, integer, integer, integer, numeric, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Ops helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_open_fraud_signals(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  email text,
  signal text,
  severity text,
  summary text,
  action_taken text,
  created_at timestamptz,
  last_seen_at timestamptz,
  details jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.user_id,
    p.email,
    e.signal,
    e.severity,
    e.summary,
    e.action_taken,
    e.created_at,
    e.last_seen_at,
    e.details
  FROM public.user_risk_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.resolved_at IS NULL
  ORDER BY
    CASE e.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
    e.last_seen_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.list_open_fraud_signals(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_open_fraud_signals(integer) TO service_role;

COMMENT ON FUNCTION public.list_open_fraud_signals(integer) IS
  'Open fraud/activity signals for ops. Pair with monitor_user(user_id).';

-- ---------------------------------------------------------------------------
-- 5) Hourly cron
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scan-user-risk-1h') THEN
    PERFORM cron.unschedule('scan-user-risk-1h');
  END IF;

  PERFORM cron.schedule(
    'scan-user-risk-1h',
    '20 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_internal_supabase_url() || '/functions/v1/scan-user-risk',
      headers := public.get_internal_supabase_auth_headers(),
      body := '{}'::jsonb
    );
    $cron$
  );
END;
$$;
