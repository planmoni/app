/*
  # Fix Daily Frequency Support in next_payout_date Calculation
  
  This migration fixes the calculate_next_payout_date function to:
  1. Add support for 'daily' frequency
  2. Preserve the time component when calculating next payout dates
  3. Ensure next_payout_date is correctly updated for daily plans
  
  Changes:
  1. Update calculate_next_payout_date to handle daily frequency
  2. Update update_payout_plan_progress to preserve time component from existing next_payout_date
  3. Ensure all functions work with timestamptz to preserve time
*/

-- First, create a function that calculates next payout date and preserves time
CREATE OR REPLACE FUNCTION calculate_next_payout_date_with_time(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer,
  p_existing_next_payout_date timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
BEGIN
  -- Extract payout time from existing next_payout_date if available, otherwise default to 9:00 AM
  IF p_existing_next_payout_date IS NOT NULL THEN
    v_payout_time := p_existing_next_payout_date::time;
    -- Only use the time if it's not midnight (likely a real time, not just a date)
    IF v_payout_time = '00:00:00'::time THEN
      v_payout_time := '09:00:00'::time;
    END IF;
  ELSE
    v_payout_time := '09:00:00'::time; -- Default to 9:00 AM
  END IF;

  -- Calculate the next payout date based on start_date and completed_payouts count
  -- The first payout (completed_payouts = 0) should happen on start_date
  -- Subsequent payouts are calculated as start_date + (completed_payouts * frequency_interval)
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency or unknown, return start_date with time
      v_next_date := p_start_date;
  END CASE;
  
  -- Combine the date with the payout time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$;

-- Update the existing calculate_next_payout_date function to handle daily frequency
-- Keep it returning date for backward compatibility, but add daily support
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
    WHEN 'daily' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 day');
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

-- Update update_payout_plan_progress to preserve time component
CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_datetime timestamptz;
  v_new_completed_count integer;
  v_new_status text;
BEGIN
  -- Get the plan details with row lock to prevent concurrent updates
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  -- Calculate new completed count (increment by 1)
  v_new_completed_count := v_plan.completed_payouts + 1;
  
  -- Determine new status
  IF v_new_completed_count >= v_plan.duration THEN
    v_new_status := 'completed';
    v_next_datetime := NULL; -- No more payouts needed
  ELSE
    v_new_status := v_plan.status; -- Keep current status (usually 'active')
    
    -- Calculate next payout datetime preserving time component
    IF v_plan.frequency = 'custom' THEN
      -- For custom frequency, get the next date from custom_payout_dates
      SELECT (payout_date + COALESCE(v_plan.next_payout_date::time, '09:00:00'::time))::timestamptz INTO v_next_datetime
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > CURRENT_DATE
      ORDER BY payout_date
      LIMIT 1;
    ELSE
      -- Use the new function that preserves time
      v_next_datetime := calculate_next_payout_date_with_time(
        v_plan.start_date,
        v_plan.frequency,
        v_new_completed_count,
        v_plan.next_payout_date
      );
    END IF;
  END IF;
  
  -- Update the plan atomically
  UPDATE payout_plans
  SET 
    completed_payouts = v_new_completed_count,
    next_payout_date = v_next_datetime,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_plan_id;
  
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_next_payout_date_with_time TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_next_payout_date TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_payout_plan_progress TO authenticated, service_role;

-- Update trigger function to handle timestamptz properly
-- Note: This assumes next_payout_date is already set by the application with time component
-- If not set, we'll set it to start_date at 9:00 AM default
CREATE OR REPLACE FUNCTION trigger_update_next_payout_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_datetime timestamptz;
BEGIN
  -- If next_payout_date is already set (with time), keep it
  IF NEW.next_payout_date IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- For custom frequency, get the first date from custom_payout_dates if available
  IF NEW.frequency = 'custom' THEN
    SELECT MIN((payout_date + '09:00:00'::time)::timestamptz) INTO v_next_datetime
    FROM custom_payout_dates
    WHERE payout_plan_id = NEW.id
    AND payout_date >= CURRENT_DATE;
    
    -- If no custom dates are found, use the start date at 9:00 AM
    IF v_next_datetime IS NULL THEN
      v_next_datetime := (NEW.start_date + '09:00:00'::time)::timestamptz;
    END IF;
  ELSE
    -- For regular frequencies, use start_date at 9:00 AM default
    -- The application should set the correct time when creating the plan
    v_next_datetime := (NEW.start_date + '09:00:00'::time)::timestamptz;
  END IF;
  
  -- Update the next_payout_date
  UPDATE payout_plans
  SET next_payout_date = v_next_datetime
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_update_next_payout_date TO authenticated, service_role;

-- Add comments
COMMENT ON FUNCTION calculate_next_payout_date_with_time IS 'Calculates next payout datetime preserving time component from existing next_payout_date. Supports daily, weekly, biweekly, and monthly frequencies.';
COMMENT ON FUNCTION calculate_next_payout_date IS 'Calculates the next payout date based on start_date and completed_payouts count. Now supports daily frequency. Returns date type for backward compatibility.';
COMMENT ON FUNCTION update_payout_plan_progress IS 'Updates payout plan progress, increments completed_payouts, and calculates next_payout_date preserving time component.';
COMMENT ON FUNCTION trigger_update_next_payout_date IS 'Sets next_payout_date to start_date with default time (9:00 AM) if not already set. Preserves time if next_payout_date is already set by application.';

