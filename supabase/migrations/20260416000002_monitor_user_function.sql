/*
  monitor_user(p_user_id uuid) → jsonb
  =====================================

  Deep-dive audit function for support / ops / monitoring.
  Call from psql or Supabase SQL editor:

      SELECT monitor_user('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');

  Or pretty-print:

      SELECT jsonb_pretty(monitor_user('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'));

  Returns a single JSONB object with sections:

   1. identity             — profile info
   2. wallet               — live balance snapshot
   3. wallet_ledger        — last 20 balance-change entries
   4. deposits             — total count + amount, grouped by source
   5. payout_plans         — per-plan detail with per-plan tally checks
   6. payout_summary       — rolled-up totals across all plans
   7. automated_payouts    — all payout execution records
   8. emergency_withdrawals — all emergency withdrawal records
   9. vault_plans          — budget_plans + plan_wallet balance
  10. vault_schedules      — vault_payout_schedules per vault plan
  11. transaction_ledger   — grouped by type + last 30 raw rows
  12. reconciliation       — tally flags and discrepancy alerts

  Security: SECURITY DEFINER, callable only by service_role (see GRANT below).
*/

CREATE OR REPLACE FUNCTION public.monitor_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- section results
  v_identity               jsonb;
  v_wallet                 jsonb;
  v_wallet_ledger          jsonb;
  v_deposits               jsonb;
  v_payout_plans           jsonb;
  v_payout_summary         jsonb;
  v_automated_payouts      jsonb;
  v_emergency_withdrawals  jsonb;
  v_vault_plans            jsonb;
  v_vault_schedules        jsonb;
  v_tx_ledger              jsonb;
  v_reconciliation         jsonb;

  -- wallet snapshot scalars
  v_balance                numeric := 0;
  v_locked                 numeric := 0;
  v_available              numeric := 0;

  -- reconciliation scalars
  v_calc_locked            numeric := 0;   -- re-derived from active/paused plans
  v_locked_delta           numeric := 0;
  v_deposit_total          numeric := 0;
  v_payout_tx_total        numeric := 0;   -- transactions type='payout' completed
  v_plan_disbursed_total   numeric := 0;   -- sum(completed_payouts * payout_amount)
  v_autopayout_total       numeric := 0;   -- automated_payouts completed sum

  -- overview (built last, placed first in output)
  v_overview               jsonb;
BEGIN

  -- ── 0. Existence check ─────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'User not found', 'user_id', p_user_id);
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1. IDENTITY
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    'user_id',    p.id,
    'first_name', p.first_name,
    'last_name',  p.last_name,
    'full_name',  concat_ws(' ', p.first_name, p.last_name),
    'email',      p.email,
    'created_at', p.created_at
  )
  INTO v_identity
  FROM profiles p
  WHERE p.id = p_user_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2. WALLET (live snapshot)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT
    COALESCE(balance, 0),
    COALESCE(locked_balance, 0),
    COALESCE(available_balance, 0)
  INTO v_balance, v_locked, v_available
  FROM wallets
  WHERE user_id = p_user_id;

  v_wallet := jsonb_build_object(
    'balance',            v_balance,
    'locked_balance',     v_locked,
    'available_balance',  v_available,
    -- Sanity: balance should equal locked + available (within 1 kobo)
    'balance_check_ok',   ABS(v_balance - (v_locked + v_available)) < 0.01
  );

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3. WALLET LEDGER  (last 20 entries, newest first)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(row_data ORDER BY recorded_at DESC), '[]'::jsonb)
  INTO v_wallet_ledger
  FROM (
    SELECT
      recorded_at,
      jsonb_build_object(
        'id',               id,
        'operation',        operation,
        'source_kind',      source_kind,
        'source_ref',       source_ref,
        'balance_delta',    balance_delta,
        'locked_delta',     locked_balance_delta,
        'available_delta',  available_balance_delta,
        'balance_before',   balance_before,
        'balance_after',    balance_after,
        'locked_before',    locked_balance_before,
        'locked_after',     locked_balance_after,
        'available_before', available_balance_before,
        'available_after',  available_balance_after,
        'recorded_at',      recorded_at
      ) AS row_data
    FROM wallet_ledger
    WHERE user_id = p_user_id
    ORDER BY recorded_at DESC
    LIMIT 20
  ) sub;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 4. DEPOSITS
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(SUM(amount), 0)
  INTO v_deposit_total
  FROM transactions
  WHERE user_id = p_user_id
    AND type = 'deposit'
    AND status IN ('completed', 'success', 'Completed');

  SELECT jsonb_build_object(
    'count',        COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0),
    'by_source', (
      SELECT COALESCE(
        jsonb_object_agg(COALESCE(source, 'unknown'), src_total),
        '{}'::jsonb
      )
      FROM (
        SELECT source, SUM(amount) AS src_total
        FROM transactions
        WHERE user_id = p_user_id
          AND type = 'deposit'
          AND status IN ('completed', 'success', 'Completed')
        GROUP BY source
      ) by_src
    )
  )
  INTO v_deposits
  FROM transactions
  WHERE user_id = p_user_id
    AND type = 'deposit'
    AND status IN ('completed', 'success', 'Completed');

  -- ══════════════════════════════════════════════════════════════════════════
  -- 5. PAYOUT PLANS  (per-plan detail + per-plan tally)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(plan_row ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_payout_plans
  FROM (
    SELECT
      pp.created_at,
      jsonb_build_object(
        'plan_id',              pp.id,
        'name',                 pp.name,
        'status',               pp.status,
        'frequency',            pp.frequency,
        'duration',             pp.duration,
        'completed_payouts',    pp.completed_payouts,
        'progress_pct',         ROUND(100.0 * pp.completed_payouts / NULLIF(pp.duration, 0), 1),
        'start_date',           pp.start_date,
        'next_payout_date',     pp.next_payout_date,
        'total_amount',         pp.total_amount,
        'payout_amount',        pp.payout_amount,
        'fee_percentage',       COALESCE(pp.fee_percentage, 0),
        'fee_amount',           COALESCE(pp.fee_amount, 0),
        'net_payout_amount',    COALESCE(pp.net_payout_amount, pp.total_amount),
        'remaining_locked',     GREATEST(0, pp.total_amount - (pp.completed_payouts * pp.payout_amount)),
        -- What the plan counter claims was disbursed
        'plan_says_disbursed',  pp.completed_payouts * pp.payout_amount,
        'created_at',           pp.created_at,

        -- automated_payouts records for this plan
        'autopayouts_completed_count',  COALESCE(ap.cnt,   0),
        'autopayouts_completed_amount', COALESCE(ap.total, 0),

        -- transactions records for this plan (type = 'payout')
        'tx_payout_count',   COALESCE(tx.cnt,   0),
        'tx_payout_amount',  COALESCE(tx.total, 0),

        -- emergency withdrawals against this plan
        'emergency_withdrawals', COALESCE(ew.rows, '[]'::jsonb),
        'emergency_total',       COALESCE(ew.total, 0),

        -- tally flags (discrepancy = difference > 1 kobo)
        'tally_plan_vs_autopayouts_ok',
          ABS((pp.completed_payouts * pp.payout_amount) - COALESCE(ap.total, 0)) < 0.01,
        'tally_plan_vs_transactions_ok',
          ABS((pp.completed_payouts * pp.payout_amount) - COALESCE(tx.total, 0)) < 0.01,
        'tally_autopayouts_vs_transactions_ok',
          ABS(COALESCE(ap.total, 0) - COALESCE(tx.total, 0)) < 0.01
      ) AS plan_row

    FROM payout_plans pp

    -- automated_payouts completed amounts per plan
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total
      FROM automated_payouts
      WHERE payout_plan_id = pp.id
        AND status = 'completed'
    ) ap ON true

    -- transactions payout amounts per plan
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE payout_plan_id = pp.id
        AND type = 'payout'
        AND status IN ('completed', 'success', 'Completed')
    ) tx ON true

    -- emergency withdrawals per plan
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(COALESCE(ew2.withdrawal_amount, ew2.net_amount, 0)), 0) AS total,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'id',              ew2.id,
            'withdrawal_type', ew2.withdrawal_type,
            'status',          ew2.status,
            'withdrawal_amount', COALESCE(ew2.withdrawal_amount, 0),
            'fee_amount',      COALESCE(ew2.fee_amount, 0),
            'net_amount',      COALESCE(ew2.net_amount, 0),
            'transferred_at',  ew2.transferred_at,
            'created_at',      ew2.created_at
          ) ORDER BY ew2.created_at DESC
        ), '[]'::jsonb) AS rows
      FROM emergency_withdrawals ew2
      WHERE ew2.payout_plan_id = pp.id
    ) ew ON true

    WHERE pp.user_id = p_user_id
  ) plan_data;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 6. PAYOUT SUMMARY (rolled-up totals)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    'total_plans',              COUNT(*),
    'by_status', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (
        SELECT status, COUNT(*) AS cnt
        FROM payout_plans
        WHERE user_id = p_user_id
        GROUP BY status
      ) s
    ),
    'total_gross_committed',    COALESCE(SUM(total_amount), 0),
    'total_net_committed',      COALESCE(SUM(COALESCE(net_payout_amount, total_amount)), 0),
    'total_fees_paid',          COALESCE(SUM(COALESCE(fee_amount, 0)), 0),
    'total_disbursed_by_plans', COALESCE(SUM(completed_payouts * payout_amount), 0),
    'total_still_locked',       COALESCE(
      SUM(GREATEST(0, total_amount - completed_payouts * payout_amount))
        FILTER (WHERE status IN ('active', 'paused')),
      0
    )
  )
  INTO v_payout_summary
  FROM payout_plans
  WHERE user_id = p_user_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 7. AUTOMATED PAYOUTS (all executions, newest first)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                 ap.id,
      'payout_plan_id',     ap.payout_plan_id,
      'scheduled_date',     ap.scheduled_date,
      'execution_date',     ap.execution_date,
      'status',             ap.status,
      'amount',             ap.amount,
      'transfer_reference', ap.transfer_reference,
      'error_message',      ap.error_message,
      'retry_count',        ap.retry_count,
      'completed_at',       ap.completed_at,
      'created_at',         ap.created_at
    ) ORDER BY ap.created_at DESC
  ), '[]'::jsonb)
  INTO v_automated_payouts
  FROM automated_payouts ap
  WHERE ap.user_id = p_user_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_autopayout_total
  FROM automated_payouts
  WHERE user_id = p_user_id AND status = 'completed';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 8. EMERGENCY WITHDRAWALS
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                        ew.id,
      'payout_plan_id',            ew.payout_plan_id,
      'withdrawal_type',           ew.withdrawal_type,
      'status',                    ew.status,
      'withdrawal_amount',         COALESCE(ew.withdrawal_amount, 0),
      'fee_amount',                COALESCE(ew.fee_amount, 0),
      'net_amount',                COALESCE(ew.net_amount, 0),
      'transfer_code',             ew.transfer_code,
      'transferred_at',            ew.transferred_at,
      'scheduled_processing_time', ew.scheduled_processing_time,
      'error_message',             ew.error_message,
      'created_at',                ew.created_at
    ) ORDER BY ew.created_at DESC
  ), '[]'::jsonb)
  INTO v_emergency_withdrawals
  FROM emergency_withdrawals ew
  WHERE ew.user_id = p_user_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 9. VAULT PLANS  (budget_plans + plan_wallet balance)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'plan_id',          bp.id,
      'name',             bp.name,
      'status',           bp.status,
      'total_budget',     bp.total_budget,
      'current_balance',  bp.current_balance,
      'total_spent',      bp.total_spent,
      'remaining_budget', bp.remaining_budget,
      'wallet_balance',   COALESCE(pw.balance, 0),
      'created_at',       bp.created_at
    ) ORDER BY bp.created_at DESC
  ), '[]'::jsonb)
  INTO v_vault_plans
  FROM budget_plans bp
  LEFT JOIN plan_wallets pw ON pw.plan_id = bp.id
  WHERE bp.user_id = p_user_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 10. VAULT PAYOUT SCHEDULES
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'schedule_id',       vps.id,
      'budget_plan_id',    vps.budget_plan_id,
      'status',            vps.status,
      'frequency',         vps.frequency,
      'duration',          vps.duration,
      'completed_payouts', vps.completed_payouts,
      'progress_pct',      ROUND(100.0 * vps.completed_payouts / NULLIF(vps.duration, 0), 1),
      'total_amount',      vps.total_amount,
      'payout_amount',     vps.payout_amount,
      'net_payout_amount', vps.net_payout_amount,
      'fee_amount',        vps.fee_amount,
      'next_payout_date',  vps.next_payout_date,
      'start_date',        vps.start_date,
      'created_at',        vps.created_at
    ) ORDER BY vps.created_at DESC
  ), '[]'::jsonb)
  INTO v_vault_schedules
  FROM vault_payout_schedules vps
  WHERE vps.user_id = p_user_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 11. TRANSACTION LEDGER  (summary by type + last 30 raw rows)
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(SUM(amount), 0)
  INTO v_payout_tx_total
  FROM transactions
  WHERE user_id = p_user_id
    AND type = 'payout'
    AND status IN ('completed', 'success', 'Completed');

  SELECT jsonb_build_object(
    'by_type', (
      SELECT COALESCE(jsonb_object_agg(type, type_stats), '{}'::jsonb)
      FROM (
        SELECT
          type,
          jsonb_build_object(
            'count',        COUNT(*),
            'total_amount', COALESCE(SUM(amount), 0),
            'completed',    COUNT(*) FILTER (WHERE status IN ('completed', 'success', 'Completed')),
            'pending',      COUNT(*) FILTER (WHERE status = 'pending'),
            'failed',       COUNT(*) FILTER (WHERE status = 'failed')
          ) AS type_stats
        FROM transactions
        WHERE user_id = p_user_id
        GROUP BY type
      ) grp
    ),
    'recent_30', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',             t.id,
          'type',           t.type,
          'amount',         t.amount,
          'status',         t.status,
          'source',         t.source,
          'destination',    t.destination,
          'reference',      t.reference,
          'description',    t.description,
          'payout_plan_id', t.payout_plan_id,
          'created_at',     t.created_at
        ) ORDER BY t.created_at DESC
      ), '[]'::jsonb)
      FROM (
        SELECT * FROM transactions
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 30
      ) t
    )
  )
  INTO v_tx_ledger;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 12. RECONCILIATION  — tally checks & discrepancy flags
  -- ══════════════════════════════════════════════════════════════════════════

  -- What locked_balance should be, re-derived from active/paused plans
  SELECT COALESCE(SUM(
    GREATEST(0, total_amount - completed_payouts * payout_amount)
  ), 0)
  INTO v_calc_locked
  FROM payout_plans
  WHERE user_id = p_user_id
    AND status IN ('active', 'paused');

  v_locked_delta := v_locked - v_calc_locked;

  -- Sum of what all plans claim has been paid out
  SELECT COALESCE(SUM(completed_payouts * payout_amount), 0)
  INTO v_plan_disbursed_total
  FROM payout_plans
  WHERE user_id = p_user_id;

  v_reconciliation := jsonb_build_object(
    'generated_at', now(),

    -- ① Wallet internal consistency: balance = locked + available?
    'wallet_balance_consistent',
      ABS(v_balance - (v_locked + v_available)) < 0.01,

    -- ② locked_balance matches what active/paused plans say?
    'locked_matches_active_plans',  ABS(v_locked_delta) < 0.01,
    'locked_balance_actual',        v_locked,
    'locked_balance_calculated',    v_calc_locked,
    'locked_delta',                 v_locked_delta,
    'locked_delta_note', CASE
      WHEN v_locked_delta > 0.01 THEN 'Wallet locked_balance is HIGHER than plans require — possible orphaned lock'
      WHEN v_locked_delta < -0.01 THEN 'Wallet locked_balance is LOWER than plans require — possible under-lock'
      ELSE 'OK'
    END,

    -- ③ Three-way payout tally
    'plan_says_disbursed',          v_plan_disbursed_total,
    'autopayouts_completed_total',  v_autopayout_total,
    'payout_transactions_total',    v_payout_tx_total,

    'plan_vs_autopayouts_match',
      ABS(v_plan_disbursed_total - v_autopayout_total) < 0.01,
    'plan_vs_payout_transactions_match',
      ABS(v_plan_disbursed_total - v_payout_tx_total) < 0.01,
    'autopayouts_vs_payout_transactions_match',
      ABS(v_autopayout_total - v_payout_tx_total) < 0.01,

    -- ④ Overall health
    'all_clear', (
      ABS(v_balance - (v_locked + v_available)) < 0.01
      AND ABS(v_locked_delta) < 0.01
      AND ABS(v_plan_disbursed_total - v_autopayout_total) < 0.01
      AND ABS(v_plan_disbursed_total - v_payout_tx_total) < 0.01
    ),
    'verdict', CASE
      WHEN (
        ABS(v_balance - (v_locked + v_available)) < 0.01
        AND ABS(v_locked_delta) < 0.01
        AND ABS(v_plan_disbursed_total - v_autopayout_total) < 0.01
        AND ABS(v_plan_disbursed_total - v_payout_tx_total) < 0.01
      ) THEN 'ALL_CLEAR — wallet, locked balance, and payout tallies are consistent'
      ELSE 'DISCREPANCY_FOUND — one or more tally checks failed, review flags above'
    END
  );

  -- ══════════════════════════════════════════════════════════════════════════
  -- 13. OVERVIEW  — single-glance dashboard (built from already-computed vars)
  -- ══════════════════════════════════════════════════════════════════════════
  v_overview := jsonb_build_object(

    -- ── Wallet ───────────────────────────────────────────────────────────────
    'wallet', jsonb_build_object(
      'balance',           v_balance,
      'locked_balance',    v_locked,
      'available_balance', v_available,
      'health',            CASE WHEN (v_wallet->>'balance_check_ok')::boolean
                             THEN 'OK' ELSE 'INCONSISTENT' END
    ),

    -- ── Deposits ─────────────────────────────────────────────────────────────
    'deposits', jsonb_build_object(
      'count',        v_deposits->'count',
      'total_amount', v_deposit_total
    ),

    -- ── Payout plans ─────────────────────────────────────────────────────────
    'payout_plans', jsonb_build_object(
      'total',             v_payout_summary->'total_plans',
      'by_status',         v_payout_summary->'by_status',
      'total_fees_paid',   v_payout_summary->'total_fees_paid',
      'total_disbursed',   v_plan_disbursed_total,
      'still_locked',      v_payout_summary->'total_still_locked'
    ),

    -- ── Automated payouts ────────────────────────────────────────────────────
    'automated_payouts', jsonb_build_object(
      'total_records', (
        SELECT COUNT(*) FROM automated_payouts WHERE user_id = p_user_id
      ),
      'completed_count', (
        SELECT COUNT(*) FROM automated_payouts
        WHERE user_id = p_user_id AND status = 'completed'
      ),
      'failed_count', (
        SELECT COUNT(*) FROM automated_payouts
        WHERE user_id = p_user_id AND status = 'failed'
      ),
      'completed_amount', v_autopayout_total
    ),

    -- ── Emergency withdrawals ────────────────────────────────────────────────
    'emergency_withdrawals', jsonb_build_object(
      'total_count', (
        SELECT COUNT(*) FROM emergency_withdrawals WHERE user_id = p_user_id
      ),
      'completed_count', (
        SELECT COUNT(*) FROM emergency_withdrawals
        WHERE user_id = p_user_id AND status = 'completed'
      ),
      'by_type', (
        SELECT COALESCE(jsonb_object_agg(
          withdrawal_type,
          jsonb_build_object(
            'count',            cnt,
            'total_withdrawn',  total_w,
            'total_fee',        total_f,
            'total_net',        total_n
          )
        ), '{}'::jsonb)
        FROM (
          SELECT
            withdrawal_type,
            COUNT(*)                                              AS cnt,
            COALESCE(SUM(COALESCE(withdrawal_amount, 0)), 0)     AS total_w,
            COALESCE(SUM(COALESCE(fee_amount, 0)), 0)            AS total_f,
            COALESCE(SUM(COALESCE(net_amount, 0)), 0)            AS total_n
          FROM emergency_withdrawals
          WHERE user_id = p_user_id
          GROUP BY withdrawal_type
        ) ew_grp
      )
    ),

    -- ── Vault ────────────────────────────────────────────────────────────────
    'vault', jsonb_build_object(
      'total_plans', (
        SELECT COUNT(*) FROM budget_plans WHERE user_id = p_user_id
      ),
      'active_plans', (
        SELECT COUNT(*) FROM budget_plans
        WHERE user_id = p_user_id AND status = 'active'
      ),
      'total_budget', (
        SELECT COALESCE(SUM(total_budget), 0) FROM budget_plans
        WHERE user_id = p_user_id
      ),
      'total_current_balance', (
        SELECT COALESCE(SUM(current_balance), 0) FROM budget_plans
        WHERE user_id = p_user_id
      ),
      'vault_schedules_count', (
        SELECT COUNT(*) FROM vault_payout_schedules WHERE user_id = p_user_id
      ),
      'active_vault_schedules', (
        SELECT COUNT(*) FROM vault_payout_schedules
        WHERE user_id = p_user_id AND status = 'active'
      )
    ),

    -- ── Transactions ─────────────────────────────────────────────────────────
    'transactions', jsonb_build_object(
      'total_count', (
        SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id
      ),
      'deposit_total',    v_deposit_total,
      'payout_total',     v_payout_tx_total,
      'withdrawal_total', (
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE user_id = p_user_id
          AND type IN ('withdrawal', 'emergency_withdrawal')
          AND status IN ('completed', 'success', 'Completed')
      )
    ),

    -- ── Reconciliation verdict ───────────────────────────────────────────────
    'reconciliation', jsonb_build_object(
      'all_clear', (v_reconciliation->>'all_clear')::boolean,
      'verdict',   v_reconciliation->>'verdict'
    )
  );

  -- ══════════════════════════════════════════════════════════════════════════
  -- ASSEMBLE & RETURN
  -- ══════════════════════════════════════════════════════════════════════════
  RETURN jsonb_build_object(
    'generated_at',          now(),
    'identity',              v_identity,
    'overview',              v_overview,
    'wallet',                v_wallet,
    'wallet_ledger',         v_wallet_ledger,
    'deposits',              v_deposits,
    'payout_plans',          v_payout_plans,
    'payout_summary',        v_payout_summary,
    'automated_payouts',     v_automated_payouts,
    'emergency_withdrawals', v_emergency_withdrawals,
    'vault_plans',           v_vault_plans,
    'vault_schedules',       v_vault_schedules,
    'transaction_ledger',    v_tx_ledger,
    'reconciliation',        v_reconciliation
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   SQLERRM,
    'detail',  SQLSTATE,
    'user_id', p_user_id
  );
END;
$$;

-- ── Permissions: admin/ops only ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.monitor_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.monitor_user(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.monitor_user(uuid) TO service_role;

COMMENT ON FUNCTION public.monitor_user IS
  'Admin/ops monitoring function. Returns a full financial audit for one user: '
  'wallet snapshot, all payout plans with per-plan three-way tally checks '
  '(plan counter vs automated_payouts vs transactions), emergency withdrawals, '
  'vault plans & schedules, and a reconciliation section with discrepancy flags. '
  'Service-role only. Usage: SELECT jsonb_pretty(monitor_user(''<user-uuid>''));';
