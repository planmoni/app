/*
  # Auto-deduct plan fee on payout plan creation

  Fee model: the fee is deducted FROM the user's committed plan amount (not added on top).
  Example: user has balance ₦40,000 and creates a plan for ₦40,000 total. After fees are
  deducted from that amount, their available balance is 0 (the full 40K is committed:
  part as fees, part locked for payouts).

  Problem:
  - Fees can return to the user's balance when plan creation is retried or
    charge_plan_fee is skipped due to idempotency on the backend.
  - We need the fee to be deducted in the same transaction as the plan insert,
    without crediting it elsewhere.

  Solution:
  - AFTER INSERT trigger on payout_plans: deduct fee_amount from the user's
    wallet balance (fee comes from the plan total; with lock_funds(net_payout_amount)
    this leaves available_balance = 0 when they commit their full balance).
  - Record the fee event so charge_plan_fee() remains idempotent.
  - Fee is only deducted from balance; nothing is added anywhere.
*/

-- Trigger function: deduct plan fee from wallet on plan insert
CREATE OR REPLACE FUNCTION deduct_plan_fee_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee numeric;
BEGIN
  v_fee := COALESCE(NEW.fee_amount, 0);
  IF v_fee <= 0 THEN
    RETURN NEW;
  END IF;

  -- Allow wallet update (bypass prevent_direct_wallet_updates)
  PERFORM allow_wallet_update();

  -- Deduct fee from balance (fee is taken from the plan amount; e.g. 40K plan → balance drops by fee, available ends up 0)
  UPDATE wallets
  SET
    balance = balance - v_fee,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  -- Record fee event so charge_plan_fee(plan_id) is idempotent (already_charged)
  PERFORM record_user_fee(
    NEW.user_id,
    'payout_plan',
    NEW.id,
    'plan_creation',
    v_fee,
    'NGN',
    NEW.total_amount,
    NEW.fee_percentage,
    jsonb_build_object(
      'net_payout_amount', NEW.net_payout_amount,
      'frequency', NEW.frequency,
      'note', 'Fee deducted by trigger deduct_plan_fee_on_insert'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise so plan insert fails if wallet update fails (e.g. insufficient balance)
    RAISE;
END;
$$;

-- Run after insert so the plan row is committed and we have NEW.id
DROP TRIGGER IF EXISTS trigger_deduct_plan_fee_on_insert ON payout_plans;
CREATE TRIGGER trigger_deduct_plan_fee_on_insert
  AFTER INSERT ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION deduct_plan_fee_on_insert();

COMMENT ON FUNCTION deduct_plan_fee_on_insert IS 'Deducts plan fee from user wallet on payout_plans INSERT (fee is from plan amount; full-commit e.g. 40K plan leaves available balance 0). Keeps charge_plan_fee idempotent.';
