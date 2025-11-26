/*
  # Add duplicate prevention to push notifications
  
  This migration adds duplicate prevention to the send_push_notification() function
  to prevent the same notification from being queued multiple times within a short time window.
  
  This fixes issues where emergency withdrawals (and other events) were sending
  multiple push notifications for the same event.
*/

-- Add duplicate prevention to send_push_notification function
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_fcm_token text;
  v_push_settings jsonb;
  v_notification_type text;
  v_should_send boolean := true;
  v_supabase_url text;
  v_queue_id uuid;
  v_request_id bigint;
  v_duplicate_exists boolean;
BEGIN
  -- Get user's push notification settings
  SELECT push_notifications INTO v_push_settings
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Check if push notifications are enabled (default to true if null)
  IF COALESCE(v_push_settings->>'enabled', 'true') = 'false' THEN
    RAISE LOG 'Push notifications disabled for user %', p_user_id;
    RETURN false;
  END IF;
  
  -- Determine notification type and check if it's enabled
  v_notification_type := p_data->>'type';
  
  CASE v_notification_type
    WHEN 'deposit_successful' THEN
      v_should_send := COALESCE(v_push_settings->>'deposit_alerts', 'true') = 'true';
    WHEN 'payout_completed' THEN
      v_should_send := COALESCE(v_push_settings->>'payout_alerts', 'true') = 'true';
    WHEN 'security_alert' THEN
      v_should_send := COALESCE(v_push_settings->>'security_alerts', 'true') = 'true';
    WHEN 'marketing' THEN
      v_should_send := COALESCE(v_push_settings->>'marketing_alerts', 'false') = 'true';
    ELSE
      v_should_send := true;
  END CASE;
  
  IF NOT v_should_send THEN
    RAISE LOG 'Notification type % disabled for user %', v_notification_type, p_user_id;
    RETURN false;
  END IF;
  
  -- Get user's FCM token
  SELECT fcm_token INTO v_fcm_token
  FROM user_fcm_tokens
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_fcm_token IS NULL THEN
    RAISE LOG 'No FCM token found for user %', p_user_id;
    RETURN false;
  END IF;
  
  -- Check for duplicate push notification (same user, title, body within last 30 seconds)
  -- This prevents multiple push notifications for the same event
  SELECT EXISTS(
    SELECT 1 FROM push_notification_queue
    WHERE user_id = p_user_id
      AND title = p_title
      AND body = p_body
      AND created_at > NOW() - INTERVAL '30 seconds'
      AND status IN ('pending', 'sent')
  ) INTO v_duplicate_exists;
  
  IF v_duplicate_exists THEN
    RAISE LOG 'Duplicate push notification prevented: user=%, title=%, body=%', p_user_id, p_title, p_body;
    RETURN false;
  END IF;
  
  -- Insert notification into queue for processing by edge function
  INSERT INTO push_notification_queue (
    user_id,
    fcm_token,
    title,
    body,
    data,
    status,
    created_at
  ) VALUES (
    p_user_id,
    v_fcm_token,
    p_title,
    p_body,
    p_data,
    'pending',
    now()
  ) RETURNING id INTO v_queue_id;
  
  RAISE LOG 'Push notification queued: queue_id=%, user_id=%, title=%', v_queue_id, p_user_id, p_title;
  
  -- Immediately trigger the edge function to process the notification
  -- net.http_post() is async and returns a request_id (bigint)
  -- We fire-and-forget since we don't need to wait for the response
  BEGIN
    v_supabase_url := 'https://rqmpnoaavyizlwzfngpr.supabase.co';
    
    -- Use correct net.http_post() signature:
    -- net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer)
    -- Returns bigint (request_id) - we can ignore it for fire-and-forget
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notifications',
      body := '{}'::jsonb,  -- Must be jsonb, not text!
      headers := jsonb_build_object('Content-Type', 'application/json')
    ) INTO v_request_id;
    
    RAISE LOG 'Push notification edge function triggered: queue_id=%, request_id=%', v_queue_id, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Failed to trigger edge function immediately (cron will process): queue_id=%, error=%', v_queue_id, SQLERRM;
  END;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in send_push_notification: %', SQLERRM;
    RETURN false;
END;
$$;

COMMENT ON FUNCTION send_push_notification(uuid, text, text, jsonb) IS 
'Queues a push notification and immediately triggers the edge function to process it using net.http_post().
Includes duplicate prevention to prevent the same notification from being queued multiple times within 30 seconds.
The cron job runs every 2 minutes as a backup to catch any missed notifications.';

