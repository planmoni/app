/*
  # Fix Payout Plan Progress Function
  
  Issue: The update_payout_plan_progress function doesn't increment completed_payouts,
  causing payout plans to never complete and completed_payouts to remain stale.
  
  Solution: Update the function to properly increment completed_payouts and 
  handle status transitions atomically.
*/

-- Fixed function to update payout plan progress and increment completed payouts
CREATE OR REPLACE FUNCTION update_payout_plan_progress(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_next_date date;
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
    ELSE
      v_next_date := calculate_next_payout_date(
        v_plan.start_date,
        v_plan.frequency,
        v_new_completed_count
      );
    END IF;
  END IF;
  
  -- Update the plan atomically
  UPDATE payout_plans
  SET 
    completed_payouts = v_new_completed_count,
    next_payout_date = v_next_date,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_plan_id;
  
END;
$$;

-- Also create a separate function for just incrementing without recalculating dates
-- This can be useful for manual corrections or bulk operations
CREATE OR REPLACE FUNCTION increment_payout_plan_completed(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_new_completed_count integer;
  v_new_status text;
BEGIN
  -- Get the plan details with row lock
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout plan not found');
  END IF;
  
  -- Check if plan is already completed
  IF v_plan.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan is already completed');
  END IF;
  
  -- Calculate new completed count
  v_new_completed_count := v_plan.completed_payouts + 1;
  
  -- Determine new status
  IF v_new_completed_count >= v_plan.duration THEN
    v_new_status := 'completed';
  ELSE
    v_new_status := v_plan.status;
  END IF;
  
  -- Update just the counter and status
  UPDATE payout_plans
  SET 
    completed_payouts = v_new_completed_count,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_plan_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'plan_id', p_plan_id,
    'completed_payouts', v_new_completed_count,
    'total_duration', v_plan.duration,
    'status', v_new_status,
    'is_completed', v_new_status = 'completed'
  );
END;
$$;

-- Function to fix existing plans with incorrect completed_payouts
-- This can be run as a data migration to correct any existing inconsistencies
CREATE OR REPLACE FUNCTION fix_payout_plan_counters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixed_count integer := 0;
  v_completed_count integer := 0;
  v_plan RECORD;
  v_actual_completed integer;
BEGIN
  -- Iterate through all active and completed plans
  FOR v_plan IN 
    SELECT pp.*, 
           COALESCE(
             (SELECT COUNT(*) 
              FROM automated_payouts ap 
              WHERE ap.payout_plan_id = pp.id 
                AND ap.status = 'completed'), 
             0
           ) as actual_completed_payouts
    FROM payout_plans pp
    WHERE pp.status IN ('active', 'completed')
  LOOP
    -- Check if completed_payouts matches actual completed payouts
    IF v_plan.completed_payouts != v_plan.actual_completed_payouts THEN
      
      -- Update the plan with correct values
      UPDATE payout_plans
      SET 
        completed_payouts = v_plan.actual_completed_payouts,
        status = CASE 
          WHEN v_plan.actual_completed_payouts >= duration THEN 'completed'
          ELSE 'active'
        END,
        updated_at = now()
      WHERE id = v_plan.id;
      
      v_fixed_count := v_fixed_count + 1;
      
      IF v_plan.actual_completed_payouts >= v_plan.duration THEN
        v_completed_count := v_completed_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'plans_fixed', v_fixed_count,
    'plans_completed', v_completed_count,
    'message', format('Fixed %s payout plans, marked %s as completed', v_fixed_count, v_completed_count)
  );
END;
$$;
