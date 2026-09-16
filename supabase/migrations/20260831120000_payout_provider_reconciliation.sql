/*
  Payout provider reconciliation (SafeHaven) + per-user report + unreimbursed debits

  - payout_provider_checks: store SafeHaven lookup vs internal AP status
  - list_ap_for_provider_reconciliation: queue for edge function (read-only)
  - upsert_payout_provider_checks: persist check results
  - get_user_payout_reconciliation_report: ops drill-down for one user
  - list_failed_unrefunded_payout_debits: wallet debit without refund signal
  - pg_cron hourly → reconcile-payout-provider edge function
*/

-- ---------------------------------------------------------------------------
-- 1) Provider check results
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_provider_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_id uuid NOT NULL REFERENCES public.automated_payouts (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.payout_plans (id) ON DELETE SET NULL,
  payment_reference text,
  session_id text,
  internal_status text NOT NULL,
  provider_status text,
  provider_response_code text,
  classification text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  summary text NOT NULL,
  provider_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ap_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_provider_checks_classification
  ON public.payout_provider_checks (classification, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_provider_checks_critical_open
  ON public.payout_provider_checks (checked_at DESC)
  WHERE severity IN ('warning', 'critical');

ALTER TABLE public.payout_provider_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_provider_checks'
      AND policyname = 'Service role can manage payout provider checks'
  ) THEN
    CREATE POLICY "Service role can manage payout provider checks"
      ON public.payout_provider_checks
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Queue AP rows for SafeHaven status lookup (no money movement)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_ap_for_provider_reconciliation(
  p_since timestamptz DEFAULT timestamptz '2026-08-01 00:00:00+00',
  p_limit integer DEFAULT 25,
  p_recheck_hours integer DEFAULT 24
)
RETURNS TABLE(
  ap_id uuid,
  user_id uuid,
  plan_id uuid,
  installment_index integer,
  amount numeric,
  internal_status text,
  transfer_reference text,
  payment_reference text,
  session_id text,
  email text,
  plan_name text,
  last_checked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      ap.id AS ap_id,
      ap.user_id,
      ap.payout_plan_id AS plan_id,
      ap.installment_index,
      ap.amount,
      ap.status AS internal_status,
      NULLIF(BTRIM(ap.transfer_reference), '') AS transfer_reference,
      NULLIF(BTRIM(ap.metadata->>'payment_reference'), '') AS payment_reference,
      COALESCE(
        NULLIF(BTRIM(ap.metadata->>'safehaven_transfer_session_id'), ''),
        NULLIF(BTRIM(ap.metadata->>'session_id'), ''),
        NULLIF(BTRIM(ap.metadata->>'sessionId'), '')
      ) AS session_id,
      p.email,
      pp.name AS plan_name
    FROM automated_payouts ap
    LEFT JOIN profiles p ON p.id = ap.user_id
    LEFT JOIN payout_plans pp ON pp.id = ap.payout_plan_id
    WHERE ap.created_at >= p_since
      AND (
        COALESCE((ap.metadata->>'safehaven_transfer_initiated')::boolean, false)
        OR NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
        OR NULLIF(BTRIM(ap.metadata->>'safehaven_transfer_id'), '') IS NOT NULL
      )
      AND (
        NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
        OR NULLIF(BTRIM(ap.metadata->>'payment_reference'), '') IS NOT NULL
        OR NULLIF(BTRIM(ap.metadata->>'safehaven_transfer_session_id'), '') IS NOT NULL
        OR NULLIF(BTRIM(ap.metadata->>'session_id'), '') IS NOT NULL
        OR NULLIF(BTRIM(ap.metadata->>'sessionId'), '') IS NOT NULL
      )
      AND ap.transfer_reference NOT LIKE 'auto_payout_%'
  ),
  with_last_check AS (
    SELECT
      c.*,
      (
        SELECT max(pc.checked_at)
        FROM payout_provider_checks pc
        WHERE pc.ap_id = c.ap_id
      ) AS last_checked_at
    FROM candidates c
  )
  SELECT
    w.ap_id,
    w.user_id,
    w.plan_id,
    w.installment_index,
    w.amount,
    w.internal_status,
    w.transfer_reference,
    w.payment_reference,
    w.session_id,
    w.email,
    w.plan_name,
    w.last_checked_at
  FROM with_last_check w
  WHERE w.last_checked_at IS NULL
     OR w.last_checked_at < now() - make_interval(hours => GREATEST(COALESCE(p_recheck_hours, 24), 1))
  ORDER BY w.last_checked_at NULLS FIRST, w.ap_id
  LIMIT GREATEST(COALESCE(p_limit, 25), 1);
$$;

COMMENT ON FUNCTION public.list_ap_for_provider_reconciliation(timestamptz, integer, integer) IS
  'Returns automated_payouts with SafeHaven refs due for provider status lookup. Read-only.';

REVOKE ALL ON FUNCTION public.list_ap_for_provider_reconciliation(timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ap_for_provider_reconciliation(timestamptz, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Upsert provider check rows
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_payout_provider_checks(
  p_checks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_upserted integer := 0;
BEGIN
  IF p_checks IS NULL OR jsonb_typeof(p_checks) <> 'array' THEN
    RETURN jsonb_build_object('upserted', 0);
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_checks)
  LOOP
    INSERT INTO public.payout_provider_checks (
      ap_id,
      user_id,
      plan_id,
      payment_reference,
      session_id,
      internal_status,
      provider_status,
      provider_response_code,
      classification,
      severity,
      summary,
      provider_raw,
      checked_at
    )
    VALUES (
      (v_row->>'ap_id')::uuid,
      NULLIF(v_row->>'user_id', '')::uuid,
      NULLIF(v_row->>'plan_id', '')::uuid,
      NULLIF(v_row->>'payment_reference', ''),
      NULLIF(v_row->>'session_id', ''),
      COALESCE(v_row->>'internal_status', 'unknown'),
      NULLIF(v_row->>'provider_status', ''),
      NULLIF(v_row->>'provider_response_code', ''),
      COALESCE(v_row->>'classification', 'UNKNOWN'),
      COALESCE(v_row->>'severity', 'info'),
      COALESCE(v_row->>'summary', v_row->>'classification'),
      COALESCE(v_row->'provider_raw', '{}'::jsonb),
      COALESCE((v_row->>'checked_at')::timestamptz, now())
    )
    ON CONFLICT (ap_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      plan_id = EXCLUDED.plan_id,
      internal_status = EXCLUDED.internal_status,
      provider_status = EXCLUDED.provider_status,
      provider_response_code = EXCLUDED.provider_response_code,
      classification = EXCLUDED.classification,
      severity = EXCLUDED.severity,
      summary = EXCLUDED.summary,
      provider_raw = EXCLUDED.provider_raw,
      checked_at = EXCLUDED.checked_at;

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', v_upserted);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_payout_provider_checks(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_payout_provider_checks(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Unreimbursed failed payout debits (wallet signal)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_failed_unrefunded_payout_debits(
  p_since timestamptz DEFAULT timestamptz '2026-08-01 00:00:00+00',
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  finding_key text,
  signal text,
  severity text,
  user_id uuid,
  plan_id uuid,
  ap_id uuid,
  email text,
  summary text,
  details jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ('failed_unrefunded_debit:' || ap.id::text) AS finding_key,
    'failed_unrefunded_debit'::text AS signal,
    'critical'::text AS severity,
    ap.user_id,
    ap.payout_plan_id AS plan_id,
    ap.id AS ap_id,
    p.email,
    format(
      'Wallet debited ₦%s on failed AP (installment %s) — no refund applied',
      ap.amount,
      ap.installment_index
    ) AS summary,
    jsonb_build_object(
      'installment_index', ap.installment_index,
      'amount', ap.amount,
      'ap_status', ap.status,
      'transfer_reference', ap.transfer_reference,
      'wallet_debited', ap.metadata->>'wallet_debited',
      'wallet_refund_applied', ap.metadata->>'wallet_refund_applied',
      'safehaven_transfer_initiated', ap.metadata->>'safehaven_transfer_initiated',
      'error_message', ap.error_message,
      'updated_at', ap.updated_at
    ) AS details
  FROM automated_payouts ap
  LEFT JOIN profiles p ON p.id = ap.user_id
  WHERE ap.created_at >= p_since
    AND COALESCE((ap.metadata->>'wallet_debited')::boolean, false)
    AND NOT COALESCE((ap.metadata->>'wallet_refund_applied')::boolean, false)
    AND ap.status IS DISTINCT FROM 'completed'
  ORDER BY ap.updated_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

REVOKE ALL ON FUNCTION public.list_failed_unrefunded_payout_debits(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_failed_unrefunded_payout_debits(timestamptz, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Per-user reconciliation report (ops)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_payout_reconciliation_report(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monitor jsonb;
  v_findings jsonb;
  v_provider jsonb;
  v_open jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'User not found', 'user_id', p_user_id);
  END IF;

  v_monitor := monitor_user(p_user_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
  INTO v_findings
  FROM (
    SELECT spa.*
    FROM scan_payout_accuracy_anomalies(
      timestamptz '2026-08-01 00:00:00+00',
      500
    ) spa
    WHERE spa.user_id = p_user_id
    UNION ALL
    SELECT d.*
    FROM list_failed_unrefunded_payout_debits(
      timestamptz '2026-08-01 00:00:00+00',
      50
    ) d
    WHERE d.user_id = p_user_id
  ) f;

  SELECT COALESCE(jsonb_agg(to_jsonb(pc) ORDER BY pc.checked_at DESC), '[]'::jsonb)
  INTO v_provider
  FROM (
    SELECT *
    FROM payout_provider_checks
    WHERE user_id = p_user_id
    ORDER BY checked_at DESC
    LIMIT 50
  ) pc;

  SELECT COALESCE(jsonb_agg(to_jsonb(paf) ORDER BY paf.last_seen_at DESC), '[]'::jsonb)
  INTO v_open
  FROM payout_accuracy_findings paf
  WHERE paf.user_id = p_user_id
    AND paf.resolved_at IS NULL;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'user_id', p_user_id,
    'monitor', v_monitor,
    'accuracy_findings', v_findings,
    'open_accuracy_findings', v_open,
    'provider_checks', v_provider,
    'reconciliation_verdict', v_monitor->'reconciliation'->>'verdict'
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_payout_reconciliation_report(uuid) IS
  'Full payout/wallet reconciliation report for one user. Service-role only.';

REVOKE ALL ON FUNCTION public.get_user_payout_reconciliation_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_payout_reconciliation_report(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) pg_cron hourly — SafeHaven provider reconciliation
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-payout-provider-1h') THEN
    PERFORM cron.unschedule('reconcile-payout-provider-1h');
  END IF;

  PERFORM cron.schedule(
    'reconcile-payout-provider-1h',
    '15 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_internal_supabase_url() || '/functions/v1/reconcile-payout-provider',
      headers := public.get_internal_supabase_auth_headers(),
      body := '{}'::jsonb
    );
    $cron$
  );
END;
$$;
