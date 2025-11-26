/*
  # Fix duplicate payout_completed notifications
  
  The issue: Two triggers were firing on payout_completed events:
  1. trigger_send_push_on_event_insert (old trigger) - sends push for all events
  2. trigger_create_notification_on_payout_event (new trigger) - creates notification + push
  
  This caused duplicate notifications.
  
  Solution: Update the old trigger to skip payout_completed events (same as deposit_successful)
*/

-- Update the old trigger function to also skip payout_completed events
CREATE OR REPLACE FUNCTION trigger_send_push_notification_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip deposit_successful and payout_completed events - they are handled by dedicated notification triggers
  -- This prevents duplicate push notifications
  IF NEW.type = 'deposit_successful' OR NEW.type = 'payout_completed' THEN
    RETURN NEW;
  END IF;
  
  -- For other event types, send push notification
  PERFORM send_push_notification(
    NEW.user_id,
    NEW.title,
    NEW.description,
    jsonb_build_object(
      'type', NEW.type,
      'eventId', NEW.id,
      'transactionId', NEW.transaction_id,
      'payoutPlanId', NEW.payout_plan_id
    )
  );
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_send_push_notification_on_event() IS 
'Legacy trigger function for sending push notifications on events. 
Skips deposit_successful and payout_completed events as they are handled by dedicated notification triggers.';

