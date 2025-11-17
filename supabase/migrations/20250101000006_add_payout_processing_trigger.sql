/*
  # Add payout processing trigger
  
  This migration creates a trigger that automatically processes payouts
  when the next_payout_date arrives, ensuring immediate processing.
*/

-- Function to trigger payout processing when date becomes due
CREATE OR REPLACE FUNCTION trigger_process_due_payout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the payout date has arrived
  IF NEW.next_payout_date <= CURRENT_DATE AND NEW.status = 'active' THEN
    -- Trigger the automated payout processing function
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/process-automated-payouts',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically process payouts when they become due
DROP TRIGGER IF EXISTS trigger_auto_process_payout ON payout_plans;
CREATE TRIGGER trigger_auto_process_payout
  AFTER UPDATE OF next_payout_date ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout();

-- Also trigger on insert for new plans
DROP TRIGGER IF EXISTS trigger_auto_process_payout_insert ON payout_plans;
CREATE TRIGGER trigger_auto_process_payout_insert
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout(); 