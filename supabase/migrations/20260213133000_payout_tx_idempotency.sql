-- Idempotency for payout transactions: ensure only one payout transaction per plan per day
-- and provide an RPC helper to create a transaction only if one doesn't already exist today.

-- ============================================================================
-- Use a trigger-maintained column for the UTC day to avoid IMMUTABLE restrictions
-- ============================================================================

-- 1) Add a tx_day column (date) if it doesn't exist
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS tx_day date;

-- 2) Backfill existing rows (safe re-run)
UPDATE transactions
SET tx_day = created_at::date
WHERE tx_day IS NULL;

-- 3) Trigger function to keep tx_day in sync with created_at
CREATE OR REPLACE FUNCTION set_transactions_tx_day()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;
  NEW.tx_day := (NEW.created_at)::date;
  RETURN NEW;
END;
$$;

-- 4) Install trigger (idempotent)
DROP TRIGGER IF EXISTS trg_set_transactions_tx_day ON transactions;
CREATE TRIGGER trg_set_transactions_tx_day
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_transactions_tx_day();

-- (Idempotency for one payout per plan per day is enforced in process_due_payouts Edge Function
-- via a manual check before creating transactions; no unique index or row updates here.)

-- ============================================================================
-- RPC: create_payout_transaction_if_absent
-- Attempts to find today's payout transaction for the plan; if none, inserts one
-- ============================================================================
CREATE OR REPLACE FUNCTION create_payout_transaction_if_absent(
  p_user_id uuid,
  p_plan_id uuid,
  p_amount numeric,
  p_reference text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := now()::date;
  v_existing_id uuid;
  v_existing_status text;
  v_tx_id uuid;
BEGIN
  -- Check for existing payout transaction for this plan today
  SELECT id, status
  INTO v_existing_id, v_existing_status
  FROM transactions
  WHERE payout_plan_id = p_plan_id
    AND type = 'payout'
    AND tx_day = v_today
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_created_today', true,
      'transaction_id', v_existing_id,
      'status', v_existing_status
    );
  END IF;

  -- Insert a new pending transaction for today
  INSERT INTO transactions (
    user_id, type, amount, status, source, destination, reference, payout_plan_id, description, metadata
  ) VALUES (
    p_user_id, 'payout', p_amount, 'pending', 'Wallet', 'Bank Transfer', p_reference, p_plan_id,
    'Automated payout', COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_created_today', false,
    'transaction_id', v_tx_id,
    'status', 'pending'
  );
EXCEPTION WHEN unique_violation THEN
  -- Another concurrent insert won; return that one
  SELECT id, status
  INTO v_existing_id, v_existing_status
  FROM transactions
  WHERE payout_plan_id = p_plan_id
    AND type = 'payout'
    AND tx_day = v_today
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'already_created_today', true,
    'transaction_id', v_existing_id,
    'status', v_existing_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_payout_transaction_if_absent(uuid, uuid, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_payout_transaction_if_absent(uuid, uuid, numeric, text, jsonb) TO service_role;
