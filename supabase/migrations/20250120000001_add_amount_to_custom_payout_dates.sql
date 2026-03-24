/*
  # Add amount field to custom_payout_dates table
  
  This migration adds an amount field to store individual payout amounts
  for each custom date, allowing different amounts per date.
*/

-- Add amount column to custom_payout_dates table
ALTER TABLE custom_payout_dates
ADD COLUMN IF NOT EXISTS amount numeric;

-- Add comment to explain the field
COMMENT ON COLUMN custom_payout_dates.amount IS 'Individual payout amount for this specific date. If NULL, uses the plan payout_amount.';
