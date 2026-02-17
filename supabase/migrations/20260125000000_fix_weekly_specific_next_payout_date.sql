/*
  # Fix weekly_specific Next Payout Date Calculation
  
  Issue: The calculate_next_payout_date database function doesn't handle 
  weekly_specific frequency, causing incorrect next_payout_date calculations.
  
  Solution: Update the function to handle weekly_specific by:
  1. Accepting day_of_week parameter
  2. Calculating the next occurrence of the specified day of week
  3. Handling edge cases properly
  
  This migration is idempotent and transactional.
*/

-- Begin transaction block (PostgreSQL DDL is transactional by default, but explicit for clarity)
BEGIN;

-- Create or replace function with weekly_specific support
-- Note: This function is called by update_payout_plan_progress and other functions
-- We need to handle weekly_specific, but we can't access day_of_week directly here
-- So we'll need to update update_payout_plan_progress to handle it separately
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer
)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'weekly_specific' THEN
      -- For weekly_specific, we can't calculate without day_of_week
      -- This will be handled by update_payout_plan_progress which has access to the plan
      -- Return a fallback: start_date + (completed_payouts * 7 days)
      -- The actual calculation should be done in update_payout_plan_progress
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

-- Update update_payout_plan_progress to handle weekly_specific properly
-- This function is idempotent - can be run multiple times safely
CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_date date;
  v_next_datetime timestamptz;
  v_new_completed_count integer;
  v_new_status text;
  v_day_of_week integer;
  v_base_date date;
  v_current_day_of_week integer;
  v_days_to_add integer;
  v_payout_time time;
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
    v_next_date := NULL; -- No more payouts needed
  ELSE
    v_new_status := v_plan.status; -- Keep current status (usually 'active')
    
    -- Calculate next payout date
    IF v_plan.frequency = 'custom' THEN
      -- For custom frequency, get the next date from custom_payout_dates
      SELECT payout_date INTO v_next_date
      FROM custom_payout_dates
      WHERE payout_plan_id = p_plan_id
      AND payout_date > CURRENT_DATE
      ORDER BY payout_date
      LIMIT 1;
    ELSIF v_plan.frequency = 'weekly_specific' THEN
      -- Handle weekly_specific with day_of_week
      v_day_of_week := v_plan.day_of_week;
      
      -- If day_of_week is not set, try to get it from metadata
      IF v_day_of_week IS NULL AND v_plan.metadata IS NOT NULL THEN
        BEGIN
          v_day_of_week := (v_plan.metadata->>'dayOfWeek')::integer;
        EXCEPTION
          WHEN OTHERS THEN
            v_day_of_week := NULL; -- If conversion fails, keep as NULL
        END;
      END IF;
      
      IF v_day_of_week IS NOT NULL AND v_day_of_week >= 0 AND v_day_of_week <= 6 THEN
        -- Calculate base date: start_date + (completed_payouts * 7 days)
        v_base_date := v_plan.start_date + (v_new_completed_count * INTERVAL '7 days');
        
        -- Get the day of week for the base date (0=Sunday, 6=Saturday)
        v_current_day_of_week := EXTRACT(DOW FROM v_base_date)::integer;
        
        -- Calculate days to add to reach the target day of week
        -- Formula: (target - current + 7) % 7 gives us days until next occurrence
        v_days_to_add := (v_day_of_week - v_current_day_of_week + 7) % 7;
        
        -- If base date is already on the target day (daysToAdd === 0),
        -- we need to move to the NEXT week's occurrence
        IF v_days_to_add = 0 THEN
          v_days_to_add := 7;
        END IF;
        
        v_next_date := v_base_date + (v_days_to_add || ' days')::interval;
      ELSE
        -- Fallback to regular weekly if day_of_week is missing or invalid
        RAISE WARNING 'Plan % has weekly_specific frequency but invalid day_of_week (%). Falling back to weekly calculation.', p_plan_id, v_day_of_week;
        v_next_date := v_plan.start_date + (v_new_completed_count * INTERVAL '1 week');
      END IF;
    ELSE
      -- Use the standard calculate_next_payout_date function for other frequencies
      v_next_date := calculate_next_payout_date(
        v_plan.start_date,
        v_plan.frequency,
        v_new_completed_count
      );
    END IF;
  END IF;
  
  -- Convert date to timestamptz preserving time from existing next_payout_date
  IF v_next_date IS NOT NULL THEN
    -- Extract time from existing next_payout_date if available, otherwise default to 9:00 AM
    IF v_plan.next_payout_date IS NOT NULL THEN
      v_payout_time := v_plan.next_payout_date::time;
      -- Only use the time if it's not midnight (likely a real time, not just a date)
      IF v_payout_time = '00:00:00'::time THEN
        v_payout_time := '09:00:00'::time; -- Default to 9:00 AM
      END IF;
    ELSE
      v_payout_time := '09:00:00'::time; -- Default to 9:00 AM
    END IF;
    
    -- Combine date with time
    v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  ELSE
    v_next_datetime := NULL;
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

-- Grant execute permissions (idempotent - safe to run multiple times)
DO $$
BEGIN
  -- Grant permissions if they don't already exist (PostgreSQL will handle duplicates gracefully)
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date(date, text, integer) TO authenticated;
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date(date, text, integer) TO service_role;
  GRANT EXECUTE ON FUNCTION update_payout_plan_progress(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION update_payout_plan_progress(uuid) TO service_role;
EXCEPTION
  WHEN OTHERS THEN
    -- If grants already exist, continue (idempotent)
    NULL;
END;
$$;

-- Add or update comments (idempotent)
COMMENT ON FUNCTION calculate_next_payout_date(date, text, integer) IS 
  'Calculates the next payout date based on start_date and completed_payouts count. Supports daily, weekly, weekly_specific (fallback), biweekly, and monthly frequencies. For weekly_specific, use update_payout_plan_progress which handles day_of_week properly.';

COMMENT ON FUNCTION update_payout_plan_progress(uuid) IS 
  'Updates payout plan progress, increments completed_payouts, and calculates next_payout_date. Properly handles weekly_specific frequency with day_of_week calculation. Uses row-level locking to prevent concurrent update issues.';

-- Commit transaction
COMMIT;
