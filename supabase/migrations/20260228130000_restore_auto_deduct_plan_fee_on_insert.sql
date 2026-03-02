-- Restore auto-deduct trigger so fees never return to available balance after plan creation.
-- Fee is deducted in the same transaction as the plan insert; charge_plan_fee() then no-ops (already_charged).

DROP TRIGGER IF EXISTS trigger_deduct_plan_fee_on_insert ON payout_plans;
CREATE TRIGGER trigger_deduct_plan_fee_on_insert
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION deduct_plan_fee_on_insert();

COMMENT ON TRIGGER trigger_deduct_plan_fee_on_insert ON payout_plans IS 'Deducts plan fee from balance on insert so fees do not return to available balance; charge_plan_fee remains idempotent.';
