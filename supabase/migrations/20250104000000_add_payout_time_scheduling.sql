/*
  # Add Payout Time Scheduling Support
  
  This migration adds support for scheduling payouts at specific times of the day.
  
  Changes:
  1. Add payout_time field to store time of day (HH:MM format)
  2. Update next_payout_date to timestamptz for exact scheduling
  3. Update processing functions to handle time-based scheduling
  4. Add indexes for better performance
*/

-- Add payout_time column to store the time of day for payouts
ALTER TABLE payout_plans 
ADD COLUMN IF NOT EXISTS payout_time time DEFAULT '09:00:00';

-- Add comment to explain the field
COMMENT ON COLUMN payout_plans.payout_time IS 'Time of day when payout should be executed (HH:MM format)';

-- Update next_payout_date to timestamptz to support exact time scheduling
-- First, we need to handle existing data and dependent objects
DO $$
BEGIN
  -- If next_payout_date is date type, we need to convert it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' 
    AND column_name = 'next_payout_date' 
    AND data_type = 'date'
  ) THEN
    -- Drop dependent triggers first
    DROP TRIGGER IF EXISTS trigger_auto_process_payout ON payout_plans;
    DROP TRIGGER IF EXISTS trigger_auto_process_payout_insert ON payout_plans;
    
    -- Add a temporary column
    ALTER TABLE payout_plans ADD COLUMN next_payout_datetime timestamptz;
    
    -- Migrate existing data by combining date with payout_time
    UPDATE payout_plans 
    SET next_payout_datetime = (next_payout_date + payout_time)::timestamptz
    WHERE next_payout_date IS NOT NULL;
    
    -- Drop the old column and rename the new one
    ALTER TABLE payout_plans DROP COLUMN next_payout_date;
    ALTER TABLE payout_plans RENAME COLUMN next_payout_datetime TO next_payout_date;
    
    -- Recreate the triggers after column update
    CREATE TRIGGER trigger_auto_process_payout
      AFTER UPDATE OF next_payout_date ON payout_plans
      FOR EACH ROW
      EXECUTE FUNCTION trigger_process_due_payout();
    
    CREATE TRIGGER trigger_auto_process_payout_insert
      AFTER INSERT ON payout_plans
      FOR EACH ROW
      EXECUTE FUNCTION trigger_process_due_payout();
  END IF;
END $$;

-- Add comment to explain the updated field
COMMENT ON COLUMN payout_plans.next_payout_date IS 'Exact date and time when the next payout should be executed';

-- Update the calculate_next_payout_date function to handle time scheduling
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_frequency text,
  p_start_date date,
  p_payout_time time,
  p_completed_payouts integer
) RETURNS timestamptz AS $$
DECLARE
  v_next_date date;
  v_next_datetime timestamptz;
BEGIN
  -- Calculate the next date based on frequency
  CASE p_frequency
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN NULL;
  END CASE;
  
  -- Combine the date with the payout time
  v_next_datetime := (v_next_date + p_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$ LANGUAGE plpgsql;

-- Update the update_payout_plan_progress function to handle time scheduling
CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
RETURNS void AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_datetime timestamptz;
BEGIN
  -- Get the plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Calculate next payout datetime
  IF v_plan.frequency = 'custom' THEN
    -- For custom frequency, get the next date from custom_payout_dates
    SELECT (payout_date + v_plan.payout_time)::timestamptz INTO v_next_datetime
    FROM custom_payout_dates
    WHERE payout_plan_id = p_plan_id
    AND payout_date > CURRENT_DATE
    ORDER BY payout_date
    LIMIT 1;
  ELSE
    v_next_datetime := calculate_next_payout_date(
      v_plan.frequency,
      v_plan.start_date,
      v_plan.payout_time,
      v_plan.completed_payouts + 1
    );
  END IF;
  
  -- Update the plan
  UPDATE payout_plans
  SET 
    next_payout_date = v_next_datetime,
    status = CASE
      WHEN completed_payouts >= duration THEN 'completed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql;

-- Update the process_payout function to handle exact time scheduling
CREATE OR REPLACE FUNCTION process_payout(p_plan_id uuid)
RETURNS void AS $$
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
  
  -- Check if it's time for payout (now includes time comparison)
  IF v_plan.next_payout_date > now() THEN
    RAISE EXCEPTION 'Payout time has not arrived yet';
  END IF;
  
  -- Get bank account details
  SELECT * INTO v_bank_account FROM bank_accounts WHERE id = v_plan.bank_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account not found';
  END IF;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    payout_plan_id,
    bank_account_id,
    amount,
    type,
    status,
    description
  ) VALUES (
    v_plan.user_id,
    p_plan_id,
    v_plan.bank_account_id,
    v_plan.payout_amount,
    'payout',
    'pending',
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
  
  -- Send notification
  INSERT INTO notifications (
    user_id,
    payout_plan_id,
    type,
    title,
    message
  ) VALUES (
    v_plan.user_id,
    p_plan_id,
    'payout_completed',
    'Payout Completed',
    format('₦%s has been sent to your %s account', v_plan.payout_amount::text, v_bank_account.bank_name)
  );
END;
$$ LANGUAGE plpgsql;

-- Update the trigger function to handle time scheduling
CREATE OR REPLACE FUNCTION trigger_process_due_payout()
RETURNS trigger AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
BEGIN
  -- Get the updated plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = NEW.id;
  
  -- Check if the payout datetime has arrived (now includes time)
  IF NEW.next_payout_date <= now() AND NEW.status = 'active' THEN
    -- Trigger the automated payout processing function
    PERFORM net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object('plan_id', NEW.id)::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance with time-based queries
CREATE INDEX IF NOT EXISTS idx_payout_plans_next_payout_datetime 
ON payout_plans(next_payout_date) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payout_plans_payout_time 
ON payout_plans(payout_time);

-- Add a function to get payouts due at a specific time
CREATE OR REPLACE FUNCTION get_payouts_due_now()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  bank_account_id uuid,
  payout_time time
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id,
    pp.user_id,
    pp.name,
    pp.payout_amount,
    pp.bank_account_id,
    pp.payout_time
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date <= now()
    AND pp.next_payout_date > now() - INTERVAL '1 minute'; -- Within the last minute
END;
$$ LANGUAGE plpgsql;

-- Add a function to schedule payouts for a specific time
CREATE OR REPLACE FUNCTION schedule_payout_for_time(
  p_plan_id uuid,
  p_payout_time time
) RETURNS void AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
BEGIN
  -- Get the plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Update the payout time
  UPDATE payout_plans
  SET 
    payout_time = p_payout_time,
    updated_at = now()
  WHERE id = p_plan_id;
  
  -- Recalculate the next payout date with the new time
  PERFORM update_payout_plan_progress(p_plan_id);
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the new functionality
COMMENT ON FUNCTION get_payouts_due_now() IS 'Returns all payout plans that are due for execution at the current time';
COMMENT ON FUNCTION schedule_payout_for_time(uuid, time) IS 'Updates a payout plan to execute at a specific time of day';
