/*
  Payout plan create idempotency:
  - unique (user_id, idempotency_key) when key is present
  - prevents duplicate plans from client retries / double taps
*/

ALTER TABLE public.payout_plans
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payout_plans_user_idempotency_key_uidx
  ON public.payout_plans (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payout_plans.idempotency_key IS
  'Client-generated attempt key; same key must return/reuse one plan, never create a second.';
