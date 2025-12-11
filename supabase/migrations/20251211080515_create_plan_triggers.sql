/*
  # Plan Triggers
  
  Creates triggers for automatic plan management:
  - on_inflow: Trigger allocation when income is received
  - on_plan_edit: Recalculate feasibility when plan is edited
  - on_spend: Update progress when spending occurs
  - on_manual_top_up: Update balance when manual top-up occurs
  - on_wallet_lock_change: Update rules when wallet lock changes
*/

-- Function to trigger plan allocation on income inflow
-- This would be called when a deposit/income transaction is created
CREATE OR REPLACE FUNCTION trigger_plan_allocation_on_inflow()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric;
BEGIN
  -- Extract user_id and amount from transaction
  -- This assumes transactions table has user_id and amount
  -- Adjust based on your actual transactions table structure
  v_user_id := NEW.user_id;
  v_amount := NEW.amount;
  
  -- Only process if this is an income/deposit transaction
  -- Adjust the condition based on your transaction type field
  IF NEW.type = 'deposit' OR NEW.type = 'income' THEN
    -- Call allocation function
    -- Note: This requires mandatory_expenses calculation
    PERFORM allocate_to_plans(
      v_user_id,
      v_amount,
      0, -- TODO: Calculate mandatory expenses
      NULL -- No payout_cycle_id for manual deposits
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on transactions (adjust table name and conditions as needed)
-- DROP TRIGGER IF EXISTS trigger_on_inflow ON transactions;
-- CREATE TRIGGER trigger_on_inflow
--   AFTER INSERT ON transactions
--   FOR EACH ROW
--   WHEN (NEW.type IN ('deposit', 'income'))
--   EXECUTE FUNCTION trigger_plan_allocation_on_inflow();

-- Function to recalculate feasibility on plan edit
CREATE OR REPLACE FUNCTION trigger_recalculate_feasibility_on_plan_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- If key fields changed, trigger health recalculation
  IF (OLD.total_budget IS DISTINCT FROM NEW.total_budget) OR
     (OLD.start_date IS DISTINCT FROM NEW.start_date) OR
     (OLD.end_date IS DISTINCT FROM NEW.end_date) OR
     (OLD.required_per_cycle IS DISTINCT FROM NEW.required_per_cycle) THEN
    -- Health will be recalculated by application logic
    -- This trigger just marks that recalculation is needed
    NEW.health_status := NULL; -- Force recalculation
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on expense_plans update
DROP TRIGGER IF EXISTS trigger_on_plan_edit ON expense_plans;
CREATE TRIGGER trigger_on_plan_edit
  BEFORE UPDATE ON expense_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_feasibility_on_plan_edit();

-- Function to update progress on spend
CREATE OR REPLACE FUNCTION trigger_update_progress_on_spend()
RETURNS TRIGGER AS $$
BEGIN
  -- Update plan total_spent when spending transaction is created
  IF NEW.type = 'spending' THEN
    UPDATE expense_plans
    SET total_spent = total_spent + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
    
    -- Trigger health recalculation
    -- Health will be recalculated by application logic
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on plan_transactions
DROP TRIGGER IF EXISTS trigger_on_spend ON plan_transactions;
CREATE TRIGGER trigger_on_spend
  AFTER INSERT ON plan_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'spending')
  EXECUTE FUNCTION trigger_update_progress_on_spend();

-- Function to update balance on manual top-up
CREATE OR REPLACE FUNCTION trigger_update_balance_on_manual_top_up()
RETURNS TRIGGER AS $$
BEGIN
  -- Balance is already updated by trigger_update_plan_wallet_balance
  -- This trigger can be used for additional logic if needed
  -- For example, recalculating health status
  
  IF NEW.type = 'manual_topup' THEN
    -- Health will be recalculated by application logic
    -- Could trigger a health update here if needed
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on plan_transactions for manual top-up
DROP TRIGGER IF EXISTS trigger_on_manual_top_up ON plan_transactions;
CREATE TRIGGER trigger_on_manual_top_up
  AFTER INSERT ON plan_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'manual_topup')
  EXECUTE FUNCTION trigger_update_balance_on_manual_top_up();

-- Function to handle wallet lock change
CREATE OR REPLACE FUNCTION trigger_on_wallet_lock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If lock type changed, update plan if needed
  IF OLD.lock_type IS DISTINCT FROM NEW.lock_type THEN
    -- Could trigger notifications or other actions here
    -- For now, just log the change
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on plan_wallets update
DROP TRIGGER IF EXISTS trigger_on_wallet_lock_change ON plan_wallets;
CREATE TRIGGER trigger_on_wallet_lock_change
  BEFORE UPDATE ON plan_wallets
  FOR EACH ROW
  WHEN (OLD.lock_type IS DISTINCT FROM NEW.lock_type OR 
        OLD.spending_permission IS DISTINCT FROM NEW.spending_permission)
  EXECUTE FUNCTION trigger_on_wallet_lock_change();

-- Function to automatically update plan health periodically
-- This can be called by a cron job or scheduled function
CREATE OR REPLACE FUNCTION update_all_plan_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan expense_plans%ROWTYPE;
BEGIN
  -- This function would be called by application logic
  -- It's a placeholder for batch health updates
  -- Actual health calculation happens in application code
  NULL;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_plan_allocation_on_inflow TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_recalculate_feasibility_on_plan_edit TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_update_progress_on_spend TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_update_balance_on_manual_top_up TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_on_wallet_lock_change TO authenticated;
GRANT EXECUTE ON FUNCTION update_all_plan_health TO authenticated;
