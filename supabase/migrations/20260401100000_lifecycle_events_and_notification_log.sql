/*
  # Lifecycle behavioral events + retargeting send log

  Append-only client events for funnel analytics and hourly abandonment campaigns.
*/

CREATE TABLE IF NOT EXISTS public.lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_user_event_created
  ON public.lifecycle_events (user_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_created_at
  ON public.lifecycle_events (created_at DESC);

ALTER TABLE public.lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own lifecycle events"
  ON public.lifecycle_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own lifecycle events"
  ON public.lifecycle_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.lifecycle_events IS
  'Append-only behavioral funnel events for retargeting and analytics.';

CREATE TABLE IF NOT EXISTS public.lifecycle_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifecycle_notification_log_user_campaign
  ON public.lifecycle_notification_log (user_id, campaign_key);

CREATE INDEX IF NOT EXISTS idx_lifecycle_notification_log_sent_at
  ON public.lifecycle_notification_log (sent_at DESC);

ALTER TABLE public.lifecycle_notification_log ENABLE ROW LEVEL SECURITY;

-- Only service role / backend should write; no client policies (edge function uses service role).

COMMENT ON TABLE public.lifecycle_notification_log IS
  'One row per user per campaign: last send time for lifecycle retargeting cooldowns.';
