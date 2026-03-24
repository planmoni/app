-- Remove auto-deduct trigger: fee is already deducted at plan creation via charge_plan_fee.
-- The trigger was causing double deduction. charge_plan_fee has idempotency (already_charged check).
-- For cancellation: just change status; recalculate_locked_balance (trigger on status change) handles the refund.

DROP TRIGGER IF EXISTS trigger_deduct_plan_fee_on_insert ON payout_plans;
