/*
  # Trigger notifications on deposit_successful events
  
  This migration creates a database trigger that automatically creates notifications
  when deposit_successful events are inserted into the events table.
  
  This ensures that even if events are created without notifications (e.g., from other sources),
  notifications will still be created automatically.
  
  1. Trigger Function
    - Checks if event type is 'deposit_successful'
    - Checks if notification already exists (to avoid duplicates)
    - Creates notification record
    - Calls send_push_notification() to queue push notification
  
  2. Trigger
    - Fires AFTER INSERT on events table
    - Only processes deposit_successful events
*/

-- Create function to handle deposit_successful events and create notifications
CREATE OR REPLACE FUNCTION create_notification_on_deposit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_exists boolean;
  v_notification_id uuid;
  v_transaction_reference text;
  v_amount numeric;
  v_route text := '/(tabs)/';
BEGIN
  -- Only process deposit_successful events
  IF NEW.type != 'deposit_successful' THEN
    RETURN NEW;
  END IF;
  
  -- Check if notification already exists for this event
  -- Check by eventId in data field or by transaction_id
  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id
    AND (
      (data->>'eventId')::uuid = NEW.id
      OR (NEW.transaction_id IS NOT NULL AND (data->>'transactionId')::uuid = NEW.transaction_id)
    )
    AND type = 'transaction'
  ) INTO v_notification_exists;
  
  -- Skip if notification already exists
  IF v_notification_exists THEN
    RETURN NEW;
  END IF;
  
  -- Extract transaction reference and amount from metadata if available
  IF NEW.metadata IS NOT NULL THEN
    v_transaction_reference := NEW.metadata->>'transaction_reference';
    IF NEW.metadata->>'amount' IS NOT NULL THEN
      v_amount := (NEW.metadata->>'amount')::numeric;
    END IF;
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
    COALESCE(NEW.title, 'Funds Received'),
    COALESCE(NEW.description, 'Your deposit was successful'),
    'transaction',
    jsonb_build_object(
      'eventId', NEW.id,
      'eventType', NEW.type,
      'transactionId', NEW.transaction_id,
      'transaction_reference', v_transaction_reference,
      'amount', v_amount,
      'route', v_route
    ),
    false
  ) RETURNING id INTO v_notification_id;
  
  -- Send push notification via database function (works even when app is closed)
  PERFORM send_push_notification(
    NEW.user_id,
    COALESCE(NEW.title, 'Funds Received'),
    COALESCE(NEW.description, 'Your deposit was successful'),
    jsonb_build_object(
      'type', 'deposit_successful',
      'eventId', NEW.id,
      'transactionId', NEW.transaction_id,
      'transaction_reference', v_transaction_reference,
      'amount', v_amount,
      'route', v_route
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the event insertion
    RAISE LOG 'Error in create_notification_on_deposit_event for event %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_notification_on_deposit_event ON events;

-- Create trigger on events table
CREATE TRIGGER trigger_create_notification_on_deposit_event
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.type = 'deposit_successful')
  EXECUTE FUNCTION create_notification_on_deposit_event();

-- Add comment explaining the trigger
COMMENT ON FUNCTION create_notification_on_deposit_event() IS 
'Automatically creates notifications and queues push notifications when deposit_successful events are inserted. 
This ensures notifications are created even if events are inserted from sources that don\'t create notifications directly.';

