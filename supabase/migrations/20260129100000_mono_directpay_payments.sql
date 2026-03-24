/*
  # Mono Direct Pay (Pay with Bank) - Tables

  Stores one-time Direct Pay initiations so the webhook can resolve reference → user_id
  and avoid double-credit. Optional mono_webhook_events for webhook idempotency.

  1. mono_directpay_payments
    - One row per initiate; reference is idempotency key sent to Mono
    - Webhook looks up by reference to get user_id and amount
  2. mono_webhook_events (optional)
    - Deduplicate webhook processing using Mono event_id
*/

-- Table: mono_directpay_payments
CREATE TABLE IF NOT EXISTS mono_directpay_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference text UNIQUE NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'abandoned', 'cancelled')),
  mono_payment_id text,
  redirect_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mono_directpay_payments_reference ON mono_directpay_payments (reference);
CREATE INDEX IF NOT EXISTS idx_mono_directpay_payments_user_id ON mono_directpay_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_mono_directpay_payments_status ON mono_directpay_payments (status);

ALTER TABLE mono_directpay_payments ENABLE ROW LEVEL SECURITY;

-- Users can SELECT and INSERT their own rows only
CREATE POLICY "Users can select own mono_directpay_payments"
  ON mono_directpay_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mono_directpay_payments"
  ON mono_directpay_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE only via service role (webhook); no policy for UPDATE so only service role can update
-- No DELETE policy; only service role can delete if needed

COMMENT ON TABLE mono_directpay_payments IS 'One-time Direct Pay initiations; webhook resolves reference to user_id';

-- Optional: mono_webhook_events for idempotency (Mono event_id)
CREATE TABLE IF NOT EXISTS mono_webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz DEFAULT now() NOT NULL
);

-- No RLS; only webhook (service role) writes to this table
COMMENT ON TABLE mono_webhook_events IS 'Idempotency for Mono webhooks by event_id';
