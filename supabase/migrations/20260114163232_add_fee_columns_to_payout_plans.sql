/*
  # Add fee columns to payout_plans table
  
  This migration adds columns to track fees for each payout plan:
  - fee_percentage: The fee percentage applied to this plan
  - fee_amount: The calculated fee amount deducted
  - net_payout_amount: The amount after fee deduction (total_amount - fee_amount)
*/

-- Add fee columns to payout_plans table
ALTER TABLE payout_plans
ADD COLUMN IF NOT EXISTS fee_percentage numeric CHECK (fee_percentage >= 0),
ADD COLUMN IF NOT EXISTS fee_amount numeric CHECK (fee_amount >= 0),
ADD COLUMN IF NOT EXISTS net_payout_amount numeric CHECK (net_payout_amount >= 0);

-- Add comments
COMMENT ON COLUMN payout_plans.fee_percentage IS 'The fee percentage applied to this payout plan';
COMMENT ON COLUMN payout_plans.fee_amount IS 'The calculated fee amount deducted from total_amount';
COMMENT ON COLUMN payout_plans.net_payout_amount IS 'The amount available for payouts after fee deduction (total_amount - fee_amount)';
