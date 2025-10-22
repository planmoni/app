/*
  # Remove Redundant payout_time Column
  
  This migration removes the payout_time column since the time information
  is already included in the next_payout_date timestamptz column.
  
  Changes:
  1. Drop payout_time column
  2. Update functions to extract time from next_payout_date instead
  3. Update any references to use the time component of next_payout_date
*/

-- Step 1: Check if payout_time column exists and drop it
DO $$
BEGIN
  -- Check if payout_time column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' 
    AND column_name = 'payout_time'
  ) THEN
    RAISE NOTICE 'Dropping payout_time column...';
    
    -- Drop the column
    ALTER TABLE payout_plans DROP COLUMN payout_time;
    
    RAISE NOTICE 'Successfully dropped payout_time column';
  ELSE
    RAISE NOTICE 'payout_time column does not exist, skipping drop';
  END IF;
END $$;

-- Step 2: Update the calculate_next_payout_date function to work without payout_time
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

-- Step 3: Create a new version of calculate_next_payout_date that extracts time from existing next_payout_date
CREATE OR REPLACE FUNCTION calculate_next_payout_date_from_existing(
  p_frequency text,
  p_start_date date,
  p_existing_next_payout_date timestamptz,
  p_completed_payouts integer
) RETURNS timestamptz AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
BEGIN
  -- Extract the time component from the existing next_payout_date
  v_payout_time := p_existing_next_payout_date::time;
  
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
  
  -- Combine the date with the extracted time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update the update_payout_plan_progress function to work without payout_time
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
    -- Extract time from existing next_payout_date if it exists
    IF v_plan.next_payout_date IS NOT NULL THEN
      SELECT (payout_date + v_plan.next_payout_date::time)::timestamptz INTO v_next_datetime
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > CURRENT_DATE
      ORDER BY payout_date
      LIMIT 1;
    ELSE
      -- Default to 9:00 AM if no existing time
      SELECT (payout_date + '09:00:00'::time)::timestamptz INTO v_next_datetime
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > CURRENT_DATE
      ORDER BY payout_date
      LIMIT 1;
    END IF;
  ELSE
    -- Use the existing next_payout_date time component
    IF v_plan.next_payout_date IS NOT NULL THEN
      v_next_datetime := calculate_next_payout_date_from_existing(
        v_plan.frequency,
        v_plan.start_date,
        v_plan.next_payout_date,
        v_plan.completed_payouts + 1
      );
    ELSE
      -- Default to 9:00 AM if no existing time
      v_next_datetime := calculate_next_payout_date(
        v_plan.frequency,
        v_plan.start_date,
        '09:00:00'::time,
        v_plan.completed_payouts + 1
      );
    END IF;
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

-- Step 5: Update the get_payouts_due_now function to work without payout_time
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
    pp.next_payout_date::time as payout_time  -- Extract time from next_payout_date
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date <= now()
    AND pp.next_payout_date > now() - INTERVAL '1 minute'; -- Within the last minute
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update the schedule_payout_for_time function to work with next_payout_date
CREATE OR REPLACE FUNCTION schedule_payout_for_time(
  p_plan_id uuid,
  p_payout_time time
) RETURNS void AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_new_datetime timestamptz;
BEGIN
  -- Get the plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Update the next_payout_date with the new time
  -- Keep the same date but change the time
  IF v_plan.next_payout_date IS NOT NULL THEN
    v_new_datetime := (v_plan.next_payout_date::date + p_payout_time)::timestamptz;
  ELSE
    -- If no next_payout_date, use start_date with the new time
    v_new_datetime := (v_plan.start_date + p_payout_time)::timestamptz;
  END IF;
  
  UPDATE payout_plans
  SET 
    next_payout_date = v_new_datetime,
    updated_at = now()
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create a helper function to get payout time from next_payout_date
CREATE OR REPLACE FUNCTION get_payout_time(p_plan_id uuid)
RETURNS time AS $$
DECLARE
  v_payout_time time;
BEGIN
  SELECT next_payout_date::time INTO v_payout_time
  FROM payout_plans
  WHERE id = p_plan_id;
  
  RETURN COALESCE(v_payout_time, '09:00:00'::time); -- Default to 9:00 AM
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create a helper function to set payout time in next_payout_date
CREATE OR REPLACE FUNCTION set_payout_time(
  p_plan_id uuid,
  p_payout_time time
) RETURNS void AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_new_datetime timestamptz;
BEGIN
  -- Get the plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Update the next_payout_date with the new time
  IF v_plan.next_payout_date IS NOT NULL THEN
    v_new_datetime := (v_plan.next_payout_date::date + p_payout_time)::timestamptz;
  ELSE
    -- If no next_payout_date, use start_date with the new time
    v_new_datetime := (v_plan.start_date + p_payout_time)::timestamptz;
  END IF;
  
  UPDATE payout_plans
  SET 
    next_payout_date = v_new_datetime,
    updated_at = now()
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Drop the old payout_time index if it exists
DROP INDEX IF EXISTS idx_payout_plans_payout_time;

-- Step 10: Add comments explaining the updated functionality
COMMENT ON FUNCTION get_payout_time(uuid) IS 'Extracts the time component from next_payout_date for a given plan';
COMMENT ON FUNCTION set_payout_time(uuid, time) IS 'Updates the time component of next_payout_date for a given plan';
COMMENT ON FUNCTION calculate_next_payout_date_from_existing(text, date, timestamptz, integer) IS 'Calculates next payout date preserving the time component from existing next_payout_date';

-- Final verification
DO $$
BEGIN
  RAISE NOTICE 'Payout time column removal completed successfully!';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Removed redundant payout_time column';
  RAISE NOTICE '- Updated all functions to work with next_payout_date timestamptz';
  RAISE NOTICE '- Added helper functions to extract/set time from next_payout_date';
  RAISE NOTICE '- All time information is now stored in next_payout_date column';
END $$;

