/*
  # RPC: users eligible for lifecycle retargeting (abandonment) pushes

  Used by process-lifecycle-retargeting Edge Function (service role).
*/

CREATE OR REPLACE FUNCTION public.lifecycle_retargeting_candidates(
  p_progress_event text,
  p_complete_event text,
  p_min_age_hours integer DEFAULT 2,
  p_cooldown_days integer DEFAULT 7,
  p_campaign_key text DEFAULT ''
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_progress AS (
    SELECT le.user_id, max(le.created_at) AS last_progress_at
    FROM public.lifecycle_events le
    WHERE le.event_name = p_progress_event
    GROUP BY le.user_id
  ),
  eligible AS (
    SELECT lp.user_id, lp.last_progress_at
    FROM latest_progress lp
    WHERE lp.last_progress_at < (now() - (p_min_age_hours::text || ' hours')::interval)
      AND NOT EXISTS (
        SELECT 1
        FROM public.lifecycle_events e
        WHERE e.user_id = lp.user_id
          AND e.event_name = p_complete_event
          AND e.created_at > lp.last_progress_at
      )
  ),
  cooldown_ok AS (
    SELECT e.user_id
    FROM eligible e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.lifecycle_notification_log lnl
      WHERE lnl.user_id = e.user_id
        AND lnl.campaign_key = p_campaign_key
        AND lnl.sent_at > (now() - (p_cooldown_days::text || ' days')::interval)
    )
  )
  SELECT c.user_id FROM cooldown_ok c;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_retargeting_candidates(text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifecycle_retargeting_candidates(text, text, integer, integer, text) TO service_role;

COMMENT ON FUNCTION public.lifecycle_retargeting_candidates IS
  'Returns user_ids due for abandonment retargeting (progress without completion after delay, respecting cooldown).';
