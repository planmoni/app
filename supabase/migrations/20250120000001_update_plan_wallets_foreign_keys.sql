/*
  # Update Foreign Key Constraints for budget_plans
  
  This migration updates all foreign key constraints that reference expense_plans
  to reference budget_plans instead. Only updates tables that exist.
  
  First, it cleans up orphaned records that reference plans not in budget_plans.
*/

-- Clean up orphaned records before updating foreign keys
DO $$
BEGIN
  -- Delete orphaned plan_wallets records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_wallets') THEN
    DELETE FROM plan_wallets 
    WHERE plan_id NOT IN (SELECT id FROM budget_plans);
  END IF;

  -- Delete orphaned plan_transactions records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_transactions') THEN
    DELETE FROM plan_transactions 
    WHERE plan_id NOT IN (SELECT id FROM budget_plans);
  END IF;

  -- Delete orphaned plan_rules records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_rules') THEN
    DELETE FROM plan_rules 
    WHERE plan_id NOT IN (SELECT id FROM budget_plans);
  END IF;

  -- Delete orphaned plan_allocations records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_allocations') THEN
    DELETE FROM plan_allocations 
    WHERE plan_id NOT IN (SELECT id FROM budget_plans);
  END IF;

  -- Delete orphaned plan_health records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_health') THEN
    DELETE FROM plan_health 
    WHERE plan_id NOT IN (SELECT id FROM budget_plans);
  END IF;
END $$;

-- Drop existing foreign key constraints (only if tables exist)
DO $$
BEGIN
  -- Update plan_wallets if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_wallets') THEN
    ALTER TABLE plan_wallets 
      DROP CONSTRAINT IF EXISTS plan_wallets_plan_id_fkey;
    
    ALTER TABLE plan_wallets 
      ADD CONSTRAINT plan_wallets_plan_id_fkey 
      FOREIGN KEY (plan_id) 
      REFERENCES budget_plans(id) 
      ON DELETE CASCADE;
  END IF;

  -- Update plan_transactions if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_transactions') THEN
    ALTER TABLE plan_transactions 
      DROP CONSTRAINT IF EXISTS plan_transactions_plan_id_fkey;
    
    ALTER TABLE plan_transactions 
      ADD CONSTRAINT plan_transactions_plan_id_fkey 
      FOREIGN KEY (plan_id) 
      REFERENCES budget_plans(id) 
      ON DELETE CASCADE;
  END IF;

  -- Update plan_rules if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_rules') THEN
    ALTER TABLE plan_rules 
      DROP CONSTRAINT IF EXISTS plan_rules_plan_id_fkey;
    
    ALTER TABLE plan_rules 
      ADD CONSTRAINT plan_rules_plan_id_fkey 
      FOREIGN KEY (plan_id) 
      REFERENCES budget_plans(id) 
      ON DELETE CASCADE;
  END IF;

  -- Update plan_allocations if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_allocations') THEN
    ALTER TABLE plan_allocations 
      DROP CONSTRAINT IF EXISTS plan_allocations_plan_id_fkey;
    
    ALTER TABLE plan_allocations 
      ADD CONSTRAINT plan_allocations_plan_id_fkey 
      FOREIGN KEY (plan_id) 
      REFERENCES budget_plans(id) 
      ON DELETE CASCADE;
  END IF;

  -- Update plan_health if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_health') THEN
    ALTER TABLE plan_health 
      DROP CONSTRAINT IF EXISTS plan_health_plan_id_fkey;
    
    ALTER TABLE plan_health 
      ADD CONSTRAINT plan_health_plan_id_fkey 
      FOREIGN KEY (plan_id) 
      REFERENCES budget_plans(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Update triggers that reference expense_plans
DROP TRIGGER IF EXISTS trigger_create_plan_wallet ON expense_plans;
DROP TRIGGER IF EXISTS trigger_create_plan_rules ON expense_plans;

-- Recreate triggers for budget_plans (only if functions exist)
DO $$
BEGIN
  -- Check if create_plan_wallet function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_plan_wallet') THEN
    DROP TRIGGER IF EXISTS trigger_create_plan_wallet ON budget_plans;
    CREATE TRIGGER trigger_create_plan_wallet
      AFTER INSERT ON budget_plans
      FOR EACH ROW
      EXECUTE FUNCTION create_plan_wallet();
  END IF;

  -- Check if create_plan_rules function exists and plan_rules table exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_plan_rules') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_rules') THEN
    DROP TRIGGER IF EXISTS trigger_create_plan_rules ON budget_plans;
    CREATE TRIGGER trigger_create_plan_rules
      AFTER INSERT ON budget_plans
      FOR EACH ROW
      EXECUTE FUNCTION create_plan_rules();
  END IF;
END $$;

-- Update RLS policies that reference expense_plans
-- Drop old policies (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_wallets') THEN
    DROP POLICY IF EXISTS "Users can view own plan wallets" ON plan_wallets;
    DROP POLICY IF EXISTS "Users can insert own plan wallets" ON plan_wallets;
    DROP POLICY IF EXISTS "Users can update own plan wallets" ON plan_wallets;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_transactions') THEN
    DROP POLICY IF EXISTS "Users can view own plan transactions" ON plan_transactions;
    DROP POLICY IF EXISTS "Users can insert own plan transactions" ON plan_transactions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_rules') THEN
    DROP POLICY IF EXISTS "Users can view own plan rules" ON plan_rules;
    DROP POLICY IF EXISTS "Users can update own plan rules" ON plan_rules;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_allocations') THEN
    DROP POLICY IF EXISTS "Users can view own plan allocations" ON plan_allocations;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_health') THEN
    DROP POLICY IF EXISTS "Users can view own plan health" ON plan_health;
    DROP POLICY IF EXISTS "Users can update own plan health" ON plan_health;
  END IF;
END $$;

-- Recreate policies for budget_plans (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_wallets') THEN
    CREATE POLICY "Users can view own plan wallets"
      ON plan_wallets
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_wallets.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own plan wallets"
      ON plan_wallets
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_wallets.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own plan wallets"
      ON plan_wallets
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_wallets.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_transactions') THEN
    CREATE POLICY "Users can view own plan transactions"
      ON plan_transactions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_transactions.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own plan transactions"
      ON plan_transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_transactions.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_rules') THEN
    CREATE POLICY "Users can view own plan rules"
      ON plan_rules
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_rules.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own plan rules"
      ON plan_rules
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_rules.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_allocations') THEN
    CREATE POLICY "Users can view own plan allocations"
      ON plan_allocations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_allocations.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_health') THEN
    CREATE POLICY "Users can view own plan health"
      ON plan_health
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_health.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own plan health"
      ON plan_health
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM budget_plans
          WHERE budget_plans.id = plan_health.plan_id
          AND budget_plans.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Update update_plan_wallet_balance function to use budget_plans
CREATE OR REPLACE FUNCTION update_plan_wallet_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Get wallet_id for this plan
  SELECT id INTO v_wallet_id
  FROM plan_wallets
  WHERE plan_id = NEW.plan_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Update wallet balance based on transaction type
  IF NEW.type = 'auto_allocation' OR NEW.type = 'manual_topup' OR NEW.type = 'auto_topup' THEN
    UPDATE plan_wallets
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Update plan current_balance
    UPDATE budget_plans
    SET current_balance = current_balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  ELSIF NEW.type = 'spending' OR NEW.type = 'withdrawal' THEN
    UPDATE plan_wallets
    SET balance = balance - NEW.amount,
        updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Update plan current_balance and total_spent
    UPDATE budget_plans
    SET current_balance = current_balance - NEW.amount,
        total_spent = total_spent + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

