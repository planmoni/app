/*
  Single-device login lock was left on after logout.

  login_sessions.is_active was cleared in a background request, then
  auth.signOut revoked the server session. If that update never finished,
  the next login still saw is_active = true and blocked with
  "log out from the other device" even though that device was already signed out.

  These functions:
  - release only the current device's lock on logout
  - treat a lock as stale when its auth.sessions row is gone or its access token expired
*/

CREATE OR REPLACE FUNCTION public.jwt_payload(token text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  part text;
  payload text;
BEGIN
  IF token IS NULL OR token !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  part := split_part(token, '.', 2);
  part := translate(part, '-_', '+/');
  part := part || repeat('=', (4 - length(part) % 4) % 4);
  payload := convert_from(decode(part, 'base64'), 'utf8');
  RETURN payload::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_stale_login_locks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.login_sessions ls
  SET is_active = false
  WHERE ls.user_id = p_user_id
    AND ls.is_active = true
    AND (
      NOT EXISTS (
        SELECT 1
        FROM auth.sessions s
        WHERE s.user_id = ls.user_id
          AND s.id::text = COALESCE(public.jwt_payload(ls.session_id)->>'session_id', '')
          AND (s.not_after IS NULL OR s.not_after > now())
      )
      OR COALESCE((public.jwt_payload(ls.session_id)->>'exp')::bigint, 0)
         < EXTRACT(epoch FROM now())
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_current_login_lock(p_fingerprint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id text := COALESCE(auth.jwt()->>'session_id', '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.login_sessions ls
  SET is_active = false
  WHERE ls.user_id = v_user_id
    AND ls.is_active = true
    AND (
      COALESCE(public.jwt_payload(ls.session_id)->>'session_id', '') = v_session_id
      OR (
        p_fingerprint IS NOT NULL
        AND p_fingerprint <> ''
        AND ls.device_fingerprint = p_fingerprint
      )
    );

  PERFORM public.clear_stale_login_locks(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_device_login(p_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  blocker public.login_sessions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.clear_stale_login_locks(v_user_id);

  SELECT *
  INTO blocker
  FROM public.login_sessions
  WHERE user_id = v_user_id
    AND is_active = true
    AND COALESCE(device_fingerprint, '') IS DISTINCT FROM COALESCE(p_fingerprint, '')
  ORDER BY login_timestamp DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'same_device', false,
      'device_manufacturer', blocker.device_manufacturer,
      'device_model', blocker.device_model,
      'os_name', blocker.os_name
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'same_device', EXISTS (
      SELECT 1
      FROM public.login_sessions
      WHERE user_id = v_user_id
        AND is_active = true
        AND device_fingerprint = p_fingerprint
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jwt_payload(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_stale_login_locks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_current_login_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.evaluate_device_login(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.release_current_login_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_device_login(text) TO authenticated;
