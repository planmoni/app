/*
  # Create User Fees Ledger + Rollup
  
  Creates:
  - user_fee_events (append-only ledger of fee events)
  - user_fees (per-user rollup)
  - record_user_fee() helper (insert ledger + upsert rollup, idempotent)
  - charge_plan_fee() helper (deduct plan fee once + record fee)
*/

-- 1) Ledger table: user_fee_events
CREATE TABLE IF NOT EXISTS user_fee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('payout_plan', 'emergency_withdrawal', 'transfer', 'other')),
  source_id uuid,
  fee_type text NOT NULL CHECK (fee_type IN ('plan_creation', 'withdrawal', 'transfer', 'other')),
  currency text DEFAULT 'NGN',
  gross_amount numeric,
  fee_percentage numeric,
  fee_amount numeric NOT NULL CHECK (fee_amount >= 0),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Idempotency per fee event (only when a source_id exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'user_fee_events'
      AND constraint_name = 'user_fee_events_source_unique'
  ) THEN
    ALTER TABLE user_fee_events
      ADD CONSTRAINT user_fee_events_source_unique UNIQUE (source_type, source_id, fee_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_fee_events_user_created_at
  ON user_fee_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_fee_events_source
  ON user_fee_events(source_type, source_id);

-- 2) Rollup table: user_fees
CREATE TABLE IF NOT EXISTS user_fees (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  currency text DEFAULT 'NGN',
  total_fee_amount numeric NOT NULL DEFAULT 0 CHECK (total_fee_amount >= 0),
  last_fee_event_id uuid REFERENCES user_fee_events(id) ON DELETE SET NULL,
  last_fee_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_fees_total_desc
  ON user_fees(total_fee_amount DESC);

-- 3) RLS
ALTER TABLE user_fee_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_fees ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_fee_events' AND policyname = 'Service role can manage user fee events'
  ) THEN
    CREATE POLICY "Service role can manage user fee events"
      ON user_fee_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_fee_events' AND policyname = 'Users can view own fee events'
  ) THEN
    CREATE POLICY "Users can view own fee events"
      ON user_fee_events
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_fees' AND policyname = 'Service role can manage user fees rollup'
  ) THEN
    CREATE POLICY "Service role can manage user fees rollup"
      ON user_fees
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_fees' AND policyname = 'Users can view own fee totals'
  ) THEN
    CREATE POLICY "Users can view own fee totals"
      ON user_fees
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 4) record_user_fee(): insert ledger + upsert rollup (idempotent)
CREATE OR REPLACE FUNCTION record_user_fee(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_fee_type text,
  p_fee_amount numeric,
  p_currency text DEFAULT 'NGN',
  p_gross_amount numeric DEFAULT NULL,
  p_fee_percentage numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_inserted boolean := false;
BEGIN
  IF p_fee_amount IS NULL OR p_fee_amount < 0 THEN
    RAISE EXCEPTION 'fee_amount must be >= 0';
  END IF;

  INSERT INTO user_fee_events (
    user_id, source_type, source_id, fee_type,
    currency, gross_amount, fee_percentage, fee_amount, metadata
  )
  VALUES (
    p_user_id, p_source_type, p_source_id, p_fee_type,
    p_currency, p_gross_amount, p_fee_percentage, p_fee_amount, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (source_type, source_id, fee_type) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    -- Already recorded; fetch existing id for convenience
    SELECT id INTO v_event_id
    FROM user_fee_events
    WHERE source_type = p_source_type
      AND source_id = p_source_id
      AND fee_type = p_fee_type
    LIMIT 1;
  END IF;

  -- Only roll up if this is a new event
  IF v_inserted THEN
    INSERT INTO user_fees (user_id, currency, total_fee_amount, last_fee_event_id, last_fee_at, updated_at)
    VALUES (p_user_id, p_currency, p_fee_amount, v_event_id, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      total_fee_amount = user_fees.total_fee_amount + EXCLUDED.total_fee_amount,
      currency = EXCLUDED.currency,
      last_fee_event_id = EXCLUDED.last_fee_event_id,
      last_fee_at = EXCLUDED.last_fee_at,
      updated_at = now();
  END IF;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_user_fee(uuid, text, uuid, text, numeric, text, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION record_user_fee(uuid, text, uuid, text, numeric, text, numeric, numeric, jsonb) TO service_role;

-- 5) charge_plan_fee(): deduct plan fee once + record fee event
CREATE OR REPLACE FUNCTION charge_plan_fee(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_existing uuid;
  v_fee_amount numeric;
  v_fee_percent numeric;
  v_event_id uuid;
  v_deduct_result jsonb;
BEGIN
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;

  -- If already charged, no-op
  SELECT id INTO v_existing
  FROM user_fee_events
  WHERE source_type = 'payout_plan'
    AND source_id = p_plan_id
    AND fee_type = 'plan_creation'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_charged', true, 'event_id', v_existing);
  END IF;

  v_fee_amount := COALESCE(v_plan.fee_amount, 0);
  v_fee_percent := COALESCE(v_plan.fee_percentage, NULL);

  IF v_fee_amount <= 0 THEN
    -- Still record a zero-fee event? No: treat as no-op.
    RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', null, 'message', 'No fee to charge');
  END IF;

  -- Deduct the fee from both balance and locked_balance (fee was included in initial lock)
  v_deduct_result := deduct_locked_funds(v_plan.user_id, v_fee_amount);
  IF COALESCE((v_deduct_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_deduct_result->>'error', 'Failed to deduct fee'));
  END IF;

  v_event_id := record_user_fee(
    v_plan.user_id,
    'payout_plan',
    p_plan_id,
    'plan_creation',
    'NGN',
    v_plan.total_amount,
    v_fee_percent,
    v_fee_amount,
    jsonb_build_object(
      'net_payout_amount', v_plan.net_payout_amount,
      'frequency', v_plan.frequency
    )
  );

  RETURN jsonb_build_object('success', true, 'already_charged', false, 'event_id', v_event_id, 'deduct_result', v_deduct_result);
END;
$$;

GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION charge_plan_fee(uuid) TO service_role;

