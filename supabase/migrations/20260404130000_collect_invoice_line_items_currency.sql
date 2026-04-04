-- Collect invoices: multi-currency line items + due date snapshot

ALTER TABLE public.collect_invoices
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

ALTER TABLE public.collect_invoices
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE public.collect_invoices
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.collect_invoices.amount_usd IS
  'Total in major units of invoice currency (historical column name; not USD-only).';

COMMENT ON COLUMN public.collect_invoices.currency IS
  'Lowercase ISO 4217 code (Stripe).';

COMMENT ON COLUMN public.collect_invoices.line_items IS
  'Snapshot of line items [{ description, quantity, unit_amount }] at creation.';

CREATE INDEX IF NOT EXISTS idx_collect_invoices_currency ON public.collect_invoices (user_id, currency);
