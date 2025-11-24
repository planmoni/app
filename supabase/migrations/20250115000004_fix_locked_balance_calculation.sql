/*
  # Fix Locked Balance Calculation
  
  1. Problem
    - Locked balance is including cancelled payout plans
    - Should only calculate from active and paused payout plans
    - When plans are cancelled via emergency withdrawal, funds are already withdrawn
    - Remaining amount = total_amount - (completed_payouts * payout_amount)
  
  2. Solution
    - Create function to recalculate locked_balance from active/paused plans only (excludes cancelled/completed)
    - When recalculating, we only update locked_balance - we don't unlock funds from cancelled plans
    - This is correct because cancelled plans had their funds withdrawn via emergency withdrawals
    - Create trigger to update locked_balance when plan status changes
    - Create function to sync all users' locked balances (one-time fix)
*/

-- Function to recalculate locked balance for a user from active payout plans only
CREATE OR REPLACE FUNCTION recalculate_locked_balance(arg_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculated_locked_balance numeric;
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed (required by secure_wallets_table trigger)
  PERFORM allow_wallet_update();

  -- Calculate locked balance from active and paused payout plans only
  -- Exclude cancelled and completed plans
  -- Remaining amount = total_amount - (completed_payouts * payout_amount)
  SELECT COALESCE(SUM(
    total_amount - (completed_payouts * payout_amount)
  ), 0)
  INTO v_calculated_locked_balance
  FROM payout_plans
  WHERE user_id = arg_user_id
    AND status IN ('active', 'paused')
    AND (total_amount - (completed_payouts * payout_amount)) > 0;

  -- Get wallet with row lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Update locked balance only
  -- Note: We only update locked_balance to match active/paused plans
  -- We do NOT unlock funds from cancelled plans because those funds were already
  -- withdrawn via emergency withdrawals. The available_balance will be automatically
  -- correct since it's calculated as balance - locked_balance.
  UPDATE wallets
  SET 
    locked_balance = v_calculated_locked_balance,
    available_balance = balance - v_calculated_locked_balance,
    updated_at = now()
  WHERE user_id = arg_user_id;
  
  -- Ensure available_balance doesn't go negative (safety check)
  -- This handles edge cases where balance might be less than locked_balance
  UPDATE wallets
  SET available_balance = GREATEST(0, balance - locked_balance)
  WHERE user_id = arg_user_id 
    AND available_balance < 0;

  -- Return updated wallet state
  SELECT balance, locked_balance, (balance - locked_balance) as available_balance
  INTO v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance
  FROM wallets WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_wallet.balance,
    'locked_balance', v_wallet.locked_balance,
    'available_balance', v_wallet.available_balance,
    'calculated_locked_balance', v_calculated_locked_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to sync all users' locked balances (one-time fix)
CREATE OR REPLACE FUNCTION sync_all_locked_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_synced_count integer := 0;
  v_error_count integer := 0;
  v_result jsonb;
BEGIN
  -- Loop through all users with wallets
  FOR v_user_record IN 
    SELECT DISTINCT user_id FROM wallets
  LOOP
    BEGIN
      v_result := recalculate_locked_balance(v_user_record.user_id);
      IF (v_result->>'success')::boolean THEN
        v_synced_count := v_synced_count + 1;
      ELSE
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Failed to sync locked balance for user %: %', 
          v_user_record.user_id, v_result->>'error';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error syncing locked balance for user %: %', 
          v_user_record.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced_count', v_synced_count,
    'error_count', v_error_count
  );
END;
$$;

-- Trigger function to update locked balance when payout plan status changes
CREATE OR REPLACE FUNCTION update_locked_balance_on_plan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_has_emergency_withdrawal boolean;
BEGIN
  -- Handle DELETE operations
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    PERFORM recalculate_locked_balance(v_user_id);
    RETURN OLD;
  END IF;

  -- Handle INSERT and UPDATE operations
  v_user_id := NEW.user_id;

  -- Check if plan is being cancelled and has an emergency withdrawal
  -- If so, funds were already withdrawn, so we should still recalculate
  -- but the recalculation will correctly exclude cancelled plans
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Check if there's a completed emergency withdrawal for this plan
    SELECT EXISTS(
      SELECT 1 FROM emergency_withdrawals
      WHERE payout_plan_id = NEW.id
        AND status = 'completed'
    ) INTO v_has_emergency_withdrawal;
    
    -- If emergency withdrawal exists, funds were already withdrawn via transfer_funds
    -- The recalculation will correctly exclude cancelled plans from locked_balance
    -- This is safe because transfer_funds already reduced both balance and locked_balance
  END IF;

  -- Only recalculate if status changed to/from 'active', 'paused', 'cancelled', or 'completed'
  -- Note: Even for cancelled plans, we recalculate to ensure locked_balance only includes active plans
  -- The funds from cancelled plans were already handled by emergency withdrawal (transfer_funds)
  IF (TG_OP = 'INSERT') OR 
     ((OLD.status IS DISTINCT FROM NEW.status) AND 
      (OLD.status IN ('active', 'paused', 'cancelled', 'completed') OR 
       NEW.status IN ('active', 'paused', 'cancelled', 'completed'))) THEN
    -- Recalculate locked balance for this user
    -- This will correctly exclude cancelled plans
    PERFORM recalculate_locked_balance(v_user_id);
  END IF;

  -- Also recalculate if total_amount or completed_payouts changed for active or paused plans
  IF NEW.status IN ('active', 'paused') AND (
    (OLD.total_amount IS DISTINCT FROM NEW.total_amount) OR
    (OLD.completed_payouts IS DISTINCT FROM NEW.completed_payouts) OR
    (OLD.payout_amount IS DISTINCT FROM NEW.payout_amount)
  ) THEN
    PERFORM recalculate_locked_balance(v_user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on payout_plans table
DROP TRIGGER IF EXISTS trigger_update_locked_balance_on_plan_change ON payout_plans;

CREATE TRIGGER trigger_update_locked_balance_on_plan_change
  AFTER INSERT OR UPDATE OR DELETE ON payout_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_locked_balance_on_plan_status_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION recalculate_locked_balance TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_locked_balance TO service_role;
GRANT EXECUTE ON FUNCTION sync_all_locked_balances TO service_role;

-- Add comments
COMMENT ON FUNCTION recalculate_locked_balance IS 'Recalculates locked balance from active and paused payout plans only (excludes cancelled/completed plans)';
COMMENT ON FUNCTION sync_all_locked_balances IS 'One-time function to sync all users locked balances. Should be run after this migration.';
COMMENT ON FUNCTION update_locked_balance_on_plan_status_change IS 'Trigger function that automatically updates locked balance when payout plan status changes';

