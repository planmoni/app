/*
  # Fix net.http_post() signature and implementation
  
  The issue: net.http_post() was being called with wrong parameters:
  - It expects: url text, body jsonb, headers jsonb
  - We were using: url := ..., headers := ..., body := '{}'::text (wrong type)
  - It returns bigint (request_id), not the response directly
  - It's async, so we can fire-and-forget
  
  This migration fixes:
  1. send_push_notification() function to use correct net.http_post() signature
  2. Cron job to use correct net.http_post() signature
*/

-- Fix send_push_notification function to use correct net.http_post() signature
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

-- Fix cron job to use correct net.http_post() signature
SELECT cron.alter_job(
  50,
  schedule := '*/2 * * * *',
  command := $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      'https://rqmpnoaavyizlwzfngpr.supabase.co'
    ) || '/functions/v1/send-push-notifications',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json')
  ) as request_id;
  $$
);

COMMENT ON FUNCTION send_push_notification(uuid, text, text, jsonb) IS 
'Queues a push notification and immediately triggers the edge function to process it using net.http_post().
The cron job runs every 2 minutes as a backup to catch any missed notifications.';

