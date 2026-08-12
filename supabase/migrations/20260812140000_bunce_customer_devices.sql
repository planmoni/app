-- Bunce customer id on profiles + per-device token sync (users can have multiple devices).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bunce_customer_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_bunce_customer_id
  ON public.profiles (bunce_customer_id)
  WHERE bunce_customer_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.bunce_customer_id IS
  'Bunce customer_id used for engagement APIs (devices, attributes).';

CREATE TABLE IF NOT EXISTS public.bunce_customer_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  bunce_customer_id text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('ios', 'android')),
  device_token text NOT NULL,
  bunce_device_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_bunce_customer_devices_user
  ON public.bunce_customer_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_bunce_customer_devices_customer
  ON public.bunce_customer_devices (bunce_customer_id);

ALTER TABLE public.bunce_customer_devices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bunce_customer_devices IS
  'Idempotent map of Planmoni push tokens already registered on Bunce. Service role writes.';
