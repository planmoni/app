/*
  # Add Payout Recovery Functions and Improved Trigger Logic
  
  This migration adds functions to:
  1. Detect overdue payouts
  2. Record them in the overdue_payouts table
  3. Recover and reprocess missed payouts
  4. Improve trigger logic to handle edge cases
*/

-- Function to detect and record overdue payouts
CREATE OR REPLACE FUNCTION detect_overdue_payouts()
RETURNS TABLE(
  overdue_count integer,
  recorded_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_overdue_count integer := 0;
  v_recorded_count integer := 0;
BEGIN
  -- Find active payout plans with next_payout_date in the past
  -- that don't have a corresponding automated_payout record
  INSERT INTO overdue_payouts (
    payout_plan_id,
    user_id,
    expected_payout_date,
    amount,
    status,
    reason,
    investigation_notes
  )
  SELECT 
    pp.id,
    pp.user_id,
    pp.next_payout_date,
    pp.payout_amount,
    'detected',
    'Payout due date passed without processing',
    format('Plan: %s, Expected: %s, Current time: %s', 
           pp.name, 
           pp.next_payout_date, 
           now())
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= now()
    AND pp.completed_payouts < pp.duration
    AND NOT EXISTS (
      -- Check if there's an automated_payout record for this date
      SELECT 1 FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.scheduled_date = pp.next_payout_date::date
        AND ap.status IN ('pending', 'processing', 'completed')
    )
    AND NOT EXISTS (
      -- Check if we've already recorded this as overdue
      SELECT 1 FROM overdue_payouts op
      WHERE op.payout_plan_id = pp.id
        AND op.expected_payout_date = pp.next_payout_date
        AND op.status IN ('detected', 'investigating', 'reprocessing')
    )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_recorded_count = ROW_COUNT;
  
  -- Count total overdue payouts
  SELECT COUNT(*) INTO v_overdue_count
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date <= now()
    AND pp.completed_payouts < pp.duration
    AND NOT EXISTS (
      SELECT 1 FROM automated_payouts ap
      WHERE ap.payout_plan_id = pp.id
        AND ap.scheduled_date = pp.next_payout_date::date
        AND ap.status IN ('pending', 'processing', 'completed')
    );
  
  RETURN QUERY SELECT v_overdue_count, v_recorded_count;
END;
$$;

-- Function to recover a specific overdue payout
CREATE OR REPLACE FUNCTION recover_overdue_payout(p_overdue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_overdue overdue_payouts%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Get the overdue payout record
  SELECT * INTO v_overdue
  FROM overdue_payouts
  WHERE id = p_overdue_id
    AND status IN ('detected', 'investigating', 'reprocessing');
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Overdue payout not found or already processed'
    );
  END IF;
  
  -- Update status to reprocessing
  UPDATE overdue_payouts
  SET 
    status = 'reprocessing',
    recovery_attempts = recovery_attempts + 1,
    last_recovery_attempt = now(),
    updated_at = now()
  WHERE id = p_overdue_id;
  
  -- Trigger the payout processing function via HTTP
  -- Note: This is a best-effort attempt. The actual processing
  -- will be handled by the edge function
  PERFORM net.http_post(
    url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    )::jsonb,
    body := json_build_object('plan_id', v_overdue.payout_plan_id)::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'overdue_id', p_overdue_id,
    'plan_id', v_overdue.payout_plan_id,
    'recovery_attempts', v_overdue.recovery_attempts + 1,
    'message', 'Recovery attempt initiated'
  );
END;
$$;

-- Function to recover all overdue payouts
CREATE OR REPLACE FUNCTION recover_all_overdue_payouts()
RETURNS TABLE(
  total_overdue integer,
  recovery_attempts integer,
  results jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer := 0;
  v_attempts integer := 0;
  v_result jsonb := '[]'::jsonb;
  v_overdue_record overdue_payouts%ROWTYPE;
  v_recovery_result jsonb;
BEGIN
  -- First, detect any new overdue payouts
  PERFORM detect_overdue_payouts();
  
  -- Get all overdue payouts that need recovery
  FOR v_overdue_record IN
    SELECT * FROM overdue_payouts
    WHERE status IN ('detected', 'investigating', 'reprocessing')
      AND (last_recovery_attempt IS NULL 
           OR last_recovery_attempt < now() - INTERVAL '5 minutes') -- Don't retry too frequently
    ORDER BY expected_payout_date ASC
    LIMIT 50 -- Process in batches
  LOOP
    v_total := v_total + 1;
    
    -- Attempt recovery
    SELECT recover_overdue_payout(v_overdue_record.id) INTO v_recovery_result;
    
    v_attempts := v_attempts + 1;
    v_result := v_result || jsonb_build_array(v_recovery_result);
  END LOOP;
  
  RETURN QUERY SELECT v_total, v_attempts, v_result;
END;
$$;

-- Improved trigger function that handles overdue payouts
CREATE OR REPLACE FUNCTION trigger_process_due_payout_improved()
RETURNS trigger AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_is_overdue boolean := false;
BEGIN
  -- Get the updated plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = NEW.id;
  
  -- Check if the payout datetime has arrived (now includes time)
  IF NEW.next_payout_date <= now() AND NEW.status = 'active' THEN
    -- Check if this is overdue (more than 1 minute past due)
    IF NEW.next_payout_date < now() - INTERVAL '1 minute' THEN
      v_is_overdue := true;
      
      -- Record as overdue if not already recorded
      INSERT INTO overdue_payouts (
        payout_plan_id,
        user_id,
        expected_payout_date,
        amount,
        status,
        reason,
        investigation_notes
      )
      VALUES (
        NEW.id,
        NEW.user_id,
        NEW.next_payout_date,
        NEW.payout_amount,
        'detected',
        'Trigger detected overdue payout',
        format('Trigger fired at %s for payout due at %s', now(), NEW.next_payout_date)
      )
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Trigger the automated payout processing function
    PERFORM net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      )::jsonb,
      body := json_build_object('plan_id', NEW.id)::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a periodic function to detect overdue payouts (runs every 5 minutes)
-- This serves as a backup to catch any payouts that the trigger might miss
CREATE OR REPLACE FUNCTION periodic_overdue_payout_detection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Detect and record overdue payouts
  PERFORM detect_overdue_payouts();
  
  -- Attempt to recover overdue payouts that are more than 5 minutes old
  PERFORM recover_all_overdue_payouts();
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION detect_overdue_payouts() TO service_role;
GRANT EXECUTE ON FUNCTION recover_overdue_payout(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION recover_all_overdue_payouts() TO service_role;
GRANT EXECUTE ON FUNCTION periodic_overdue_payout_detection() TO service_role;

-- Function to check for missing automated_payout records
CREATE OR REPLACE FUNCTION check_missing_automated_payouts(check_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  payout_plan_id uuid,
  user_id uuid,
  plan_name text,
  expected_date date,
  payout_amount numeric,
  has_automated_payout boolean,
  automated_payout_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id as payout_plan_id,
    pp.user_id,
    pp.name as plan_name,
    pp.next_payout_date::date as expected_date,
    pp.payout_amount,
    CASE 
      WHEN ap.id IS NOT NULL THEN true 
      ELSE false 
    END as has_automated_payout,
    COALESCE(ap.status, 'missing') as automated_payout_status
  FROM payout_plans pp
  LEFT JOIN automated_payouts ap ON (
    ap.payout_plan_id = pp.id 
    AND ap.scheduled_date = pp.next_payout_date::date
  )
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND pp.next_payout_date::date <= check_date
    AND pp.completed_payouts < pp.duration
  ORDER BY pp.next_payout_date ASC;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_missing_automated_payouts(date) TO service_role;
GRANT EXECUTE ON FUNCTION check_missing_automated_payouts(date) TO authenticated;

-- Add comments
COMMENT ON FUNCTION detect_overdue_payouts() IS 'Detects and records payout plans that are overdue';
COMMENT ON FUNCTION recover_overdue_payout(uuid) IS 'Attempts to recover a specific overdue payout';
COMMENT ON FUNCTION recover_all_overdue_payouts() IS 'Attempts to recover all overdue payouts';
COMMENT ON FUNCTION trigger_process_due_payout_improved() IS 'Improved trigger function that handles overdue payouts and records them';
COMMENT ON FUNCTION periodic_overdue_payout_detection() IS 'Periodic function to detect and recover overdue payouts (should be called by cron)';
COMMENT ON FUNCTION check_missing_automated_payouts(date) IS 'Checks for payout plans that should have automated_payout records but dont';

