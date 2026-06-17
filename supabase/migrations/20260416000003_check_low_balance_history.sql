/*
  check_low_balance_history(p_user_id, p_low_threshold)
  ======================================================

  Answers the question:
    "How many times was this user's available balance at zero (or below
     a threshold) right before they topped up — and when did it happen?"

  Works by scanning wallet_ledger for:

    1. ZERO events  — available_balance_before = 0 and the next operation
                      increased available balance (they topped up from empty)

    2. LOW events   — available_balance_before > 0 but < p_low_threshold
                      and the next operation increased available balance
                      (they topped up while running dangerously low)

    3. DROUGHT periods — stretches of time where available_balance stayed
                         below p_low_threshold, from when it first dropped
                         until the first recovery above threshold.
                         Includes duration so you can see how long they were
                         in trouble.

  Also returns:
    • summary stats (total zero events, total low events, avg drought duration)
    • whether the balance is currently zero or low
    • the last time balance was zero

  Usage (from psql / Supabase SQL editor, service_role):

      SELECT jsonb_pretty(
        check_low_balance_history('user-uuid-here')
      );

      -- change the low threshold (default 100):
      SELECT jsonb_pretty(
        check_low_balance_history('user-uuid-here', 500)
      );
*/

CREATE OR REPLACE FUNCTION public.check_low_balance_history(
  p_user_id       uuid,
  p_low_threshold numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_available  numeric := 0;
  v_result             jsonb;
BEGIN

  -- ── 0. Guard ────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'User not found', 'user_id', p_user_id);
  END IF;

  SELECT COALESCE(available_balance, 0)
  INTO v_current_available
  FROM wallets
  WHERE user_id = p_user_id;

  -- ── Main query ──────────────────────────────────────────────────────────────
  WITH

  -- All ledger rows for this user, ordered chronologically
  ledger AS (
    SELECT
      id,
      operation,
      source_kind,
      source_ref,
      available_balance_before,
      available_balance_after,
      available_balance_delta,
      recorded_at,
      -- Look ahead: what was the available balance after the NEXT operation?
      LEAD(available_balance_after)  OVER w AS next_available_after,
      LEAD(operation)                OVER w AS next_operation,
      LEAD(source_kind)              OVER w AS next_source_kind,
      LEAD(available_balance_delta)  OVER w AS next_delta,
      LEAD(recorded_at)              OVER w AS next_recorded_at
    FROM wallet_ledger
    WHERE user_id = p_user_id
    WINDOW w AS (ORDER BY recorded_at, id)
  ),

  -- ── 1. ZERO TOP-UP EVENTS ──────────────────────────────────────────────────
  -- Rows where available_balance_before was exactly zero and then a top-up happened
  zero_topups AS (
    SELECT
      recorded_at              AS dropped_to_zero_at,
      operation                AS drop_operation,
      source_kind              AS drop_source,
      available_balance_before AS balance_just_before_drop,
      available_balance_after  AS balance_at_zero,   -- should be 0
      next_recorded_at         AS topped_up_at,
      next_operation           AS topup_operation,
      next_source_kind         AS topup_source,
      next_delta               AS topup_amount,
      next_available_after     AS balance_after_topup,
      CASE
        WHEN next_recorded_at IS NOT NULL
        THEN next_recorded_at - recorded_at
      END                      AS time_at_zero
    FROM ledger
    WHERE available_balance_after = 0        -- hit exactly zero
      AND available_balance_delta < 0        -- was a deduction (not already zero)
      AND next_delta > 0                     -- next move was a credit (top-up)
    ORDER BY recorded_at DESC
  ),

  -- ── 2. LOW BALANCE TOP-UP EVENTS ──────────────────────────────────────────
  -- Rows where balance_before was > 0 but below threshold, then topped up
  low_topups AS (
    SELECT
      recorded_at              AS dropped_low_at,
      operation                AS drop_operation,
      source_kind              AS drop_source,
      available_balance_before AS balance_before_drop,
      available_balance_after  AS balance_at_low,
      next_recorded_at         AS topped_up_at,
      next_operation           AS topup_operation,
      next_source_kind         AS topup_source,
      next_delta               AS topup_amount,
      next_available_after     AS balance_after_topup,
      CASE
        WHEN next_recorded_at IS NOT NULL
        THEN next_recorded_at - recorded_at
      END                      AS time_below_threshold
    FROM ledger
    WHERE available_balance_after > 0
      AND available_balance_after < p_low_threshold   -- landed below threshold
      AND available_balance_delta < 0                 -- was a deduction
      AND (
        available_balance_before >= p_low_threshold   -- was above threshold before
        OR available_balance_before = 0               -- or was already recovering
      )
      AND next_delta > 0                              -- next move was a credit
    ORDER BY dropped_low_at DESC
  ),

  -- ── 3. DROUGHT PERIODS ────────────────────────────────────────────────────
  -- Contiguous stretches below p_low_threshold.
  -- A drought STARTS when balance_before >= threshold but balance_after < threshold.
  -- A drought ENDS   when balance_after  >= threshold.
  drought_boundaries AS (
    SELECT
      id,
      recorded_at,
      operation,
      source_kind,
      available_balance_before,
      available_balance_after,
      available_balance_delta,
      -- Flag the entry that STARTED this drought
      CASE
        WHEN available_balance_after < p_low_threshold
          AND (available_balance_before >= p_low_threshold OR id = (
                SELECT id FROM wallet_ledger
                WHERE user_id = p_user_id
                ORDER BY recorded_at, id
                LIMIT 1
              ))
        THEN 'start'
      END AS boundary,
      -- Flag the entry that ENDED a drought
      CASE
        WHEN available_balance_after >= p_low_threshold
          AND available_balance_before < p_low_threshold
        THEN 'end'
      END AS recovery
    FROM ledger
  ),
  drought_starts AS (
    SELECT
      id,
      recorded_at         AS drought_started_at,
      operation           AS trigger_operation,
      source_kind         AS trigger_source,
      available_balance_before AS balance_before_drought,
      available_balance_after  AS balance_at_drought_start
    FROM drought_boundaries
    WHERE boundary = 'start'
  ),
  drought_ends AS (
    SELECT
      id,
      recorded_at            AS drought_ended_at,
      operation              AS recovery_operation,
      source_kind            AS recovery_source,
      available_balance_after AS balance_at_recovery
    FROM drought_boundaries
    WHERE recovery = 'end'
  ),
  droughts AS (
    SELECT DISTINCT ON (ds.drought_started_at)
      ds.drought_started_at,
      ds.trigger_operation,
      ds.trigger_source,
      ds.balance_before_drought,
      ds.balance_at_drought_start,
      de.drought_ended_at,
      de.recovery_operation,
      de.recovery_source,
      de.balance_at_recovery,
      CASE
        WHEN de.drought_ended_at IS NOT NULL
        THEN de.drought_ended_at - ds.drought_started_at
        ELSE now() - ds.drought_started_at   -- still in drought
      END AS drought_duration,
      de.drought_ended_at IS NULL AS still_in_drought
    FROM drought_starts ds
    LEFT JOIN drought_ends de
      ON de.drought_ended_at > ds.drought_started_at
    ORDER BY ds.drought_started_at, de.drought_ended_at
  )

  -- ── ASSEMBLE ────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'generated_at',        now(),
    'user_id',             p_user_id,
    'low_threshold',       p_low_threshold,

    -- Current state
    'current_available_balance',  v_current_available,
    'currently_at_zero',          v_current_available = 0,
    'currently_below_threshold',  v_current_available < p_low_threshold AND v_current_available > 0,

    -- ── Summary ──────────────────────────────────────────────────────────────
    'summary', jsonb_build_object(
      'zero_topup_events',         (SELECT COUNT(*) FROM zero_topups),
      'low_topup_events',          (SELECT COUNT(*) FROM low_topups),
      'total_drought_periods',     (SELECT COUNT(*) FROM droughts),
      'droughts_still_open',       (SELECT COUNT(*) FROM droughts WHERE still_in_drought),
      'last_zero_event_at', (
        SELECT MAX(dropped_to_zero_at) FROM zero_topups
      ),
      'last_low_event_at', (
        SELECT MAX(dropped_low_at) FROM low_topups
      ),
      'avg_zero_duration', (
        SELECT AVG(time_at_zero) FROM zero_topups WHERE time_at_zero IS NOT NULL
      ),
      'avg_drought_duration', (
        SELECT AVG(drought_duration) FROM droughts WHERE NOT still_in_drought
      ),
      'longest_drought', (
        SELECT MAX(drought_duration) FROM droughts
      )
    ),

    -- ── Zero top-up events (topped up from exactly ₦0) ───────────────────────
    'zero_topup_events', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'dropped_to_zero_at',   dropped_to_zero_at,
          'drop_operation',       drop_operation,
          'drop_source',          drop_source,
          'balance_before_drop',  balance_just_before_drop,
          'topped_up_at',         topped_up_at,
          'topup_operation',      topup_operation,
          'topup_source',         topup_source,
          'topup_amount',         topup_amount,
          'balance_after_topup',  balance_after_topup,
          'time_at_zero',         time_at_zero
        ) ORDER BY dropped_to_zero_at DESC
      ), '[]'::jsonb)
      FROM zero_topups
    ),

    -- ── Low balance top-up events (topped up while below threshold) ───────────
    'low_topup_events', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'dropped_low_at',        dropped_low_at,
          'drop_operation',        drop_operation,
          'drop_source',           drop_source,
          'balance_before_drop',   balance_before_drop,
          'balance_at_low',        balance_at_low,
          'topped_up_at',          topped_up_at,
          'topup_operation',       topup_operation,
          'topup_source',          topup_source,
          'topup_amount',          topup_amount,
          'balance_after_topup',   balance_after_topup,
          'time_below_threshold',  time_below_threshold
        ) ORDER BY dropped_low_at DESC
      ), '[]'::jsonb)
      FROM low_topups
    ),

    -- ── Drought periods (full contiguous stretches below threshold) ───────────
    'drought_periods', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'drought_started_at',       drought_started_at,
          'trigger_operation',        trigger_operation,
          'trigger_source',           trigger_source,
          'balance_before_drought',   balance_before_drought,
          'balance_at_drought_start', balance_at_drought_start,
          'drought_ended_at',         drought_ended_at,
          'recovery_operation',       recovery_operation,
          'recovery_source',          recovery_source,
          'balance_at_recovery',      balance_at_recovery,
          'drought_duration',         drought_duration,
          'still_in_drought',         still_in_drought
        ) ORDER BY drought_started_at DESC
      ), '[]'::jsonb)
      FROM droughts
    )
  )
  INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error',   SQLERRM,
    'detail',  SQLSTATE,
    'user_id', p_user_id
  );
END;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.check_low_balance_history(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_low_balance_history(uuid, numeric) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_low_balance_history(uuid, numeric) TO service_role;

COMMENT ON FUNCTION public.check_low_balance_history IS
  'Admin audit function. Scans wallet_ledger to find every time a user''s '
  'available_balance was at exactly zero — or below a configurable threshold '
  '(default ₦100) — right before a top-up, plus full drought periods. '
  'Returns summary stats and a chronological breakdown. '
  'Service-role only. '
  'Usage: SELECT jsonb_pretty(check_low_balance_history(''<uuid>''));'
  '       SELECT jsonb_pretty(check_low_balance_history(''<uuid>'', 500));';
