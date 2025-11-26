/*
  # Disable server-side push notifications for non-deposit/payout events
  
  This migration updates the old trigger to skip ALL events, since:
  - deposit_successful events are handled by trigger_create_notification_on_deposit_event
  - payout_completed events are handled by trigger_create_notification_on_payout_event
  - All other events (payout_scheduled, vault_created, etc.) should be client-side only (in-app notifications)
  
  This prevents duplicate push notifications and ensures only deposits and payouts
  trigger server-side push notifications.
*/

-- Update the old trigger to skip ALL events (deposits and payouts have dedicated triggers)
CREATE OR REPLACE FUNCTION trigger_send_push_notification_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip ALL events - deposits and payouts are handled by dedicated triggers
  -- All other events (payout_scheduled, vault_created, etc.) are client-side only (in-app notifications)
  -- This prevents duplicate push notifications
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_send_push_notification_on_event() IS 
'Legacy trigger function - now disabled. 
Deposit and payout events are handled by dedicated triggers (create_notification_on_deposit_event, create_notification_on_payout_event).
All other events are handled client-side as in-app notifications only.';

