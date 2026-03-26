-- Add payout_time to custom_payout_dates for per-date payout time (default 12:00 PM).
-- Used to build next_payout_date (timestamptz) for custom frequency plans.

ALTER TABLE custom_payout_dates
ADD COLUMN IF NOT EXISTS payout_time time DEFAULT '12:00:00';

COMMENT ON COLUMN custom_payout_dates.payout_time IS 'Time of day for this payout on this date; used to build next_payout_date (timestamptz). Default 12:00.';

-- Backfill existing rows (DEFAULT only applies to new inserts)
UPDATE custom_payout_dates
SET payout_time = '12:00:00'
WHERE payout_time IS NULL;
