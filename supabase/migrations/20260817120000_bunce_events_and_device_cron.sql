-- Bunce: event delivery log, device backfill cron, and DB triggers for the 5 events.

CREATE TABLE IF NOT EXISTS public.bunce_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  source_id text NOT NULL,
  user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  bunce_event_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, source_id)
);

CREATE INDEX IF NOT EXISTS idx_bunce_event_deliveries_user
  ON public.bunce_event_deliveries (user_id, created_at DESC);

ALTER TABLE public.bunce_event_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bunce_event_deliveries IS
  'Idempotency log for Bunce event triggers. Service role only.';

-- Pending push tokens not yet registered on Bunce.
CREATE OR REPLACE FUNCTION public.get_pending_bunce_device_tokens(p_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  device_token text,
  device_type text,
  bunce_customer_id text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tokens AS (
    SELECT
      t.user_id,
      t.expo_push_token AS device_token,
      lower(coalesce(t.device_info->>'platform', t.device_info->>'os', '')) AS device_type
    FROM public.user_push_tokens t
    WHERE t.is_active = true
      AND t.expo_push_token IS NOT NULL
      AND btrim(t.expo_push_token) <> ''

    UNION

    SELECT
      f.user_id,
      f.fcm_token AS device_token,
      lower(f.platform) AS device_type
    FROM public.user_fcm_tokens f
    WHERE f.fcm_token IS NOT NULL
      AND btrim(f.fcm_token) <> ''
      AND f.platform IN ('ios', 'android')
  )
  SELECT
    tok.user_id,
    tok.device_token,
    tok.device_type,
    p.bunce_customer_id,
    p.email
  FROM tokens tok
  JOIN public.profiles p ON p.id = tok.user_id
  LEFT JOIN public.bunce_customer_devices d
    ON d.user_id = tok.user_id
   AND d.device_token = tok.device_token
  WHERE d.id IS NULL
    AND tok.device_type IN ('ios', 'android')
    AND p.email IS NOT NULL
    AND btrim(p.email) <> ''
  ORDER BY tok.user_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

REVOKE ALL ON FUNCTION public.get_pending_bunce_device_tokens(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_bunce_device_tokens(integer) TO service_role;

COMMENT ON FUNCTION public.get_pending_bunce_device_tokens(integer) IS
  'Push tokens not yet stored in bunce_customer_devices, for the device backfill cron.';

-- Fire-and-forget HTTP to trigger-bunce-event. Never fail the source row.
CREATE OR REPLACE FUNCTION public.enqueue_bunce_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text := TG_ARGV[0];
  v_extra jsonb := '{}'::jsonb;
  v_datetime text;
BEGIN
  v_datetime := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  IF v_event = 'plan_created' THEN
    v_extra := jsonb_build_object(
      'amount', NEW.total_amount,
      'datetime', to_char(timezone('utc', COALESCE(NEW.created_at, now())), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );
  ELSIF v_event = 'wallet_funded' THEN
    v_extra := jsonb_build_object(
      'amount', NEW.amount,
      'datetime', v_datetime
    );
  ELSIF v_event IN ('plan_completed', 'vault_created') THEN
    v_extra := jsonb_build_object('datetime', v_datetime);
  END IF;

  PERFORM net.http_post(
    url := public.get_internal_supabase_url() || '/functions/v1/trigger-bunce-event',
    headers := public.get_internal_supabase_auth_headers(),
    body := jsonb_build_object(
      'event', v_event,
      'user_id', NEW.user_id,
      'source_id', NEW.id::text,
      'extra', v_extra
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_bunce_event (%) failed: %', v_event, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bunce_plan_created ON public.payout_plans;
CREATE TRIGGER trg_bunce_plan_created
  AFTER INSERT ON public.payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_bunce_event('plan_created');

DROP TRIGGER IF EXISTS trg_bunce_plan_completed ON public.payout_plans;
CREATE TRIGGER trg_bunce_plan_completed
  AFTER UPDATE OF status ON public.payout_plans
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.enqueue_bunce_event('plan_completed');

DROP TRIGGER IF EXISTS trg_bunce_wallet_funded ON public.transactions;
DROP TRIGGER IF EXISTS trg_bunce_wallet_funded_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_bunce_wallet_funded_update ON public.transactions;

CREATE TRIGGER trg_bunce_wallet_funded_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.type = 'deposit' AND NEW.status = 'completed')
  EXECUTE FUNCTION public.enqueue_bunce_event('wallet_funded');

CREATE TRIGGER trg_bunce_wallet_funded_update
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  WHEN (
    NEW.type = 'deposit'
    AND NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
  )
  EXECUTE FUNCTION public.enqueue_bunce_event('wallet_funded');

DROP TRIGGER IF EXISTS trg_bunce_vault_created ON public.budget_plans;
CREATE TRIGGER trg_bunce_vault_created
  AFTER INSERT ON public.budget_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_bunce_event('vault_created');

-- Hourly device backfill / refresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-bunce-devices-hourly') THEN
    PERFORM cron.unschedule('sync-bunce-devices-hourly');
  END IF;

  PERFORM cron.schedule(
    'sync-bunce-devices-hourly',
    '20 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_internal_supabase_url() || '/functions/v1/sync-bunce-devices',
      headers := public.get_internal_supabase_auth_headers(),
      body := '{"limit": 50}'::jsonb
    );
    $cron$
  );
END;
$$;
