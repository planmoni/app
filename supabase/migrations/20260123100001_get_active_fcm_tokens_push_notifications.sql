/*
  # Extend get_active_fcm_tokens to return push_notifications

  Required for daily_digest and other push_notifications-based filtering
  in send-push-notification edge function.
*/

-- Must drop first because return type (OUT parameters) is changing
DROP FUNCTION IF EXISTS get_active_fcm_tokens(uuid[]);

CREATE OR REPLACE FUNCTION get_active_fcm_tokens(user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(user_id uuid, fcm_token text, notification_preferences jsonb, push_notifications jsonb)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied. This function can only be called by service role.';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.fcm_token,
    p.notification_preferences,
    p.push_notifications
  FROM profiles p
  WHERE
    p.fcm_token IS NOT NULL
    AND p.fcm_token != ''
    AND (user_ids IS NULL OR p.id = ANY(user_ids));
END;
$$ LANGUAGE plpgsql;
