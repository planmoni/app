/*
  # Add push notifications support
  
  This migration adds support for Firebase Cloud Messaging (FCM) push notifications.
  
  1. New Tables
    - user_fcm_tokens
      - user_id (uuid, references profiles)
      - fcm_token (text)
      - platform (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Schema Updates
    - Add push_notifications column to profiles table
  
  3. Indexes
    - Index on fcm_token for quick lookups
*/

-- Create user_fcm_tokens table
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  fcm_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create index on fcm_token for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_token ON user_fcm_tokens(fcm_token);

-- Create index on user_id for user lookups
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);

-- Add push_notifications column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_notifications jsonb DEFAULT '{
  "enabled": true,
  "deposit_alerts": true,
  "payout_alerts": true,
  "security_alerts": true,
  "marketing_alerts": false
}'::jsonb;

-- Create a function to send push notifications
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
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in send_push_notification: %', SQLERRM;
    RETURN false;
END;
$$;

-- Create push notification queue table
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  fcm_token text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on status for processing
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_status ON push_notification_queue(status, created_at);

-- Create index on user_id for user lookups
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_user_id ON push_notification_queue(user_id); 