-- Payment link checkout currency (Stripe ISO 4217, lowercase)
ALTER TABLE public.collect_links
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

COMMENT ON COLUMN public.collect_links.amount_usd IS 'Charge amount in major units of currency (legacy column name; not USD-specific when currency is set).';
COMMENT ON COLUMN public.collect_links.currency IS 'ISO 4217 lowercase charge currency for Stripe Checkout.';
