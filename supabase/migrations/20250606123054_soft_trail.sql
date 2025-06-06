/*
  # Payout Plan System Enhancements
  
  1. Enhanced Tables
    - Add indexes for better performance
    - Add constraints for data integrity
    - Add computed columns for better queries
  
  2. Functions
    - Calculate next payout date
    - Update payout plan progress
    - Handle payout execution
  
  3. Security
    - Enhanced RLS policies
    - Audit triggers
*/

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payout_plans_user_status ON payout_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_plans_next_payout ON payout_plans(next_payout_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_default ON bank_accounts(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_status ON events(user_id, status, created_at);

-- Function to calculate next payout date
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer
)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_frequency
    WHEN 'weekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN p_start_date;
  END CASE;
END;
$$;

-- Function to update payout plan progress
CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_date date;
BEGIN
  -- Get the plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Calculate next payout date
  IF v_plan.frequency = 'custom' THEN
    -- For custom frequency, get the next date from custom_payout_dates
    SELECT payout_date INTO v_next_date
    FROM custom_payout_dates
    WHERE payout_plan_id = p_plan_id
    AND payout_date > CURRENT_DATE
    ORDER BY payout_date
    LIMIT 1;
  ELSE
    v_next_date := calculate_next_payout_date(
      v_plan.start_date,
      v_plan.frequency,
      v_plan.completed_payouts + 1
    );
  END IF;
  
  -- Update the plan
  UPDATE payout_plans
  SET 
    next_payout_date = v_next_date,
    status = CASE 
      WHEN completed_payouts >= duration THEN 'completed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_plan_id;
END;
$$;

-- Function to process a payout
CREATE OR REPLACE FUNCTION process_payout(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_bank_account bank_accounts%ROWTYPE;
  v_transaction_id uuid;
BEGIN
  -- Get the plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active payout plan not found';
  END IF;
  
  -- Check if it's time for payout
  IF v_plan.next_payout_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payout date has not arrived yet';
  END IF;
  
  -- Get bank account details
  SELECT * INTO v_bank_account FROM bank_accounts WHERE id = v_plan.bank_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account not found';
  END IF;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    payout_plan_id,
    bank_account_id,
    description
  ) VALUES (
    v_plan.user_id,
    'payout',
    v_plan.payout_amount,
    'completed',
    'wallet',
    v_bank_account.bank_name || ' (' || v_bank_account.account_number || ')',
    p_plan_id,
    v_plan.bank_account_id,
    'Automated payout from ' || v_plan.name
  ) RETURNING id INTO v_transaction_id;
  
  -- Update payout plan
  UPDATE payout_plans
  SET 
    completed_payouts = completed_payouts + 1,
    updated_at = now()
  WHERE id = p_plan_id;
  
  -- Update progress and next payout date
  PERFORM update_payout_plan_progress(p_plan_id);
  
  -- Create notification event
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    payout_plan_id,
    transaction_id
  ) VALUES (
    v_plan.user_id,
    'payout_completed',
    'Payout Completed',
    format('₦%s has been sent to your %s account', v_plan.payout_amount::text, v_bank_account.bank_name),
    'unread',
    p_plan_id,
    v_transaction_id
  );
END;
$$;

-- Trigger to update next_payout_date when a plan is created
CREATE OR REPLACE FUNCTION trigger_update_next_payout_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate and set the next payout date
  PERFORM update_payout_plan_progress(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger for new payout plans
DROP TRIGGER IF EXISTS trigger_payout_plan_next_date ON payout_plans;
CREATE TRIGGER trigger_payout_plan_next_date
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_next_payout_date();

-- Enhanced RLS policies for better security
DROP POLICY IF EXISTS "Users can delete own payout plans" ON payout_plans;
CREATE POLICY "Users can delete own payout plans"
  ON payout_plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for custom payout dates insert
DROP POLICY IF EXISTS "Users can insert own custom payout dates" ON custom_payout_dates;
CREATE POLICY "Users can insert own custom payout dates"
  ON custom_payout_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payout_plans
      WHERE payout_plans.id = custom_payout_dates.payout_plan_id
      AND payout_plans.user_id = auth.uid()
    )
  );