/*
  # Trigger push notifications immediately
  
  This migration updates the send_push_notification() function to immediately
  trigger the edge function after queuing the notification, instead of waiting
  for the cron job (which runs every 2 minutes).
  
  The cron job remains as a backup to catch any missed notifications.
*/

-- Update send_push_notification function to trigger edge function immediately
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fcm_token text;
  v_push_settings jsonb;
  v_notification_type text;
  v_should_send boolean := true;
  v_supabase_url text;
  v_service_role_key text;
  v_queue_id uuid;
BEGIN
  -- Get user's push notification settings
  SELECT push_notifications INTO v_push_settings
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Check if push notifications are enabled
  IF v_push_settings->>'enabled' = 'false' THEN
    RETURN false;
  END IF;
  
  -- Determine notification type and check if it's enabled
  v_notification_type := p_data->>'type';
  
  CASE v_notification_type
    WHEN 'deposit_successful' THEN
      v_should_send := v_push_settings->>'deposit_alerts' = 'true';
    WHEN 'payout_completed' THEN
      v_should_send := v_push_settings->>'payout_alerts' = 'true';
    WHEN 'security_alert' THEN
      v_should_send := v_push_settings->>'security_alerts' = 'true';
    WHEN 'marketing' THEN
      v_should_send := v_push_settings->>'marketing_alerts' = 'true';
    ELSE
      v_should_send := true;
  END CASE;
  
  IF NOT v_should_send THEN
    RETURN false;
  END IF;
  
  -- Get user's FCM token
  SELECT fcm_token INTO v_fcm_token
  FROM user_fcm_tokens
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_fcm_token IS NULL THEN
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
  
  -- Immediately trigger the edge function to process the notification
  -- This ensures push notifications are sent as soon as data lands in the database
  -- Note: JWT verification is disabled for this function, so no auth header needed
  BEGIN
    -- Get Supabase URL from settings or use default
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    
    -- Default Supabase URL if not set
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://rqmpnoaavyizlwzfngpr.supabase.co';
    END IF;
    
    -- Trigger the edge function immediately (fire and forget)
    -- Using PERFORM to ignore the result - we don't want to block if the HTTP call fails
    -- No Authorization header needed since JWT verification is disabled
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::text  -- Empty body is fine, edge function will fetch from queue
    );
    
    RAISE LOG 'Push notification queued and edge function triggered immediately: queue_id=%, user_id=%', v_queue_id, p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail - the cron job will pick it up as backup
    RAISE LOG 'Failed to trigger edge function immediately (cron will process): queue_id=%, error=%', v_queue_id, SQLERRM;
  END;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in send_push_notification: %', SQLERRM;
    RETURN false;
END;
$$;

-- Add comment explaining the immediate trigger behavior
COMMENT ON FUNCTION send_push_notification(uuid, text, text, jsonb) IS 
'Queues a push notification and immediately triggers the edge function to process it. 
The cron job remains as a backup to catch any missed notifications.';

