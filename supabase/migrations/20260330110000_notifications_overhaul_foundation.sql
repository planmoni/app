/*
  # Notifications Overhaul Foundation

  - Canonical Expo token table (`user_push_tokens`)
  - Delivery diagnostics table (`notification_delivery_logs`)
  - Preference extensions for grouped toggles + quiet hours
*/

-- Canonical device token store (Expo tokens)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  device_info jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
  ON public.user_push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active
  ON public.user_push_tokens(user_id, is_active);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_push_tokens'
      AND policyname = 'Users can manage own push tokens'
  ) THEN
    CREATE POLICY "Users can manage own push tokens"
    ON public.user_push_tokens
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Delivery diagnostics for all push attempts
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token text,
  notification_type text,
  title text,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'expo',
  provider_response jsonb,
  error text,
  source_function text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_user_id
  ON public.notification_delivery_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_created_at
  ON public.notification_delivery_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_status
  ON public.notification_delivery_logs(status);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_delivery_logs'
      AND policyname = 'Only service role can access delivery logs'
  ) THEN
    CREATE POLICY "Only service role can access delivery logs"
    ON public.notification_delivery_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Extend push notification preferences with grouped toggles + quiet hours metadata.
UPDATE public.profiles
SET push_notifications = COALESCE(push_notifications, '{}'::jsonb)
  || jsonb_build_object(
    'enabled', COALESCE((push_notifications->>'enabled')::boolean, true),
    'daily_digest', COALESCE((push_notifications->>'daily_digest')::boolean, true),
    'plan_reminders', COALESCE((push_notifications->>'plan_reminders')::boolean, true),
    'payout_updates', COALESCE((push_notifications->>'payout_updates')::boolean, true),
    'vault_updates', COALESCE((push_notifications->>'vault_updates')::boolean, true),
    'deposit_updates', COALESCE((push_notifications->>'deposit_updates')::boolean, true),
    'streaks', COALESCE((push_notifications->>'streaks')::boolean, true),
    're_engagement', COALESCE((push_notifications->>'re_engagement')::boolean, true),
    'security', COALESCE((push_notifications->>'security')::boolean, true),
    'quiet_hours', COALESCE(push_notifications->'quiet_hours', jsonb_build_object(
      'enabled', false,
      'start', '22:00',
      'end', '08:00',
      'timezone', 'Africa/Lagos'
    ))
  )
WHERE push_notifications IS NULL
   OR push_notifications = '{}'::jsonb
   OR (push_notifications ? 'quiet_hours') = false
   OR (push_notifications ? 'payout_updates') = false
   OR (push_notifications ? 'vault_updates') = false
   OR (push_notifications ? 'deposit_updates') = false
   OR (push_notifications ? 'streaks') = false;

