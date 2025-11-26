/*
  # Trigger notifications on payout_completed events
  
  This migration creates a database trigger that automatically creates notifications
  and sends push notifications when payout_completed events are inserted into the events table.
  
  This ensures that users receive push notifications when payouts are successfully sent to their bank.
  
  1. Trigger Function
    - Checks if event type is 'payout_completed'
    - Checks if notification already exists (to avoid duplicates)
    - Creates notification record
    - Calls send_push_notification() to queue push notification
  
  2. Trigger
    - Fires AFTER INSERT on events table
    - Only processes payout_completed events
*/

-- Create function to handle payout_completed events and create notifications
CREATE OR REPLACE FUNCTION create_notification_on_payout_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_exists boolean;
  v_notification_id uuid;
  v_amount numeric;
  v_route text := '/(tabs)/';
  v_payout_plan_name text;
  v_amount_match text[];
BEGIN
  -- Only process payout_completed events
  IF NEW.type != 'payout_completed' THEN
    RETURN NEW;
  END IF;
  
  -- Check if notification already exists for this event
  -- Check by eventId in data field, transaction_id, or by title+description within last minute (for emergency withdrawals)
  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id
    AND (
      (data->>'eventId')::uuid = NEW.id
      OR (NEW.transaction_id IS NOT NULL AND (data->>'transactionId')::uuid = NEW.transaction_id)
      OR (
        -- For emergency withdrawals, check by title and description match within last minute
        title = NEW.title
        AND message = NEW.description
        AND created_at > NOW() - INTERVAL '1 minute'
      )
    )
    AND type = 'transaction'
  ) INTO v_notification_exists;
  
  -- Skip if notification already exists
  IF v_notification_exists THEN
    RAISE LOG 'Notification already exists for event %, skipping', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Extract amount from description if available (format: "₦X has been sent...")
  -- Try to extract numeric value from description
  IF NEW.description IS NOT NULL THEN
    -- Extract amount from description like "₦500.00 has been sent to your..."
    -- or "Your payout of ₦500.00 from..."
    v_amount_match := regexp_match(NEW.description, '₦([0-9,]+\.?[0-9]*)');
    IF v_amount_match IS NOT NULL AND array_length(v_amount_match, 1) > 1 THEN
      -- Remove commas and convert to numeric
      v_amount := replace(v_amount_match[1], ',', '')::numeric;
    END IF;
  END IF;
  
  -- Get payout plan name if available
  IF NEW.payout_plan_id IS NOT NULL THEN
    SELECT name INTO v_payout_plan_name
    FROM payout_plans
    WHERE id = NEW.payout_plan_id;
  END IF;
  
  -- Create notification in notifications table
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    data,
    is_read
  ) VALUES (
    NEW.user_id,
    COALESCE(NEW.title, 'Payout Completed'),
    COALESCE(NEW.description, 'Your payout was successfully sent to your bank'),
    'transaction',
    jsonb_build_object(
      'eventId', NEW.id,
      'eventType', NEW.type,
      'transactionId', NEW.transaction_id,
      'payout_plan_id', NEW.payout_plan_id,
      'payout_plan_name', v_payout_plan_name,
      'amount', v_amount,
      'route', v_route
    ),
    false
  ) RETURNING id INTO v_notification_id;
  
  -- Send push notification via database function (works even when app is closed)
  -- The send_push_notification function now has duplicate prevention built-in
  PERFORM send_push_notification(
    NEW.user_id,
    COALESCE(NEW.title, 'Payout Completed'),
    COALESCE(NEW.description, 'Your payout was successfully sent to your bank'),
    jsonb_build_object(
      'type', 'payout_completed',
      'eventId', NEW.id,
      'transactionId', NEW.transaction_id,
      'payout_plan_id', NEW.payout_plan_id,
      'payout_plan_name', v_payout_plan_name,
      'amount', v_amount,
      'route', v_route
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the event insertion
    RAISE LOG 'Error in create_notification_on_payout_event for event %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_notification_on_payout_event ON events;

-- Create trigger on events table
CREATE TRIGGER trigger_create_notification_on_payout_event
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.type = 'payout_completed')
  EXECUTE FUNCTION create_notification_on_payout_event();

-- Add comment explaining the trigger
COMMENT ON FUNCTION create_notification_on_payout_event() IS 
'Automatically creates notifications and queues push notifications when payout_completed events are inserted. 
This ensures users receive push notifications when payouts are successfully sent to their bank accounts.';

