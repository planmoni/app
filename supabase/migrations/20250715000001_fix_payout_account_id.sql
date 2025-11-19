/*
  # Fix Automated Payouts to Use Payout Account ID
  
  1. Changes
    - Add payout_account_id column to automated_payouts table
    - Update all functions to use payout_account_id instead of bank_account_id
    - Fix function logic to work with payout_accounts table
  
  2. Rationale
    - The system should use payout_accounts for payouts, not bank_accounts
    - This allows for proper separation of linked accounts vs payout accounts
*/

-- Add payout_account_id column to automated_payouts table
ALTER TABLE automated_payouts ADD COLUMN IF NOT EXISTS payout_account_id uuid REFERENCES payout_accounts(id);

-- Add Paystack transfer recipient support to payout_accounts
ALTER TABLE payout_accounts ADD COLUMN IF NOT EXISTS paystack_recipient_code text;
ALTER TABLE payout_accounts ADD COLUMN IF NOT EXISTS transfer_enabled boolean DEFAULT false;
ALTER TABLE payout_accounts ADD COLUMN IF NOT EXISTS last_transfer_attempt timestamptz;

-- Update existing records to use payout_account_id where possible
UPDATE automated_payouts 
SET payout_account_id = pp.payout_account_id
FROM payout_plans pp 
WHERE automated_payouts.payout_plan_id = pp.id 
  AND pp.payout_account_id IS NOT NULL
  AND automated_payouts.payout_account_id IS NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_automated_payouts_payout_account ON automated_payouts(payout_account_id);

-- Create index for transfer-enabled payout accounts
CREATE INDEX IF NOT EXISTS idx_payout_accounts_transfer_enabled 
ON payout_accounts(transfer_enabled, user_id) 
WHERE transfer_enabled = true;

-- Drop and recreate get_due_payout_plans function to return payout_account_id
DROP FUNCTION IF EXISTS get_due_payout_plans(date);

CREATE OR REPLACE FUNCTION get_due_payout_plans(check_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  payout_account_id uuid,
  next_payout_date date,
  completed_payouts integer,
  duration integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id as plan_id,
    pp.user_id,
    pp.name,
    pp.payout_amount,
    pp.payout_account_id,
    pp.next_payout_date,
    pp.completed_payouts,
    pp.duration
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= check_date
    AND pp.completed_payouts < pp.duration
    AND pp.payout_account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM automated_payouts ap 
      WHERE ap.payout_plan_id = pp.id 
        AND ap.scheduled_date = pp.next_payout_date
        AND ap.status IN ('pending', 'processing', 'completed')
    );
END;
$$;

-- Update create_automated_payout function to use payout_account_id
CREATE OR REPLACE FUNCTION create_automated_payout(
  p_plan_id uuid,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_payout_id uuid;
  v_reference text;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found: %', p_plan_id;
  END IF;
  
  -- Validate plan is eligible for payout
  IF v_plan.status != 'active' THEN
    RAISE EXCEPTION 'Payout plan is not active: %', v_plan.status;
  END IF;
  
  IF v_plan.completed_payouts >= v_plan.duration THEN
    RAISE EXCEPTION 'Payout plan is already completed';
  END IF;
  
  IF v_plan.payout_account_id IS NULL THEN
    RAISE EXCEPTION 'Payout plan does not have a payout account configured';
  END IF;
  
  -- Generate unique reference
  v_reference := 'auto_payout_' || p_plan_id || '_' || p_scheduled_date || '_' || extract(epoch from now())::bigint;
  
  -- Create automated payout record
  INSERT INTO automated_payouts (
    payout_plan_id,
    user_id,
    scheduled_date,
    status,
    transfer_reference,
    amount,
    payout_account_id
  ) VALUES (
    p_plan_id,
    v_plan.user_id,
    p_scheduled_date,
    'pending',
    v_reference,
    v_plan.payout_amount,
    v_plan.payout_account_id
  ) RETURNING id INTO v_payout_id;
  
  RETURN v_payout_id;
END;
$$;

-- Drop and recreate get_retry_payouts function to return payout_account_id
DROP FUNCTION IF EXISTS get_retry_payouts();

CREATE OR REPLACE FUNCTION get_retry_payouts()
RETURNS TABLE(
  payout_id uuid,
  payout_plan_id uuid,
  user_id uuid,
  amount numeric,
  payout_account_id uuid,
  transfer_reference text,
  retry_count integer,
  error_message text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id as payout_id,
    ap.payout_plan_id,
    ap.user_id,
    ap.amount,
    ap.payout_account_id,
    ap.transfer_reference,
    ap.retry_count,
    ap.error_message
  FROM automated_payouts ap
  WHERE ap.status = 'retrying'
    AND ap.retry_after IS NOT NULL
    AND ap.retry_after <= now()
    AND ap.retry_count <= 3
    AND ap.payout_account_id IS NOT NULL;
END;
$$;

-- Update validate_payout_eligibility function to check payout_account
CREATE OR REPLACE FUNCTION validate_payout_eligibility(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_payout_account payout_accounts%ROWTYPE;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout plan not found');
  END IF;
  
  -- Check plan status
  IF v_plan.status != 'active' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Plan is not active');
  END IF;
  
  -- Check if plan is completed
  IF v_plan.completed_payouts >= v_plan.duration THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Plan is already completed');
  END IF;
  
  -- Check payout date
  IF v_plan.next_payout_date IS NULL OR v_plan.next_payout_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout date has not arrived');
  END IF;
  
  -- Get wallet details
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_plan.user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Wallet not found');
  END IF;
  
  -- Check wallet balance
  IF v_wallet.locked_balance < v_plan.payout_amount THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Insufficient locked balance');
  END IF;
  
  -- Get payout account details
  IF v_plan.payout_account_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'No payout account configured');
  END IF;
  
  SELECT * INTO v_payout_account FROM payout_accounts WHERE id = v_plan.payout_account_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout account not found');
  END IF;
  
  -- Check for existing processing payout
  IF EXISTS (
    SELECT 1 FROM automated_payouts 
    WHERE payout_plan_id = p_plan_id 
      AND scheduled_date = v_plan.next_payout_date
      AND status IN ('pending', 'processing')
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout already being processed');
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', true,
    'plan', row_to_json(v_plan),
    'wallet_balance', v_wallet.locked_balance,
    'payout_account', row_to_json(v_payout_account)
  );
END;
$$;
