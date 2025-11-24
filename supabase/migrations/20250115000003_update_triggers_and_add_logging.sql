/*
  # Update Triggers and Add Logging for Payout Processing
  
  This migration:
  1. Updates triggers to use improved logic
  2. Adds audit logging table for payout processing attempts
  3. Creates cron job for periodic overdue payout detection
*/

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS trigger_auto_process_payout ON payout_plans;
DROP TRIGGER IF EXISTS trigger_auto_process_payout_insert ON payout_plans;

-- Create new triggers with improved logic
CREATE TRIGGER trigger_auto_process_payout
  AFTER UPDATE OF next_payout_date ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout_improved();

CREATE TRIGGER trigger_auto_process_payout_insert
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout_improved();

-- Create audit log table for payout processing attempts
CREATE TABLE IF NOT EXISTS payout_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid REFERENCES payout_plans(id) ON DELETE CASCADE,
  automated_payout_id uuid REFERENCES automated_payouts(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('database_trigger', 'cron_job', 'manual', 'recovery')),
  action text NOT NULL CHECK (action IN ('detected', 'processing', 'completed', 'failed', 'skipped')),
  message text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for payout_processing_log
ALTER TABLE payout_processing_log ENABLE ROW LEVEL SECURITY;

-- Create policy for service role to insert logs
CREATE POLICY "Service role can insert payout processing logs"
  ON payout_processing_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policy for users to view their own logs
CREATE POLICY "Users can view own payout processing logs"
  ON payout_processing_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payout_plans pp
      WHERE pp.id = payout_processing_log.payout_plan_id
        AND pp.user_id = auth.uid()
    )
  );

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payout_processing_log_plan 
ON payout_processing_log(payout_plan_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payout_processing_log_trigger 
ON payout_processing_log(trigger_type, action, created_at);

CREATE INDEX IF NOT EXISTS idx_payout_processing_log_date 
ON payout_processing_log(created_at DESC);

-- Function to log payout processing attempts
CREATE OR REPLACE FUNCTION log_payout_processing(
  p_payout_plan_id uuid,
  p_automated_payout_id uuid DEFAULT NULL,
  p_trigger_type text,
  p_action text,
  p_message text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO payout_processing_log (
    payout_plan_id,
    automated_payout_id,
    trigger_type,
    action,
    message,
    error_message,
    metadata
  )
  VALUES (
    p_payout_plan_id,
    p_automated_payout_id,
    p_trigger_type,
    p_action,
    p_message,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Update the improved trigger to add logging
CREATE OR REPLACE FUNCTION trigger_process_due_payout_improved()
RETURNS trigger AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_is_overdue boolean := false;
  v_log_id uuid;
BEGIN
  -- Get the updated plan
  SELECT * INTO v_plan FROM payout_plans WHERE id = NEW.id;
  
  -- Check if the payout datetime has arrived (now includes time)
  IF NEW.next_payout_date <= now() AND NEW.status = 'active' THEN
    -- Log detection
    SELECT log_payout_processing(
      NEW.id,
      NULL,
      'database_trigger',
      'detected',
      format('Payout detected as due. Expected: %s, Current: %s', NEW.next_payout_date, now()),
      NULL,
      jsonb_build_object('next_payout_date', NEW.next_payout_date, 'current_time', now())
    ) INTO v_log_id;
    
    -- Check if this is overdue (more than 1 minute past due)
    IF NEW.next_payout_date < now() - INTERVAL '1 minute' THEN
      v_is_overdue := true;
      
      -- Log overdue detection
      PERFORM log_payout_processing(
        NEW.id,
        NULL,
        'database_trigger',
        'detected',
        format('Overdue payout detected. Expected: %s, Overdue by: %s', 
               NEW.next_payout_date, 
               now() - NEW.next_payout_date),
        NULL,
        jsonb_build_object(
          'is_overdue', true,
          'overdue_duration', extract(epoch from (now() - NEW.next_payout_date))::text || ' seconds'
        )
      );
      
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
    BEGIN
      PERFORM net.http_post(
        url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
        headers := json_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
          'Content-Type', 'application/json'
        )::jsonb,
        body := json_build_object('plan_id', NEW.id)::text
      );
      
      -- Log successful trigger
      PERFORM log_payout_processing(
        NEW.id,
        NULL,
        'database_trigger',
        'processing',
        'Successfully triggered payout processing function',
        NULL,
        jsonb_build_object('is_overdue', v_is_overdue)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log trigger failure
      PERFORM log_payout_processing(
        NEW.id,
        NULL,
        'database_trigger',
        'failed',
        'Failed to trigger payout processing function',
        SQLERRM,
        jsonb_build_object('is_overdue', v_is_overdue, 'error_code', SQLSTATE)
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create cron job for periodic overdue payout detection (every 5 minutes)
-- This serves as a backup to catch any payouts that the trigger might miss
DO $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule if it exists
    PERFORM cron.unschedule('periodic-overdue-payout-detection');
    
    -- Schedule the periodic detection
    PERFORM cron.schedule(
      'periodic-overdue-payout-detection',
      '*/5 * * * *', -- Every 5 minutes
      $$
      SELECT periodic_overdue_payout_detection();
      $$
    );
    
    RAISE NOTICE 'Scheduled periodic overdue payout detection cron job';
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job creation';
  END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_payout_processing TO service_role;
GRANT EXECUTE ON FUNCTION log_payout_processing TO authenticated;

-- Add comments
COMMENT ON TABLE payout_processing_log IS 'Audit log for all payout processing attempts and triggers';
COMMENT ON FUNCTION log_payout_processing IS 'Logs payout processing attempts for audit and debugging';

