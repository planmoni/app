-- Enforce that custom payout date amounts are positive when provided.
-- NULL means "use the plan's default payout_amount"; a set value must be > 0.
-- This is a server-side guard that backs the client-side and hook-level validation.

ALTER TABLE custom_payout_dates
  ADD CONSTRAINT custom_payout_dates_amount_positive
  CHECK (amount IS NULL OR amount > 0);

-- Hard cap: a single custom payout cannot exceed ₦50,000,000 (₦50M).
-- This prevents accidental or malicious over-large amounts passing through.
ALTER TABLE custom_payout_dates
  ADD CONSTRAINT custom_payout_dates_amount_max
  CHECK (amount IS NULL OR amount <= 50000000);
