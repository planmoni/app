/*
  # Add New Payout Frequencies
  
  1. Changes
    - Add new frequency options to payout_plans table
    - Add day_of_week column to payout_plans table
    - Update functions to handle new frequency types
  
  2. Rationale
    - Allow users to create more flexible payout schedules
    - Support specific days of the week, end of month, quarterly, and bi-annual payouts
*/

-- Update the frequency check constraint to include new options
ALTER TABLE payout_plans 
DROP CONSTRAINT IF EXISTS payout_plans_frequency_check;

ALTER TABLE payout_plans 
ADD CONSTRAINT payout_plans_frequency_check 
CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom', 'weekly_specific', 'end_of_month', 'quarterly', 'biannual'));

-- Add day_of_week column to payout_plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE payout_plans ADD COLUMN day_of_week integer;
  END IF;
END $$;

-- Update the calculate_next_payout_date function to handle new frequency types
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer,
  p_day_of_week integer DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date date;
  v_current_date date := CURRENT_DATE;
  v_month integer;
  v_year integer;
  v_last_day date;
  v_quarter_months integer[];
BEGIN
  CASE p_frequency
    WHEN 'weekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
      
    WHEN 'weekly_specific' THEN
      -- If day_of_week is specified, calculate the next occurrence of that day
      IF p_day_of_week IS NOT NULL THEN
        -- Start with current date
        v_next_date := v_current_date;
        
        -- Move to the next occurrence of the specified day of week
        WHILE EXTRACT(DOW FROM v_next_date) != p_day_of_week LOOP
          v_next_date := v_next_date + INTERVAL '1 day';
        END LOOP;
        
        -- If we're calculating for a future payout (not the first one)
        IF p_completed_payouts > 0 THEN
          -- Add the appropriate number of weeks
          v_next_date := v_next_date + ((p_completed_payouts) * INTERVAL '1 week');
        END IF;
        
        RETURN v_next_date;
      ELSE
        -- Fallback to regular weekly if day_of_week is not specified
        RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
      END IF;
      
    WHEN 'biweekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
      
    WHEN 'monthly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 month');
      
    WHEN 'end_of_month' THEN
      -- Calculate the end of the current month plus the number of completed payouts
      v_month := EXTRACT(MONTH FROM v_current_date) + p_completed_payouts;
      v_year := EXTRACT(YEAR FROM v_current_date) + FLOOR(v_month / 12);
      v_month := v_month % 12;
      IF v_month = 0 THEN
        v_month := 12;
        v_year := v_year - 1;
      END IF;
      
      -- Get the last day of the calculated month
      v_last_day := (DATE_TRUNC('month', MAKE_DATE(v_year::integer, v_month::integer, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      
      RETURN v_last_day;
      
    WHEN 'quarterly' THEN
      -- Calculate the next quarter date
      v_quarter_months := ARRAY[3, 6, 9, 12];
      v_month := EXTRACT(MONTH FROM v_current_date);
      v_year := EXTRACT(YEAR FROM v_current_date);
      
      -- Find the next quarter month
      FOR i IN 1..4 LOOP
        IF v_quarter_months[i] > v_month THEN
          v_month := v_quarter_months[i];
          EXIT;
        END IF;
        
        -- If we've checked all quarters and none are greater, move to next year's first quarter
        IF i = 4 THEN
          v_month := v_quarter_months[1];
          v_year := v_year + 1;
        END IF;
      END LOOP;
      
      -- Add additional quarters based on completed payouts
      v_year := v_year + FLOOR(p_completed_payouts / 4);
      v_month := v_quarter_months[1 + (p_completed_payouts % 4)];
      IF v_month IS NULL THEN
        v_month := v_quarter_months[1];
        v_year := v_year + 1;
      END IF;
      
      RETURN MAKE_DATE(v_year::integer, v_month::integer, 1);
      
    WHEN 'biannual' THEN
      -- Calculate the next biannual date (every 6 months)
      v_month := EXTRACT(MONTH FROM v_current_date);
      v_year := EXTRACT(YEAR FROM v_current_date);
      
      -- Find the next biannual month (either June or December)
      IF v_month < 6 THEN
        v_month := 6;
      ELSIF v_month < 12 THEN
        v_month := 12;
      ELSE
        v_month := 6;
        v_year := v_year + 1;
      END IF;
      
      -- Add additional periods based on completed payouts
      v_year := v_year + FLOOR(p_completed_payouts / 2);
      IF p_completed_payouts % 2 = 1 THEN
        v_month := v_month = 6 ? 12 : 6;
        IF v_month = 6 THEN
          v_year := v_year + 1;
        END IF;
      END IF;
      
      RETURN MAKE_DATE(v_year::integer, v_month::integer, 1);
      
    WHEN 'custom' THEN
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN p_start_date;
      
    ELSE
      -- Default fallback
      RETURN p_start_date;
  END CASE;
END;
$$;

-- Update the trigger_update_next_payout_date function to handle new frequency types
CREATE OR REPLACE FUNCTION trigger_update_next_payout_date()
RETURNS TRIGGER AS $$
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
    -- For regular frequencies, calculate based on the frequency and day_of_week if applicable
    v_next_date := calculate_next_payout_date(
      NEW.start_date,
      NEW.frequency,
      0,  -- 0 completed payouts for a new plan
      NEW.day_of_week
    );
  END IF;
  
  -- Update the next_payout_date
  UPDATE payout_plans
  SET next_payout_date = v_next_date
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Update the update_payout_plan_progress function to handle new frequency types
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
    -- For regular frequencies, calculate based on the frequency and day_of_week if applicable
    v_next_date := calculate_next_payout_date(
      v_plan.start_date,
      v_plan.frequency,
      v_plan.completed_payouts,
      v_plan.day_of_week
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

-- Create a function to get the name of a day of the week
CREATE OR REPLACE FUNCTION get_day_name(p_day_of_week integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE p_day_of_week
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    ELSE 'Unknown'
  END;
END;
$$;