/*
  # Fix Payout Date Calculation Logic
  
  This migration fixes the payout date calculation to ensure that:
  1. The first payout happens on the start_date
  2. Subsequent payouts are calculated correctly from the start_date
  3. The next_payout_date is set to start_date initially so the first payout happens immediately
  
  Changes:
  1. Update calculate_next_payout_date function to handle the new logic
  2. Update trigger functions to set next_payout_date to start_date initially
*/

-- Update the calculate_next_payout_date function to handle the new logic
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer
)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate the next payout date based on start_date and completed_payouts
  -- The first payout (completed_payouts = 0) should happen on start_date
  -- Subsequent payouts are calculated as start_date + (completed_payouts * frequency_interval)
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

-- Update the trigger function to set next_payout_date to start_date initially
CREATE OR REPLACE FUNCTION trigger_update_next_payout_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date date;
BEGIN
  -- For custom frequency, get the first date from custom_payout_dates if available
  IF NEW.frequency = 'custom' THEN
    SELECT MIN(payout_date) INTO v_next_date
    FROM custom_payout_dates
    WHERE payout_plan_id = NEW.id
    AND payout_date >= CURRENT_DATE;
    
    -- If no custom dates are found, use the start date
    IF v_next_date IS NULL THEN
      v_next_date := NEW.start_date;
    END IF;
  ELSE
    -- For regular frequencies, the first payout should happen on start_date
    v_next_date := NEW.start_date;
  END IF;
  
  -- Update the next_payout_date to start_date so the first payout happens immediately
  UPDATE payout_plans
  SET next_payout_date = v_next_date
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Add comment to explain the updated logic
COMMENT ON FUNCTION calculate_next_payout_date IS 'Calculates the next payout date based on start_date and completed_payouts count. The first payout (completed_payouts = 0) happens on start_date.';
COMMENT ON FUNCTION trigger_update_next_payout_date IS 'Sets next_payout_date to start_date initially so the first payout happens immediately when the plan is created.';
