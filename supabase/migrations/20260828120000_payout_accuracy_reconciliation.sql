/*
  Payout accuracy reconciliation (cron via reconcile-payout-plans)

  - scan_payout_accuracy_anomalies: read-only scan (wallet, plan totals, double-pay signals)
  - payout_accuracy_findings: persisted findings for dedup + ops history
  - upsert_payout_accuracy_findings: called by edge function after each scan
*/

-- ---------------------------------------------------------------------------
-- 1) Findings table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_accuracy_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_key text NOT NULL UNIQUE,
  signal text NOT NULL,
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.payout_plans (id) ON DELETE SET NULL,
  ap_id uuid REFERENCES public.automated_payouts (id) ON DELETE SET NULL,
  email text,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_accuracy_findings_open
  ON public.payout_accuracy_findings (last_seen_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_accuracy_findings_user
  ON public.payout_accuracy_findings (user_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_accuracy_findings_signal
  ON public.payout_accuracy_findings (signal)
  WHERE resolved_at IS NULL;

ALTER TABLE public.payout_accuracy_findings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_accuracy_findings'
      AND policyname = 'Service role can manage payout accuracy findings'
  ) THEN
    CREATE POLICY "Service role can manage payout accuracy findings"
      ON public.payout_accuracy_findings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Scan anomalies (returns one row per finding)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_payout_accuracy_anomalies(
  p_since timestamptz DEFAULT timestamptz '2026-08-01 00:00:00+00',
  p_limit integer DEFAULT 100
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
  WITH params AS (
    SELECT GREATEST(COALESCE(p_limit, 100), 1) AS lim
  ),
  wallet_balance AS (
    SELECT
      ('wallet_balance_mismatch:' || w.user_id::text) AS finding_key,
      'wallet_balance_mismatch'::text AS signal,
      'critical'::text AS severity,
      w.user_id,
      NULL::uuid AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'Wallet balance mismatch: balance=%s, locked+available=%s, delta=%s',
        w.balance,
        COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0),
        w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))
      ) AS summary,
      jsonb_build_object(
        'balance', w.balance,
        'locked_balance', w.locked_balance,
        'available_balance', w.available_balance,
        'delta', w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))
      ) AS details,
      ABS(w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))) AS sort_key
    FROM wallets w
    LEFT JOIN profiles p ON p.id = w.user_id
    WHERE ABS(
      w.balance - (COALESCE(w.locked_balance, 0) + COALESCE(w.available_balance, 0))
    ) >= 0.01
  ),
  wallet_locked AS (
    SELECT
      ('wallet_locked_mismatch:' || w.user_id::text) AS finding_key,
      'wallet_locked_mismatch'::text AS signal,
      'warning'::text AS severity,
      w.user_id,
      NULL::uuid AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'Locked balance mismatch: wallet=%s, plans require=%s, delta=%s',
        w.locked_balance,
        calc.calc_locked,
        w.locked_balance - calc.calc_locked
      ) AS summary,
      jsonb_build_object(
        'locked_balance', w.locked_balance,
        'calculated_locked', calc.calc_locked,
        'delta', w.locked_balance - calc.calc_locked
      ) AS details,
      ABS(w.locked_balance - calc.calc_locked) AS sort_key
    FROM wallets w
    JOIN LATERAL (
      SELECT COALESCE(SUM(
        GREATEST(0, pp.total_amount - pp.completed_payouts * pp.payout_amount)
      ), 0) AS calc_locked
      FROM payout_plans pp
      WHERE pp.user_id = w.user_id
        AND pp.status IN ('active', 'paused')
    ) calc ON true
    LEFT JOIN profiles p ON p.id = w.user_id
    WHERE ABS(w.locked_balance - calc.calc_locked) >= 0.01
  ),
  plan_overpaid AS (
    SELECT
      ('plan_overpaid:' || pp.id::text) AS finding_key,
      'plan_overpaid'::text AS signal,
      'critical'::text AS severity,
      pp.user_id,
      pp.id AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'Plan overpaid: completed AP sum=%s exceeds plan total=%s',
        agg.completed_amount,
        pp.total_amount
      ) AS summary,
      jsonb_build_object(
        'plan_name', pp.name,
        'plan_status', pp.status,
        'plan_total', pp.total_amount,
        'completed_ap_count', agg.completed_count,
        'completed_ap_amount', agg.completed_amount,
        'duration', pp.duration,
        'completed_payouts', pp.completed_payouts
      ) AS details,
      agg.completed_amount AS sort_key
    FROM payout_plans pp
    JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE ap.status = 'completed') AS completed_count,
        COALESCE(sum(ap.amount) FILTER (WHERE ap.status = 'completed'), 0) AS completed_amount
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.created_at >= p_since
    ) agg ON true
    LEFT JOIN profiles p ON p.id = pp.user_id
    WHERE pp.created_at >= p_since - interval '30 days'
      AND agg.completed_amount > (pp.total_amount * 1.05)
  ),
  plan_more_aps AS (
    SELECT
      ('plan_more_aps_than_duration:' || pp.id::text) AS finding_key,
      'plan_more_aps_than_duration'::text AS signal,
      'critical'::text AS severity,
      pp.user_id,
      pp.id AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'More completed APs (%s) than plan duration (%s)',
        agg.completed_count,
        pp.duration
      ) AS summary,
      jsonb_build_object(
        'plan_name', pp.name,
        'completed_ap_count', agg.completed_count,
        'duration', pp.duration,
        'completed_payouts', pp.completed_payouts
      ) AS details,
      agg.completed_count::numeric AS sort_key
    FROM payout_plans pp
    JOIN LATERAL (
      SELECT count(*) FILTER (WHERE ap.status = 'completed') AS completed_count
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.created_at >= p_since
    ) agg ON true
    LEFT JOIN profiles p ON p.id = pp.user_id
    WHERE pp.created_at >= p_since - interval '30 days'
      AND agg.completed_count > pp.duration
  ),
  duplicate_installment AS (
    SELECT
      (
        'duplicate_ap_installment:'
        || ap.payout_plan_id::text
        || ':'
        || ap.installment_index::text
      ) AS finding_key,
      'duplicate_ap_installment'::text AS signal,
      'critical'::text AS severity,
      pp.user_id,
      ap.payout_plan_id AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'Installment %s has %s AP row(s), %s completed',
        ap.installment_index,
        count(*),
        count(*) FILTER (WHERE ap.status = 'completed')
      ) AS summary,
      jsonb_build_object(
        'plan_name', pp.name,
        'installment_index', ap.installment_index,
        'ap_rows', count(*),
        'completed_rows', count(*) FILTER (WHERE ap.status = 'completed'),
        'ap_ids', array_agg(ap.id ORDER BY ap.created_at),
        'statuses', array_agg(ap.status ORDER BY ap.created_at),
        'transfer_refs', array_agg(ap.transfer_reference ORDER BY ap.created_at)
      ) AS details,
      count(*) FILTER (WHERE ap.status = 'completed')::numeric AS sort_key
    FROM automated_payouts ap
    JOIN payout_plans pp ON pp.id = ap.payout_plan_id
    LEFT JOIN profiles p ON p.id = pp.user_id
    WHERE ap.created_at >= p_since
      AND ap.installment_index IS NOT NULL
    GROUP BY ap.payout_plan_id, ap.installment_index, pp.user_id, pp.name, p.email
    HAVING count(*) > 1
        OR count(*) FILTER (WHERE ap.status = 'completed') > 1
  ),
  duplicate_ref AS (
    SELECT
      ('duplicate_transfer_ref:' || BTRIM(ap.transfer_reference)) AS finding_key,
      'duplicate_transfer_ref'::text AS signal,
      'critical'::text AS severity,
      (array_agg(DISTINCT ap.user_id))[1] AS user_id,
      NULL::uuid AS plan_id,
      NULL::uuid AS ap_id,
      (array_agg(DISTINCT p.email))[1] AS email,
      format('Transfer ref %s on %s AP row(s)', BTRIM(ap.transfer_reference), count(*)) AS summary,
      jsonb_build_object(
        'transfer_reference', BTRIM(ap.transfer_reference),
        'ap_rows', count(*),
        'user_ids', array_agg(DISTINCT ap.user_id),
        'ap_ids', array_agg(ap.id ORDER BY ap.created_at),
        'amounts', array_agg(ap.amount ORDER BY ap.created_at)
      ) AS details,
      count(*)::numeric AS sort_key
    FROM automated_payouts ap
    LEFT JOIN profiles p ON p.id = ap.user_id
    WHERE ap.created_at >= p_since
      AND NULLIF(BTRIM(ap.transfer_reference), '') IS NOT NULL
      AND ap.transfer_reference NOT LIKE 'auto_payout_%'
    GROUP BY BTRIM(ap.transfer_reference)
    HAVING count(*) > 1
  ),
  multiple_txs AS (
    SELECT
      ('multiple_txs_same_ap:' || (t.metadata->>'automated_payout_id')) AS finding_key,
      'multiple_txs_same_ap'::text AS signal,
      'critical'::text AS severity,
      t.user_id,
      NULL::uuid AS plan_id,
      (t.metadata->>'automated_payout_id')::uuid AS ap_id,
      p.email,
      format(
        '%s completed payout tx(s) for AP %s',
        count(*) FILTER (WHERE t.status = 'completed'),
        t.metadata->>'automated_payout_id'
      ) AS summary,
      jsonb_build_object(
        'automated_payout_id', t.metadata->>'automated_payout_id',
        'tx_count', count(*),
        'completed_tx', count(*) FILTER (WHERE t.status = 'completed'),
        'completed_amount', COALESCE(sum(t.amount) FILTER (WHERE t.status = 'completed'), 0),
        'tx_ids', array_agg(t.id ORDER BY t.created_at)
      ) AS details,
      COALESCE(sum(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS sort_key
    FROM transactions t
    LEFT JOIN profiles p ON p.id = t.user_id
    WHERE t.type = 'payout'
      AND t.created_at >= p_since
      AND t.metadata->>'automated_payout_id' IS NOT NULL
    GROUP BY t.metadata->>'automated_payout_id', t.user_id, p.email
    HAVING count(*) FILTER (WHERE t.status = 'completed') > 1
  ),
  progress_mismatch AS (
    SELECT
      ('plan_progress_mismatch:' || pp.id::text) AS finding_key,
      'plan_progress_mismatch'::text AS signal,
      'warning'::text AS severity,
      pp.user_id,
      pp.id AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      format(
        'Plan counter=%s but completed AP count=%s',
        pp.completed_payouts,
        agg.completed_count
      ) AS summary,
      jsonb_build_object(
        'plan_name', pp.name,
        'plan_status', pp.status,
        'completed_payouts', pp.completed_payouts,
        'completed_ap_count', agg.completed_count,
        'next_payout_date', pp.next_payout_date
      ) AS details,
      ABS(pp.completed_payouts - agg.completed_count)::numeric AS sort_key
    FROM payout_plans pp
    JOIN LATERAL (
      SELECT count(*) FILTER (WHERE ap.status = 'completed') AS completed_count
      FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
    ) agg ON true
    LEFT JOIN profiles p ON p.id = pp.user_id
    WHERE pp.status IN ('active', 'paused', 'completed')
      AND pp.completed_payouts IS DISTINCT FROM agg.completed_count
  ),
  status_inconsistent AS (
    SELECT
      ('plan_status_inconsistent:' || pp.id::text) AS finding_key,
      'plan_status_inconsistent'::text AS signal,
      'warning'::text AS severity,
      pp.user_id,
      pp.id AS plan_id,
      NULL::uuid AS ap_id,
      p.email,
      CASE
        WHEN pp.status = 'completed' AND pp.completed_payouts < pp.duration THEN
          format('Plan marked completed but only %s/%s installments', pp.completed_payouts, pp.duration)
        WHEN pp.status = 'active' AND pp.completed_payouts >= pp.duration THEN
          format('Plan still active but completed_payouts (%s) >= duration (%s)', pp.completed_payouts, pp.duration)
        ELSE
          'Plan status vs progress inconsistent'
      END AS summary,
      jsonb_build_object(
        'plan_name', pp.name,
        'plan_status', pp.status,
        'completed_payouts', pp.completed_payouts,
        'duration', pp.duration,
        'next_payout_date', pp.next_payout_date
      ) AS details,
      1::numeric AS sort_key
    FROM payout_plans pp
    LEFT JOIN profiles p ON p.id = pp.user_id
    WHERE (
      (pp.status = 'completed' AND pp.completed_payouts < pp.duration)
      OR (pp.status = 'active' AND pp.completed_payouts >= pp.duration)
    )
  ),
  verify_safehaven AS (
    SELECT
      ('verify_safehaven_refs:' || ap.id::text) AS finding_key,
      'verify_safehaven_refs'::text AS signal,
      'warning'::text AS severity,
      ap.user_id,
      ap.payout_plan_id AS plan_id,
      ap.id AS ap_id,
      p.email,
      format(
        'AP %s completed with %s prior provider ref(s) — verify on SafeHaven',
        ap.id,
        jsonb_array_length(ap.metadata->'previous_transfer_references')
      ) AS summary,
      jsonb_build_object(
        'installment_index', ap.installment_index,
        'amount', ap.amount,
        'current_ref', ap.transfer_reference,
        'previous_refs', ap.metadata->'previous_transfer_references',
        'safehaven_transfer_id', ap.metadata->>'safehaven_transfer_id'
      ) AS details,
      COALESCE(EXTRACT(EPOCH FROM ap.completed_at), 0) AS sort_key
    FROM automated_payouts ap
    LEFT JOIN profiles p ON p.id = ap.user_id
    WHERE ap.created_at >= p_since
      AND ap.status = 'completed'
      AND jsonb_typeof(ap.metadata->'previous_transfer_references') = 'array'
      AND jsonb_array_length(ap.metadata->'previous_transfer_references') > 0
  ),
  all_findings AS (
    SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END AS sev_rank,
           sort_key
    FROM wallet_balance
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM wallet_locked
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM plan_overpaid
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM plan_more_aps
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM duplicate_installment
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM duplicate_ref
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM multiple_txs
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM progress_mismatch
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM status_inconsistent
    UNION ALL SELECT finding_key, signal, severity, user_id, plan_id, ap_id, email, summary, details,
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, sort_key FROM verify_safehaven
  )
  SELECT
    af.finding_key,
    af.signal,
    af.severity,
    af.user_id,
    af.plan_id,
    af.ap_id,
    af.email,
    af.summary,
    af.details
  FROM all_findings af
  CROSS JOIN params
  ORDER BY af.sev_rank, af.sort_key DESC
  LIMIT (SELECT lim FROM params);
$$;

COMMENT ON FUNCTION public.scan_payout_accuracy_anomalies(timestamptz, integer) IS
  'Scans wallet/plan/payout accuracy anomalies for cron reconciliation. Read-only; does not move money.';

REVOKE ALL ON FUNCTION public.scan_payout_accuracy_anomalies(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_payout_accuracy_anomalies(timestamptz, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Upsert findings + auto-resolve stale keys
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_payout_accuracy_findings(
  p_findings jsonb,
  p_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_keys text[] := ARRAY[]::text[];
  v_upserted integer := 0;
BEGIN
  IF p_findings IS NULL OR jsonb_typeof(p_findings) <> 'array' THEN
    RETURN jsonb_build_object('upserted', 0, 'finding_keys', '[]'::jsonb);
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_findings)
  LOOP
    v_keys := array_append(v_keys, v_row->>'finding_key');

    INSERT INTO public.payout_accuracy_findings (
      finding_key,
      signal,
      severity,
      user_id,
      plan_id,
      ap_id,
      email,
      summary,
      details,
      last_run_id,
      last_seen_at
    )
    VALUES (
      v_row->>'finding_key',
      v_row->>'signal',
      COALESCE(v_row->>'severity', 'warning'),
      NULLIF(v_row->>'user_id', '')::uuid,
      NULLIF(v_row->>'plan_id', '')::uuid,
      NULLIF(v_row->>'ap_id', '')::uuid,
      NULLIF(v_row->>'email', ''),
      COALESCE(v_row->>'summary', v_row->>'signal'),
      COALESCE(v_row->'details', '{}'::jsonb),
      p_run_id,
      now()
    )
    ON CONFLICT (finding_key) DO UPDATE SET
      signal = EXCLUDED.signal,
      severity = EXCLUDED.severity,
      user_id = EXCLUDED.user_id,
      plan_id = EXCLUDED.plan_id,
      ap_id = EXCLUDED.ap_id,
      email = EXCLUDED.email,
      summary = EXCLUDED.summary,
      details = EXCLUDED.details,
      last_run_id = EXCLUDED.last_run_id,
      last_seen_at = now(),
      resolved_at = NULL;

    v_upserted := v_upserted + 1;
  END LOOP;

  IF array_length(v_keys, 1) IS NOT NULL THEN
    UPDATE public.payout_accuracy_findings
    SET resolved_at = now()
    WHERE resolved_at IS NULL
      AND NOT (finding_key = ANY (v_keys));
  END IF;

  RETURN jsonb_build_object(
    'upserted', v_upserted,
    'finding_keys', to_jsonb(v_keys)
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_payout_accuracy_findings(jsonb, uuid) IS
  'Persists scan results; resolves findings that disappeared from the latest scan.';

REVOKE ALL ON FUNCTION public.upsert_payout_accuracy_findings(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_payout_accuracy_findings(jsonb, uuid) TO service_role;
