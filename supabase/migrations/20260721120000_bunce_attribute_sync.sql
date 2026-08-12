-- Progress table for Bunce attribute backfill / cron sync.
-- Each cron (or manual) run processes a batch of pending users and marks them completed.

CREATE TABLE IF NOT EXISTS public.bunce_attribute_sync (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  records_sent integer,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bunce_attribute_sync_status_updated
  ON public.bunce_attribute_sync (status, updated_at);

ALTER TABLE public.bunce_attribute_sync ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bunce_attribute_sync IS
  'Tracks Bunce attribute sync progress per user. Service role only.';

-- Next N profiles with email that are not yet successfully synced.
CREATE OR REPLACE FUNCTION public.get_pending_bunce_attribute_users(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  account_verified boolean,
  kyc_tier integer,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.created_at,
    p.account_verified,
    p.kyc_tier,
    p.last_seen_at
  FROM public.profiles p
  LEFT JOIN public.bunce_attribute_sync s
    ON s.user_id = p.id
  WHERE p.email IS NOT NULL
    AND btrim(p.email) <> ''
    AND (
      s.user_id IS NULL
      OR s.status IN ('pending', 'failed')
      -- Retry rows left in processing if a prior run crashed / timed out
      OR (s.status = 'processing' AND s.updated_at < now() - interval '15 minutes')
    )
  ORDER BY p.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
$$;

REVOKE ALL ON FUNCTION public.get_pending_bunce_attribute_users(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_bunce_attribute_users(integer) TO service_role;

COMMENT ON FUNCTION public.get_pending_bunce_attribute_users(integer) IS
  'Returns next batch of profiles that still need Bunce attribute sync.';
