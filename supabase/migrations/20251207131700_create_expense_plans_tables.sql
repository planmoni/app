/*
  # Expense Plans Database Schema
  
  This migration creates the complete database schema for expense plans including:
  1. Core tables (expense_plans, expense_buckets, expense_bucket_locked_funds, etc.)
  2. Indexes for performance
  3. RLS policies for security
  4. Functions for creating plans, locking funds, and managing withdrawals
*/

-- Create expense_plans table
CREATE TABLE IF NOT EXISTS expense_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  total_budget numeric NOT NULL CHECK (total_budget > 0),
  budget_structure text NOT NULL CHECK (budget_structure IN ('fixed', 'estimated')),
  start_date date,
  end_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  total_spent numeric DEFAULT 0 CHECK (total_spent >= 0),
  remaining_budget numeric GENERATED ALWAYS AS (total_budget - total_spent) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_buckets table
CREATE TABLE IF NOT EXISTS expense_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL,
  category_id text NOT NULL,
  subcategory_id text NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount >= 0),
  amount_spent numeric DEFAULT 0 CHECK (amount_spent >= 0),
  remaining_amount numeric GENERATED ALWAYS AS (target_amount - amount_spent) STORED,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_bucket_locked_funds table
CREATE TABLE IF NOT EXISTS expense_bucket_locked_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_bucket_id uuid REFERENCES expense_buckets(id) ON DELETE CASCADE NOT NULL,
  locked_amount numeric NOT NULL CHECK (locked_amount > 0),
  unlock_date date NOT NULL,
  status text DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'withdrawn')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_bucket_withdrawals table
CREATE TABLE IF NOT EXISTS expense_bucket_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_bucket_id uuid REFERENCES expense_buckets(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payout_account_id uuid REFERENCES bank_accounts(id) ON DELETE RESTRICT NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_date date,
  transfer_reference text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_bucket_scheduled_withdrawals table
CREATE TABLE IF NOT EXISTS expense_bucket_scheduled_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_plan_id uuid REFERENCES expense_plans(id) ON DELETE CASCADE NOT NULL,
  payout_account_id uuid REFERENCES bank_accounts(id) ON DELETE RESTRICT NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'custom')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  amount_per_withdrawal numeric NOT NULL CHECK (amount_per_withdrawal > 0),
  selected_bucket_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_transactions table (for future use)
CREATE TABLE IF NOT EXISTS expense_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_bucket_id uuid REFERENCES expense_buckets(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expense_plans_user_id ON expense_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_plans_status ON expense_plans(status);
CREATE INDEX IF NOT EXISTS idx_expense_plans_dates ON expense_plans(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_expense_buckets_plan_id ON expense_buckets(expense_plan_id);
CREATE INDEX IF NOT EXISTS idx_expense_buckets_category ON expense_buckets(category_id, subcategory_id);

CREATE INDEX IF NOT EXISTS idx_locked_funds_bucket_id ON expense_bucket_locked_funds(expense_bucket_id);
CREATE INDEX IF NOT EXISTS idx_locked_funds_status ON expense_bucket_locked_funds(status);
CREATE INDEX IF NOT EXISTS idx_locked_funds_unlock_date ON expense_bucket_locked_funds(unlock_date) WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS idx_withdrawals_bucket_id ON expense_bucket_withdrawals(expense_bucket_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON expense_bucket_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_scheduled_date ON expense_bucket_withdrawals(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_scheduled_withdrawals_plan_id ON expense_bucket_scheduled_withdrawals(expense_plan_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_withdrawals_status ON expense_bucket_scheduled_withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_transactions_bucket_id ON expense_transactions(expense_bucket_id);

-- Enable RLS on all tables
ALTER TABLE expense_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_bucket_locked_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_bucket_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_bucket_scheduled_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_plans
CREATE POLICY "Users can view own expense plans"
  ON expense_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense plans"
  ON expense_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense plans"
  ON expense_plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense plans"
  ON expense_plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for expense_buckets
CREATE POLICY "Users can view own expense buckets"
  ON expense_buckets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_buckets.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own expense buckets"
  ON expense_buckets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_buckets.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own expense buckets"
  ON expense_buckets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_buckets.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_buckets.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own expense buckets"
  ON expense_buckets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_buckets.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for expense_bucket_locked_funds
CREATE POLICY "Users can view own locked funds"
  ON expense_bucket_locked_funds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_locked_funds.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own locked funds"
  ON expense_bucket_locked_funds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_locked_funds.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own locked funds"
  ON expense_bucket_locked_funds
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_locked_funds.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_locked_funds.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for expense_bucket_withdrawals
CREATE POLICY "Users can view own withdrawals"
  ON expense_bucket_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_withdrawals.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own withdrawals"
  ON expense_bucket_withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_withdrawals.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own withdrawals"
  ON expense_bucket_withdrawals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_bucket_withdrawals.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for expense_bucket_scheduled_withdrawals
CREATE POLICY "Users can view own scheduled withdrawals"
  ON expense_bucket_scheduled_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_bucket_scheduled_withdrawals.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own scheduled withdrawals"
  ON expense_bucket_scheduled_withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_bucket_scheduled_withdrawals.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own scheduled withdrawals"
  ON expense_bucket_scheduled_withdrawals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_plans
      WHERE expense_plans.id = expense_bucket_scheduled_withdrawals.expense_plan_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for expense_transactions
CREATE POLICY "Users can view own expense transactions"
  ON expense_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_transactions.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own expense transactions"
  ON expense_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_buckets
      JOIN expense_plans ON expense_plans.id = expense_buckets.expense_plan_id
      WHERE expense_buckets.id = expense_transactions.expense_bucket_id
      AND expense_plans.user_id = auth.uid()
    )
  );

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_expense_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_expense_buckets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_locked_funds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expense_plans_updated_at
  BEFORE UPDATE ON expense_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_plans_updated_at();

CREATE TRIGGER expense_buckets_updated_at
  BEFORE UPDATE ON expense_buckets
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_buckets_updated_at();

CREATE TRIGGER locked_funds_updated_at
  BEFORE UPDATE ON expense_bucket_locked_funds
  FOR EACH ROW
  EXECUTE FUNCTION update_locked_funds_updated_at();

CREATE TRIGGER withdrawals_updated_at
  BEFORE UPDATE ON expense_bucket_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawals_updated_at();

CREATE TRIGGER scheduled_withdrawals_updated_at
  BEFORE UPDATE ON expense_bucket_scheduled_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_withdrawals_updated_at();

-- Function to calculate unlock_date based on dates
CREATE OR REPLACE FUNCTION calculate_expense_unlock_date(
  p_start_date date,
  p_end_date date
)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  -- If start_date equals end_date, unlock on that date
  IF p_start_date = p_end_date THEN
    RETURN p_start_date;
  END IF;
  
  -- If date range, unlock on start_date (funds available from beginning)
  IF p_start_date IS NOT NULL THEN
    RETURN p_start_date;
  END IF;
  
  -- Fallback to end_date if start_date is null
  RETURN p_end_date;
END;
$$;

-- Function to create expense plan with buckets (transaction)
CREATE OR REPLACE FUNCTION create_expense_plan_with_buckets(
  p_user_id uuid,
  p_name text,
  p_total_budget numeric,
  p_budget_structure text,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_buckets jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_bucket jsonb;
  v_bucket_id uuid;
BEGIN
  -- Validate budget structure
  IF p_budget_structure NOT IN ('fixed', 'estimated') THEN
    RAISE EXCEPTION 'Invalid budget_structure: %', p_budget_structure;
  END IF;
  
  -- Create expense plan
  INSERT INTO expense_plans (
    user_id,
    name,
    total_budget,
    budget_structure,
    start_date,
    end_date,
    status
  ) VALUES (
    p_user_id,
    p_name,
    p_total_budget,
    p_budget_structure,
    p_start_date,
    p_end_date,
    'draft'
  ) RETURNING id INTO v_plan_id;
  
  -- Create buckets
  FOR v_bucket IN SELECT * FROM jsonb_array_elements(p_buckets)
  LOOP
    INSERT INTO expense_buckets (
      expense_plan_id,
      category_id,
      subcategory_id,
      name,
      target_amount,
      order_index
    ) VALUES (
      v_plan_id,
      v_bucket->>'category_id',
      v_bucket->>'subcategory_id',
      v_bucket->>'name',
      (v_bucket->>'target_amount')::numeric,
      COALESCE((v_bucket->>'order_index')::integer, 0)
    ) RETURNING id INTO v_bucket_id;
  END LOOP;
  
  RETURN v_plan_id;
END;
$$;

-- Function to lock funds for expense buckets
CREATE OR REPLACE FUNCTION lock_expense_funds(
  p_user_id uuid,
  p_bucket_locks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock jsonb;
  v_bucket_id uuid;
  v_locked_amount numeric;
  v_unlock_date date;
  v_total_locked numeric := 0;
  v_plan expense_plans%ROWTYPE;
  v_bucket expense_buckets%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Calculate total amount to lock
  FOR v_lock IN SELECT * FROM jsonb_array_elements(p_bucket_locks)
  LOOP
    v_total_locked := v_total_locked + (v_lock->>'locked_amount')::numeric;
  END LOOP;
  
  -- Lock funds in wallet using existing function
  SELECT * INTO v_result FROM lock_funds(p_user_id, v_total_locked);
  
  IF (v_result->>'success')::boolean = false THEN
    RETURN v_result;
  END IF;
  
  -- Create locked funds records for each bucket
  FOR v_lock IN SELECT * FROM jsonb_array_elements(p_bucket_locks)
  LOOP
    v_bucket_id := (v_lock->>'bucket_id')::uuid;
    v_locked_amount := (v_lock->>'locked_amount')::numeric;
    v_unlock_date := (v_lock->>'unlock_date')::date;
    
    -- Get bucket and plan to verify ownership
    SELECT * INTO v_bucket FROM expense_buckets WHERE id = v_bucket_id;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    SELECT * INTO v_plan FROM expense_plans WHERE id = v_bucket.expense_plan_id;
    IF NOT FOUND OR v_plan.user_id != p_user_id THEN
      CONTINUE;
    END IF;
    
    -- Insert locked funds record
    INSERT INTO expense_bucket_locked_funds (
      expense_bucket_id,
      locked_amount,
      unlock_date,
      status
    ) VALUES (
      v_bucket_id,
      v_locked_amount,
      v_unlock_date,
      'locked'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Funds locked successfully',
    'total_locked', v_total_locked
  );
END;
$$;

-- Function to unlock funds when unlock_date arrives (for future cron job)
CREATE OR REPLACE FUNCTION unlock_expired_expense_funds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked_count integer := 0;
  v_locked_fund expense_bucket_locked_funds%ROWTYPE;
  v_bucket expense_buckets%ROWTYPE;
  v_plan expense_plans%ROWTYPE;
BEGIN
  -- Find all locked funds where unlock_date has passed
  FOR v_locked_fund IN 
    SELECT * FROM expense_bucket_locked_funds
    WHERE status = 'locked'
    AND unlock_date <= CURRENT_DATE
  LOOP
    -- Get bucket and plan
    SELECT * INTO v_bucket FROM expense_buckets WHERE id = v_locked_fund.expense_bucket_id;
    SELECT * INTO v_plan FROM expense_plans WHERE id = v_bucket.expense_plan_id;
    
    -- Unlock funds in wallet
    PERFORM unlock_funds(v_plan.user_id, v_locked_fund.locked_amount);
    
    -- Update status
    UPDATE expense_bucket_locked_funds
    SET status = 'unlocked'
    WHERE id = v_locked_fund.id;
    
    v_unlocked_count := v_unlocked_count + 1;
  END LOOP;
  
  RETURN v_unlocked_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_expense_plan_with_buckets TO authenticated;
GRANT EXECUTE ON FUNCTION lock_expense_funds TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_expense_unlock_date TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_expired_expense_funds TO authenticated;

