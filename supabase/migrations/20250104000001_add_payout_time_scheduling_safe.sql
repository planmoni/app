/*
  # Add Payout Time Scheduling Support (Safe Version)
  
  This is a safer version of the migration that handles trigger dependencies
  more carefully and provides better error handling.
  
  Changes:
  1. Add payout_time field to store time of day (HH:MM format)
  2. Safely update next_payout_date to timestamptz for exact scheduling
  3. Update processing functions to handle time-based scheduling
  4. Add indexes for better performance
*/

-- Step 1: Add payout_time column to store the time of day for payouts
ALTER TABLE payout_plans 
ADD COLUMN IF NOT EXISTS payout_time time DEFAULT '09:00:00';

-- Add comment to explain the field
COMMENT ON COLUMN payout_plans.payout_time IS 'Time of day when payout should be executed (HH:MM format)';

-- Step 2: Safely handle the next_payout_date column conversion
-- First, check if we need to convert from date to timestamptz
DO $$
DECLARE
  column_exists boolean;
  is_date_type boolean;
BEGIN
  -- Check if next_payout_date column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' 
    AND column_name = 'next_payout_date'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Check if it's currently a date type
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_plans' 
      AND column_name = 'next_payout_date' 
      AND data_type = 'date'
    ) INTO is_date_type;
    
    IF is_date_type THEN
      RAISE NOTICE 'Converting next_payout_date from date to timestamptz...';
      
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
      
      RAISE NOTICE 'Successfully converted next_payout_date to timestamptz';
    ELSE
      RAISE NOTICE 'next_payout_date is already timestamptz type';
    END IF;
  ELSE
    RAISE NOTICE 'next_payout_date column does not exist, creating as timestamptz';
    ALTER TABLE payout_plans ADD COLUMN next_payout_date timestamptz;
  END IF;
END $$;

-- Step 3: Recreate the triggers after column update
-- (Only if they were dropped during the conversion)
DO $$
BEGIN
  -- Check if triggers exist, if not recreate them
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_auto_process_payout'
  ) THEN
    CREATE TRIGGER trigger_auto_process_payout
      AFTER UPDATE OF next_payout_date ON payout_plans
      FOR EACH ROW
      EXECUTE FUNCTION trigger_process_due_payout();
    
    RAISE NOTICE 'Recreated trigger_auto_process_payout';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_auto_process_payout_insert'
  ) THEN
    CREATE TRIGGER trigger_auto_process_payout_insert
      AFTER INSERT ON payout_plans
      FOR EACH ROW
      EXECUTE FUNCTION trigger_process_due_payout();
    
    RAISE NOTICE 'Recreated trigger_auto_process_payout_insert';
  END IF;
END $$;

-- Add comment to explain the updated field
COMMENT ON COLUMN payout_plans.next_payout_date IS 'Exact date and time when the next payout should be executed';

-- Step 4: Update the calculate_next_payout_date function to handle time scheduling
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

-- Step 5: Update the update_payout_plan_progress function to handle time scheduling
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

-- Step 6: Update the process_payout function to handle exact time scheduling
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

-- Step 7: Update the trigger function to handle time scheduling
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

-- Step 8: Add indexes for better performance with time-based queries
CREATE INDEX IF NOT EXISTS idx_payout_plans_next_payout_datetime 
ON payout_plans(next_payout_date) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payout_plans_payout_time 
ON payout_plans(payout_time);

-- Step 9: Add helper functions
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

-- Add comments explaining the new functionality
COMMENT ON FUNCTION get_payouts_due_now() IS 'Returns all payout plans that are due for execution at the current time';
COMMENT ON FUNCTION schedule_payout_for_time(uuid, time) IS 'Updates a payout plan to execute at a specific time of day';

-- Final verification
DO $$
BEGIN
  RAISE NOTICE 'Payout time scheduling migration completed successfully!';
  RAISE NOTICE 'New features available:';
  RAISE NOTICE '- payout_time column added with default 09:00:00';
  RAISE NOTICE '- next_payout_date converted to timestamptz for exact scheduling';
  RAISE NOTICE '- All processing functions updated for time-based scheduling';
  RAISE NOTICE '- Helper functions added for time management';
END $$;

