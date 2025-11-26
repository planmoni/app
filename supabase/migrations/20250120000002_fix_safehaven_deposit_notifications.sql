/*
  # Fix SafeHaven deposit notifications
  
  This migration ensures that:
  1. The process_safehaven_deposit function properly creates notifications
  2. RLS policies allow SECURITY DEFINER functions to insert notifications
  3. Better error handling and logging
*/

-- Update process_safehaven_deposit function to ensure notifications are created
CREATE OR REPLACE FUNCTION process_safehaven_deposit(
  arg_user_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_safehaven_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_event_id uuid;
  v_notification_id uuid;
  v_already_processed boolean := false;
  v_sender_name text;
  v_sender_account text;
  v_sender_bank text;
  v_narration text;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Check if transaction already exists
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE reference = arg_reference 
    AND type = 'deposit'
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed'
    );
  END IF;
  
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets 
  WHERE user_id = arg_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', arg_user_id;
  END IF;
  
  -- Extract metadata
  v_sender_name := arg_safehaven_data->>'sender_name';
  v_sender_account := arg_safehaven_data->>'sender_account';
  v_sender_bank := arg_safehaven_data->>'sender_bank';
  v_narration := arg_safehaven_data->>'narration';
  
  -- Calculate new balance
  v_new_balance := v_current_balance + arg_amount;
  
  -- Mark wallet update as allowed (required by prevent_direct_wallet_updates trigger)
  PERFORM allow_wallet_update();
  
  -- Update wallet balance
  UPDATE wallets 
  SET 
    balance = v_new_balance,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    reference,
    description,
    metadata
  ) VALUES (
    arg_user_id,
    'deposit',
    arg_amount,
    'completed',
    'SafeHaven',
    'wallet',
    arg_reference,
    COALESCE(v_narration || ' - From ' || v_sender_name, 'Funds added to wallet'),
    arg_safehaven_data
  ) RETURNING id INTO v_transaction_id;
  
  -- Prepare notification content
  v_notification_title := 'Funds Received';
  v_notification_message := format('₦%s has been added to your wallet%s', 
    to_char(arg_amount, 'FM999,999,999.00'),
    CASE WHEN v_sender_name IS NOT NULL THEN format(' from %s', v_sender_name) ELSE '' END
  );
  
  -- Create notification event (for notifications page)
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    transaction_id,
    metadata
  ) VALUES (
    arg_user_id,
    'deposit_successful',
    v_notification_title,
    v_notification_message,
    'unread',
    v_transaction_id,
    jsonb_build_object(
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'sender_name', v_sender_name,
      'sender_account', v_sender_account,
      'sender_bank', v_sender_bank,
      'narration', v_narration
    )
  ) RETURNING id INTO v_event_id;
  
  -- Create notification in notifications table (for NotificationCenter and push notifications)
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    data,
    is_read
  ) VALUES (
    arg_user_id,
    v_notification_title,
    v_notification_message,
    'transaction',
    jsonb_build_object(
      'eventId', v_event_id,
      'eventType', 'deposit_successful',
      'transactionId', v_transaction_id,
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'sender_name', v_sender_name,
      'sender_account', v_sender_account,
      'sender_bank', v_sender_bank,
      'route', '/(tabs)/'
    ),
    false
  ) RETURNING id INTO v_notification_id;
  
  -- Send push notification via database function (works even when app is closed)
  PERFORM send_push_notification(
    arg_user_id,
    v_notification_title,
    v_notification_message,
    jsonb_build_object(
      'type', 'deposit_successful',
      'eventId', v_event_id,
      'transactionId', v_transaction_id,
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'sender_name', v_sender_name,
      'sender_account', v_sender_account,
      'sender_bank', v_sender_bank,
      'route', '/(tabs)/'
    )
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'event_id', v_event_id,
    'notification_id', v_notification_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_added', arg_amount,
    'message', 'SafeHaven deposit processed successfully'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Transaction was already processed by another concurrent process
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed by another process'
    );
  WHEN OTHERS THEN
    -- Log the error with more details
    RAISE LOG 'Error in process_safehaven_deposit for user %: %', arg_user_id, SQLERRM;
    RAISE;
END;
$$;

-- Ensure service_role can insert notifications (for SECURITY DEFINER functions)
-- This should already exist from the previous migration, but let's make sure
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications"
  ON notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure service_role can insert events (for SECURITY DEFINER functions)
DROP POLICY IF EXISTS "Service role can insert events" ON events;
CREATE POLICY "Service role can insert events"
  ON events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

