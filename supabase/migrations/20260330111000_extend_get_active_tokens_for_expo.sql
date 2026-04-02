/*
  # Extend get_active_fcm_tokens for Expo token support

  Keeps function name for backward compatibility while returning both
  profiles.fcm_token and user_push_tokens.expo_push_token.
*/

DROP FUNCTION IF EXISTS public.get_active_fcm_tokens(uuid[]);

CREATE OR REPLACE FUNCTION public.get_active_fcm_tokens(user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  fcm_token text,
  expo_push_token text,
  notification_preferences jsonb,
  push_notifications jsonb
)
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
    upt.expo_push_token,
    p.notification_preferences,
    p.push_notifications
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT t.expo_push_token
    FROM public.user_push_tokens t
    WHERE t.user_id = p.id
      AND t.is_active = true
    ORDER BY t.updated_at DESC
    LIMIT 1
  ) AS upt ON true
  WHERE (
      (p.fcm_token IS NOT NULL AND p.fcm_token <> '')
      OR (upt.expo_push_token IS NOT NULL AND upt.expo_push_token <> '')
    )
    AND (user_ids IS NULL OR p.id = ANY(user_ids));
END;
$$ LANGUAGE plpgsql;

