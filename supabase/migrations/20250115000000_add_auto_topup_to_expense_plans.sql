/*
  # Add Auto Top-Up Fields to Expense Plans
  
  This migration adds auto top-up functionality to expense plans:
  1. Auto top-up configuration fields on expense_plans table
  2. Helper functions for calculating top-up schedules
*/

-- Add auto top-up columns to expense_plans table
ALTER TABLE expense_plans
  ADD COLUMN IF NOT EXISTS auto_topup_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_topup_frequency text CHECK (auto_topup_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS auto_topup_amount numeric CHECK (auto_topup_amount >= 0),
  ADD COLUMN IF NOT EXISTS auto_topup_start_date date,
  ADD COLUMN IF NOT EXISTS auto_topup_end_date date,
  ADD COLUMN IF NOT EXISTS auto_topup_next_date date,
  ADD COLUMN IF NOT EXISTS auto_topup_total_cycles integer CHECK (auto_topup_total_cycles >= 0);

-- Create index for efficient querying of scheduled top-ups
CREATE INDEX IF NOT EXISTS idx_expense_plans_auto_topup_next_date 
  ON expense_plans(auto_topup_next_date) 
  WHERE auto_topup_enabled = true;

-- Function to calculate appropriate top-up frequency based on days until start
CREATE OR REPLACE FUNCTION calculate_topup_frequency(days_until_start integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF days_until_start < 7 THEN
    RETURN 'daily';
  ELSIF days_until_start < 14 THEN
    RETURN 'weekly';
  ELSIF days_until_start < 31 THEN
    RETURN 'biweekly';
  ELSIF days_until_start < 91 THEN
    RETURN 'monthly';
  ELSIF days_until_start < 365 THEN
    RETURN 'quarterly';
  ELSE
    RETURN 'yearly';
  END IF;
END;
$$;

-- Function to calculate number of top-up cycles
CREATE OR REPLACE FUNCTION calculate_topup_cycles(
  start_date date,
  end_date date,
  frequency text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  days_diff integer;
BEGIN
  days_diff := end_date - start_date + 1;
  
  CASE frequency
    WHEN 'daily' THEN
      RETURN GREATEST(1, days_diff);
    WHEN 'weekly' THEN
      RETURN GREATEST(1, CEIL(days_diff::numeric / 7));
    WHEN 'biweekly' THEN
      RETURN GREATEST(1, CEIL(days_diff::numeric / 14));
    WHEN 'monthly' THEN
      RETURN GREATEST(1, CEIL(days_diff::numeric / 30));
    WHEN 'quarterly' THEN
      RETURN GREATEST(1, CEIL(days_diff::numeric / 90));
    WHEN 'yearly' THEN
      RETURN GREATEST(1, CEIL(days_diff::numeric / 365));
    ELSE
      RETURN 1;
  END CASE;
END;
$$;

-- Function to get next top-up date based on frequency
CREATE OR REPLACE FUNCTION get_next_topup_date(
  last_date date,
  frequency text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE frequency
    WHEN 'daily' THEN
      RETURN last_date + INTERVAL '1 day';
    WHEN 'weekly' THEN
      RETURN last_date + INTERVAL '1 week';
    WHEN 'biweekly' THEN
      RETURN last_date + INTERVAL '2 weeks';
    WHEN 'monthly' THEN
      RETURN last_date + INTERVAL '1 month';
    WHEN 'quarterly' THEN
      RETURN last_date + INTERVAL '3 months';
    WHEN 'yearly' THEN
      RETURN last_date + INTERVAL '1 year';
    ELSE
      RETURN last_date + INTERVAL '1 day';
  END CASE;
END;
$$;

-- Add comment to table
COMMENT ON COLUMN expense_plans.auto_topup_enabled IS 'Whether automatic top-ups are enabled for this plan';
COMMENT ON COLUMN expense_plans.auto_topup_frequency IS 'Frequency of automatic top-ups: daily, weekly, biweekly, monthly, quarterly, or yearly';
COMMENT ON COLUMN expense_plans.auto_topup_amount IS 'Amount to transfer per top-up cycle';
COMMENT ON COLUMN expense_plans.auto_topup_start_date IS 'Date when top-ups should start (typically tomorrow)';
COMMENT ON COLUMN expense_plans.auto_topup_end_date IS 'Last date for top-ups (day before budget starts)';
COMMENT ON COLUMN expense_plans.auto_topup_next_date IS 'Next scheduled top-up date';
COMMENT ON COLUMN expense_plans.auto_topup_total_cycles IS 'Total number of top-up cycles needed';

-- Function to process expense plan auto top-up
-- This function atomically transfers funds from user's main wallet to expense plan
CREATE OR REPLACE FUNCTION process_expense_plan_topup(
  p_plan_id uuid,
  p_user_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_plan_wallet_id uuid;
  v_new_wallet_balance numeric;
  v_new_plan_balance numeric;
BEGIN
  -- Validate input
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  -- Get user's main wallet with row lock
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found'
    );
  END IF;

  -- Check if user has sufficient balance
  IF (SELECT balance FROM wallets WHERE id = v_wallet_id) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds',
      'required', p_amount,
      'available', (SELECT balance FROM wallets WHERE id = v_wallet_id)
    );
  END IF;

  -- Get plan wallet ID
  SELECT id INTO v_plan_wallet_id
  FROM plan_wallets
  WHERE plan_id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan wallet not found'
    );
  END IF;

  -- Debit from main wallet
  UPDATE wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_wallet_balance;

  -- Create transaction record for wallet debit
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'expense_plan_topup',
    p_amount,
    'completed',
    'wallet',
    'expense_plan',
    format('Auto top-up to expense plan %s', p_plan_id)
  );

  -- Credit to plan wallet via plan_transactions (trigger will update balances)
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    p_plan_id,
    v_plan_wallet_id,
    'auto_allocation',
    p_amount,
    'Automatic top-up from main wallet'
  );

  -- Get updated plan balance
  SELECT current_balance INTO v_new_plan_balance
  FROM expense_plans
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_wallet_balance', v_new_wallet_balance,
    'new_plan_balance', v_new_plan_balance,
    'amount', p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_expense_plan_topup TO authenticated, service_role;

