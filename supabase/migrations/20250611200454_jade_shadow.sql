/*
  # Add Missing Trigger Function
  
  1. Functions
    - Add trigger_update_next_payout_date function that's referenced by the trigger_payout_plan_next_date trigger
    - This function calculates the next payout date for a newly created payout plan
*/

-- Create or replace the missing trigger function
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
    -- For regular frequencies, calculate based on the frequency
    v_next_date := NEW.start_date;
  END IF;
  
  -- Update the next_payout_date
  UPDATE payout_plans
  SET next_payout_date = v_next_date
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;