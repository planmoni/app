/*
  # Fix payout plan trigger to prevent net.http_post errors
  
  This migration disables the trigger that calls net.http_post with incorrect signature.
  We already have cron jobs processing payouts, so this trigger is redundant.
*/

-- Drop the problematic triggers that use net.http_post
DROP TRIGGER IF EXISTS trigger_auto_process_payout ON payout_plans;
DROP TRIGGER IF EXISTS trigger_auto_process_payout_insert ON payout_plans;

-- Drop the function that uses net.http_post (or recreate it without the http call)
DROP FUNCTION IF EXISTS trigger_process_due_payout();

-- Recreate the function without the net.http_post call
-- This function is kept for backward compatibility but doesn't make HTTP calls
CREATE OR REPLACE FUNCTION trigger_process_due_payout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function is now a no-op since we use cron jobs for payout processing
  -- The trigger is kept for backward compatibility but doesn't execute any HTTP calls
  -- Payouts are processed by the cron job: process-automated-payouts
  RETURN NEW;
END;
$$;

-- Recreate the triggers (they won't do anything now, but won't cause errors)
CREATE TRIGGER trigger_auto_process_payout
  AFTER UPDATE OF next_payout_date ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout();

CREATE TRIGGER trigger_auto_process_payout_insert
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_due_payout();


