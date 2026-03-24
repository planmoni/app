/*
  # Extend Expense Plans with New Features
  
  This migration extends the expense plans system with:
  1. New fields on expense_plans table (plan_type, priority, funding_method, etc.)
  2. plan_wallets table - Virtual wallet tracking for each plan
  3. plan_transactions table - All plan-related transactions
  4. plan_rules table - Alert and lock rules
  5. plan_allocations table - Auto allocation history
  6. plan_health table - Health status tracking
*/

-- Extend expense_plans table with new fields
ALTER TABLE expense_plans
  ADD COLUMN IF NOT EXISTS plan_type text CHECK (plan_type IN ('recurring', 'one_time', 'long_term')),
  ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS funding_method text CHECK (funding_method IN ('auto', 'manual', 'hybrid')),
  ADD COLUMN IF NOT EXISTS auto_fund_minimum numeric DEFAULT 0 CHECK (auto_fund_minimum >= 0),
  ADD COLUMN IF NOT EXISTS payout_schedule text CHECK (payout_schedule IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
  ADD COLUMN IF NOT EXISTS required_per_cycle numeric DEFAULT 0 CHECK (required_per_cycle >= 0),
  ADD COLUMN IF NOT EXISTS required_per_day numeric DEFAULT 0 CHECK (required_per_day >= 0),
  ADD COLUMN IF NOT EXISTS current_balance numeric DEFAULT 0 CHECK (current_balance >= 0),
  ADD COLUMN IF NOT EXISTS health_status text CHECK (health_status IN ('on_track', 'slightly_behind', 'at_risk', 'unachievable')),
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;

-- Create plan_wallets table
CREATE TABLE IF NOT EXISTS plan_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  spending_permission text DEFAULT 'open' CHECK (spending_permission IN ('open', 'restricted')),
  lock_type text DEFAULT 'none' CHECK (lock_type IN ('none', 'instant', '24h_delay', 'pin_required')),
  pin_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plan_transactions table
CREATE TABLE IF NOT EXISTS plan_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL,
  wallet_id uuid REFERENCES plan_wallets(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('auto_allocation', 'manual_topup', 'spending', 'withdrawal')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  category_id text,
  subcategory_id text,
  created_at timestamptz DEFAULT now()
);

-- Create plan_rules table
CREATE TABLE IF NOT EXISTS plan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL UNIQUE,
  alert_at_70_percent boolean DEFAULT false,
  alert_risk_failure boolean DEFAULT false,
  alert_weekly_progress boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plan_allocations table
CREATE TABLE IF NOT EXISTS plan_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL,
  allocation_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payout_cycle_id uuid,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plan_health table
CREATE TABLE IF NOT EXISTS plan_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('on_track', 'slightly_behind', 'at_risk', 'unachievable')),
  percentage_behind numeric DEFAULT 0 CHECK (percentage_behind >= 0),
  recommended_action text,
  required_adjustment jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_wallets_plan_id ON plan_wallets(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_plan_id ON plan_transactions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_wallet_id ON plan_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_type ON plan_transactions(type);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_created_at ON plan_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_plan_rules_plan_id ON plan_rules(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_allocations_plan_id ON plan_allocations(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_allocations_date ON plan_allocations(allocation_date);
CREATE INDEX IF NOT EXISTS idx_plan_allocations_status ON plan_allocations(status);
CREATE INDEX IF NOT EXISTS idx_plan_health_plan_id ON plan_health(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_health_calculated_at ON plan_health(calculated_at);
CREATE INDEX IF NOT EXISTS idx_expense_plans_plan_type ON expense_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_expense_plans_priority ON expense_plans(priority);
CREATE INDEX IF NOT EXISTS idx_expense_plans_funding_method ON expense_plans(funding_method);
CREATE INDEX IF NOT EXISTS idx_expense_plans_health_status ON expense_plans(health_status);

-- Enable RLS on new tables
ALTER TABLE plan_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_wallets
CREATE POLICY "Users can view own plan wallets"
  ON plan_wallets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_wallets.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan wallets"
  ON plan_wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_wallets.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan wallets"
  ON plan_wallets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_wallets.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for plan_transactions
CREATE POLICY "Users can view own plan transactions"
  ON plan_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_transactions.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan transactions"
  ON plan_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_transactions.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for plan_rules
CREATE POLICY "Users can view own plan rules"
  ON plan_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_rules.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan rules"
  ON plan_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_rules.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan rules"
  ON plan_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_rules.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for plan_allocations
CREATE POLICY "Users can view own plan allocations"
  ON plan_allocations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_allocations.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan allocations"
  ON plan_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_allocations.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan allocations"
  ON plan_allocations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_allocations.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for plan_health
CREATE POLICY "Users can view own plan health"
  ON plan_health
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_health.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plan health"
  ON plan_health
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_health.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan health"
  ON plan_health
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = plan_health.plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- Function to create plan wallet when plan is created
CREATE OR REPLACE FUNCTION create_plan_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO plan_wallets (plan_id, balance, spending_permission, lock_type)
  VALUES (NEW.id, 0, 'open', 'none');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallet when plan is created
DROP TRIGGER IF EXISTS trigger_create_plan_wallet ON expense_plans;
CREATE TRIGGER trigger_create_plan_wallet
  AFTER INSERT ON expense_plans
  FOR EACH ROW
  EXECUTE FUNCTION create_plan_wallet();

-- Function to create plan rules when plan is created
CREATE OR REPLACE FUNCTION create_plan_rules()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO plan_rules (plan_id, alert_at_70_percent, alert_risk_failure, alert_weekly_progress)
  VALUES (NEW.id, false, false, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create rules when plan is created
DROP TRIGGER IF EXISTS trigger_create_plan_rules ON expense_plans;
CREATE TRIGGER trigger_create_plan_rules
  AFTER INSERT ON expense_plans
  FOR EACH ROW
  EXECUTE FUNCTION create_plan_rules();

-- Function to update plan wallet balance on transaction
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
  IF NEW.type = 'auto_allocation' OR NEW.type = 'manual_topup' THEN
    UPDATE plan_wallets
    SET balance = balance + NEW.amount,
        updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Update plan current_balance
    UPDATE expense_plans
    SET current_balance = current_balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  ELSIF NEW.type = 'spending' OR NEW.type = 'withdrawal' THEN
    UPDATE plan_wallets
    SET balance = balance - NEW.amount,
        updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Update plan current_balance and total_spent
    UPDATE expense_plans
    SET current_balance = current_balance - NEW.amount,
        total_spent = total_spent + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update wallet balance on transaction
DROP TRIGGER IF EXISTS trigger_update_plan_wallet_balance ON plan_transactions;
CREATE TRIGGER trigger_update_plan_wallet_balance
  AFTER INSERT ON plan_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_wallet_balance();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_plan_wallets_updated_at ON plan_wallets;
CREATE TRIGGER trigger_update_plan_wallets_updated_at
  BEFORE UPDATE ON plan_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_plan_rules_updated_at ON plan_rules;
CREATE TRIGGER trigger_update_plan_rules_updated_at
  BEFORE UPDATE ON plan_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_plan_allocations_updated_at ON plan_allocations;
CREATE TRIGGER trigger_update_plan_allocations_updated_at
  BEFORE UPDATE ON plan_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
