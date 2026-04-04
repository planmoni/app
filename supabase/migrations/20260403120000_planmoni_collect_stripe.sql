/*
  # Planmoni Collect — Stripe Connect + FX settlement

  Tables for connected accounts, payment links, invoices, settlements ledger,
  webhook idempotency, FX/fee config, and credit_collect_settlement RPC.
*/

-- FX rate (USD -> NGN), server-authoritative
CREATE TABLE IF NOT EXISTS public.collect_fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'USD',
  quote_currency text NOT NULL DEFAULT 'NGN',
  rate numeric(18, 6) NOT NULL CHECK (rate > 0),
  valid_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collect_fx_rates_valid
  ON public.collect_fx_rates (base_currency, quote_currency, valid_from DESC);

ALTER TABLE public.collect_fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read FX rates"
  ON public.collect_fx_rates FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.collect_fx_rates IS 'USD/NGN (etc.) rates for Collect settlement; update via SQL or admin job.';

-- Planmoni fee on converted NGN (percent of NGN subtotal + flat)
CREATE TABLE IF NOT EXISTS public.collect_fee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_percent numeric(8, 4) NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent <= 100),
  fee_flat_ngn numeric(18, 2) NOT NULL DEFAULT 0 CHECK (fee_flat_ngn >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collect_fee_schedule_effective
  ON public.collect_fee_schedule (effective_from DESC);

ALTER TABLE public.collect_fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fee schedule"
  ON public.collect_fee_schedule FOR SELECT TO authenticated USING (true);

-- Stripe Connect account per user (Express)
CREATE TABLE IF NOT EXISTS public.collect_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  details_submitted boolean NOT NULL DEFAULT false,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collect_connected_accounts_user_unique UNIQUE (user_id),
  CONSTRAINT collect_connected_accounts_stripe_unique UNIQUE (stripe_account_id)
);

CREATE INDEX IF NOT EXISTS idx_collect_connected_accounts_stripe
  ON public.collect_connected_accounts (stripe_account_id);

ALTER TABLE public.collect_connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connect account"
  ON public.collect_connected_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connect account"
  ON public.collect_connected_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connect account"
  ON public.collect_connected_accounts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Payment links (Checkout) created by user
CREATE TABLE IF NOT EXISTS public.collect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  amount_usd numeric(12, 2) NOT NULL CHECK (amount_usd > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paid', 'cancelled')),
  stripe_checkout_session_id text,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collect_links_user ON public.collect_links (user_id, created_at DESC);

ALTER TABLE public.collect_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collect links"
  ON public.collect_links FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Invoices
CREATE TABLE IF NOT EXISTS public.collect_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  client_name text,
  description text NOT NULL DEFAULT '',
  amount_usd numeric(12, 2) NOT NULL CHECK (amount_usd > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  stripe_invoice_id text,
  stripe_customer_id text,
  hosted_invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collect_invoices_user ON public.collect_invoices (user_id, created_at DESC);

ALTER TABLE public.collect_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collect invoices"
  ON public.collect_invoices FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ledger: one row per settled payment (webhook)
CREATE TABLE IF NOT EXISTS public.collect_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('checkout', 'invoice')),
  collect_link_id uuid REFERENCES public.collect_links(id) ON DELETE SET NULL,
  collect_invoice_id uuid REFERENCES public.collect_invoices(id) ON DELETE SET NULL,
  usd_gross numeric(18, 4) NOT NULL,
  usd_stripe_fee numeric(18, 4) NOT NULL DEFAULT 0,
  usd_net numeric(18, 4) NOT NULL,
  fx_rate numeric(18, 6) NOT NULL,
  planmoni_fee_ngn numeric(18, 2) NOT NULL DEFAULT 0,
  ngn_credited numeric(18, 2) NOT NULL,
  transaction_reference text NOT NULL,
  wallet_transaction_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collect_settlements_pi_unique UNIQUE (stripe_payment_intent_id)
);

CREATE INDEX IF NOT EXISTS idx_collect_settlements_user ON public.collect_settlements (user_id, created_at DESC);

ALTER TABLE public.collect_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settlements"
  ON public.collect_settlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Webhook idempotency
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_summary jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No client access
CREATE POLICY "No client access stripe_webhook_events"
  ON public.stripe_webhook_events FOR SELECT TO authenticated USING (false);

-- Seed default FX + fee (tune in production)
INSERT INTO public.collect_fx_rates (base_currency, quote_currency, rate, valid_from)
SELECT 'USD', 'NGN', 1500::numeric, now()
WHERE NOT EXISTS (SELECT 1 FROM public.collect_fx_rates LIMIT 1);

INSERT INTO public.collect_fee_schedule (fee_percent, fee_flat_ngn, effective_from)
SELECT 1.5::numeric, 0::numeric, now()
WHERE NOT EXISTS (SELECT 1 FROM public.collect_fee_schedule LIMIT 1);

-- Atomic: ledger row + wallet credit + link/invoice status (service_role only)
CREATE OR REPLACE FUNCTION public.finalize_collect_stripe_settlement(
  p_user_id uuid,
  p_stripe_payment_intent_id text,
  p_source_type text,
  p_usd_gross numeric,
  p_usd_stripe_fee numeric,
  p_usd_net numeric,
  p_fx_rate numeric,
  p_planmoni_fee_ngn numeric,
  p_ngn_credited numeric,
  p_collect_link_id uuid,
  p_collect_invoice_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_current_locked_balance numeric;
  v_new_balance numeric;
  v_new_available_balance numeric;
  v_transaction_id uuid;
  v_settlement_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_stripe_payment_intent_id));

  IF EXISTS (SELECT 1 FROM public.collect_settlements WHERE stripe_payment_intent_id = p_stripe_payment_intent_id) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  IF p_ngn_credited IS NULL OR p_ngn_credited <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid NGN amount');
  END IF;

  IF p_stripe_payment_intent_id IS NULL OR length(trim(p_stripe_payment_intent_id)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment intent id');
  END IF;

  PERFORM allow_wallet_update();

  SELECT id, COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO v_wallet_id, v_current_balance, v_current_locked_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_ngn_credited;
  v_new_available_balance := v_new_balance - v_current_locked_balance;

  UPDATE wallets
  SET
    balance = v_new_balance,
    available_balance = v_new_available_balance,
    updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    reference,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'deposit',
    p_ngn_credited,
    'completed',
    'Stripe Collect',
    'wallet',
    p_stripe_payment_intent_id,
    'International payment collected (USD) — credited in NGN',
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    transaction_id,
    metadata
  ) VALUES (
    p_user_id,
    'deposit_successful',
    'Collect payment received',
    format('₦%s added from Collect (international)', to_char(p_ngn_credited, 'FM999,999,999.00')),
    'unread',
    v_transaction_id,
    jsonb_build_object('source', 'Stripe Collect', 'reference', p_stripe_payment_intent_id)
  );

  INSERT INTO public.collect_settlements (
    user_id,
    stripe_payment_intent_id,
    source_type,
    collect_link_id,
    collect_invoice_id,
    usd_gross,
    usd_stripe_fee,
    usd_net,
    fx_rate,
    planmoni_fee_ngn,
    ngn_credited,
    transaction_reference,
    wallet_transaction_id,
    metadata
  ) VALUES (
    p_user_id,
    p_stripe_payment_intent_id,
    p_source_type,
    p_collect_link_id,
    p_collect_invoice_id,
    p_usd_gross,
    p_usd_stripe_fee,
    p_usd_net,
    p_fx_rate,
    p_planmoni_fee_ngn,
    p_ngn_credited,
    p_stripe_payment_intent_id,
    v_transaction_id,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_settlement_id;

  IF p_collect_link_id IS NOT NULL THEN
    UPDATE public.collect_links SET status = 'paid', updated_at = now() WHERE id = p_collect_link_id AND user_id = p_user_id;
  END IF;

  IF p_collect_invoice_id IS NOT NULL THEN
    UPDATE public.collect_invoices SET status = 'paid', updated_at = now() WHERE id = p_collect_invoice_id AND user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'settlement_id', v_settlement_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  WHEN OTHERS THEN
    RAISE LOG 'finalize_collect_stripe_settlement error: %', SQLERRM;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_collect_stripe_settlement(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, uuid, uuid, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_collect_stripe_settlement(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, uuid, uuid, jsonb
) TO service_role;

COMMENT ON FUNCTION public.finalize_collect_stripe_settlement IS
  'Single transaction: insert collect_settlements, credit NGN wallet, mark link/invoice paid. Idempotent by payment_intent id.';
