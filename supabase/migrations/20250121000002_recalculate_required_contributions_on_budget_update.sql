/*
  # Recalculate Required Contributions on Budget Update
  
  This migration creates a trigger that automatically recalculates
  required_per_cycle and required_per_day when:
  - total_budget changes
  - start_date changes
  - end_date changes
  - payout_schedule changes
  
  The calculation is based on:
  - Remaining amount needed (total_budget - current_balance)
  - Days/cycles remaining until end_date
  - Payout schedule (daily, weekly, biweekly, monthly)
*/

-- Function to calculate days between two dates
CREATE OR REPLACE FUNCTION get_days_between(start_date date, end_date date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- date - date returns integer (number of days) directly in PostgreSQL
  RETURN GREATEST(1, end_date - start_date);
END;
$$;

-- Function to calculate cycles until deadline based on schedule
CREATE OR REPLACE FUNCTION get_cycles_until_deadline(
  start_date date,
  end_date date,
  schedule text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  days_remaining integer;
BEGIN
  IF start_date IS NULL OR end_date IS NULL OR schedule IS NULL THEN
    RETURN 1;
  END IF;
  
  days_remaining := get_days_between(start_date, end_date);
  
  CASE schedule
    WHEN 'daily' THEN
      RETURN GREATEST(1, days_remaining);
    WHEN 'weekly' THEN
      RETURN GREATEST(1, CEIL(days_remaining::numeric / 7));
    WHEN 'biweekly' THEN
      RETURN GREATEST(1, CEIL(days_remaining::numeric / 14));
    WHEN 'monthly' THEN
      RETURN GREATEST(1, CEIL(days_remaining::numeric / 30));
    ELSE
      RETURN GREATEST(1, CEIL(days_remaining::numeric / 7)); -- Default to weekly
  END CASE;
END;
$$;

-- Function to recalculate required contributions
CREATE OR REPLACE FUNCTION recalculate_required_contributions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_budget numeric;
  v_current_balance numeric;
  v_start_date date;
  v_end_date date;
  v_payout_schedule text;
  v_remaining_amount numeric;
  v_days_remaining integer;
  v_cycles_remaining integer;
  v_required_per_cycle numeric;
  v_required_per_day numeric;
  v_today date;
BEGIN
  -- Get values from NEW record
  v_total_budget := COALESCE(NEW.total_budget, 0);
  v_current_balance := COALESCE(NEW.current_balance, 0);
  v_start_date := NEW.start_date;
  v_end_date := NEW.end_date;
  v_payout_schedule := COALESCE(NEW.payout_schedule, 'weekly');
  v_today := CURRENT_DATE;
  
  -- Only recalculate if we have all required fields
  IF v_total_budget > 0 AND v_start_date IS NOT NULL AND v_end_date IS NOT NULL THEN
    -- Use today as effective start date if start date is in the past
    IF v_start_date < v_today THEN
      v_start_date := v_today;
    END IF;
    
    -- Calculate remaining amount
    v_remaining_amount := GREATEST(0, v_total_budget - v_current_balance);
    
    -- Calculate days and cycles remaining
    v_days_remaining := get_days_between(v_start_date, v_end_date);
    v_cycles_remaining := get_cycles_until_deadline(v_start_date, v_end_date, v_payout_schedule);
    
    -- Calculate required per cycle and per day
    IF v_cycles_remaining > 0 THEN
      v_required_per_cycle := ROUND((v_remaining_amount / v_cycles_remaining)::numeric, 2);
    ELSE
      v_required_per_cycle := 0;
    END IF;
    
    IF v_days_remaining > 0 THEN
      v_required_per_day := ROUND((v_remaining_amount / v_days_remaining)::numeric, 2);
    ELSE
      v_required_per_day := 0;
    END IF;
    
    -- Update the NEW record with calculated values
    NEW.required_per_cycle := v_required_per_cycle;
    NEW.required_per_day := v_required_per_day;
  ELSE
    -- If we don't have all required fields, set to 0
    NEW.required_per_cycle := 0;
    NEW.required_per_day := 0;
  END IF;
  
  -- Always update the updated_at timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_recalculate_required_contributions ON budget_plans;

-- Create trigger on budget_plans table
CREATE TRIGGER trigger_recalculate_required_contributions
  BEFORE UPDATE ON budget_plans
  FOR EACH ROW
  WHEN (
    OLD.total_budget IS DISTINCT FROM NEW.total_budget OR
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.end_date IS DISTINCT FROM NEW.end_date OR
    OLD.payout_schedule IS DISTINCT FROM NEW.payout_schedule OR
    OLD.current_balance IS DISTINCT FROM NEW.current_balance
  )
  EXECUTE FUNCTION recalculate_required_contributions();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_days_between TO authenticated;
GRANT EXECUTE ON FUNCTION get_cycles_until_deadline TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_required_contributions TO authenticated;

-- Add comments
COMMENT ON FUNCTION recalculate_required_contributions IS 'Automatically recalculates required_per_cycle and required_per_day when budget fields are updated';
COMMENT ON FUNCTION get_days_between IS 'Calculates the number of days between two dates';
COMMENT ON FUNCTION get_cycles_until_deadline IS 'Calculates the number of payout cycles until deadline based on schedule';

