/*
  # Create Budget Plans Table
  
  This migration:
  1. Drops old expense-related tables
  2. Creates a new budget_plans table based on the Budget Plan flow
*/

-- Drop old expense-related tables (in reverse dependency order)
DROP TABLE IF EXISTS expense_transactions CASCADE;
DROP TABLE IF EXISTS expense_bucket_scheduled_withdrawals CASCADE;
DROP TABLE IF EXISTS expense_bucket_withdrawals CASCADE;
DROP TABLE IF EXISTS expense_bucket_locked_funds CASCADE;
DROP TABLE IF EXISTS expense_buckets CASCADE;

-- Create budget_plans table
CREATE TABLE IF NOT EXISTS budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic Information
  name text NOT NULL,
  plan_name text, -- Alias for name (for backward compatibility)
  total_budget numeric NOT NULL CHECK (total_budget > 0),
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  
  -- Categories and Subcategories
  categories jsonb DEFAULT '[]'::jsonb, -- Array of category IDs: ["air_travel", "car_maintenance"]
  subcategories jsonb DEFAULT '[]'::jsonb, -- Array of objects: [{"category_id": "air_travel", "subcategory_id": "flight_tickets"}]
  
  -- Budget Tracking
  current_balance numeric DEFAULT 0 CHECK (current_balance >= 0),
  total_spent numeric DEFAULT 0 CHECK (total_spent >= 0),
  remaining_budget numeric GENERATED ALWAYS AS (total_budget - total_spent) STORED,
  
  -- Funding Configuration
  funding_method text DEFAULT 'manual' CHECK (funding_method IN ('auto', 'manual')),
  
  -- Auto Top-Up Configuration
  auto_topup_enabled boolean DEFAULT false,
  auto_topup_frequency text CHECK (auto_topup_frequency IN ('daily', 'weekly', 'monthly')),
  auto_topup_amount numeric CHECK (auto_topup_amount > 0),
  auto_topup_start_date date,
  auto_topup_end_date date,
  auto_topup_next_date date,
  auto_topup_total_cycles integer CHECK (auto_topup_total_cycles > 0),
  
  -- Start Action Configuration
  start_action text DEFAULT 'wallet' CHECK (start_action IN ('wallet', 'auto_payout')),
  payout_account_id uuid REFERENCES payout_accounts(id) ON DELETE SET NULL,
  payout_account_label text,
  payout_account_bank_name text,
  
  -- Alert Configuration
  alert_at_70_percent boolean DEFAULT false,
  alert_risk_failure boolean DEFAULT false,
  alert_weekly_progress boolean DEFAULT false,
  
  -- Status
  is_paused boolean DEFAULT false,
  
  -- Legacy fields (for backward compatibility during transition)
  payout_schedule text CHECK (payout_schedule IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
  required_per_cycle numeric DEFAULT 0 CHECK (required_per_cycle >= 0),
  required_per_day numeric DEFAULT 0 CHECK (required_per_day >= 0),
  auto_fund_minimum numeric DEFAULT 0 CHECK (auto_fund_minimum >= 0),
  
  -- Metadata for additional flexible data storage
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_plans_user_id ON budget_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_status ON budget_plans(status);
CREATE INDEX IF NOT EXISTS idx_budget_plans_dates ON budget_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_budget_plans_funding_method ON budget_plans(funding_method);
CREATE INDEX IF NOT EXISTS idx_budget_plans_auto_topup ON budget_plans(auto_topup_enabled, auto_topup_next_date) WHERE auto_topup_enabled = true;

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_budget_plans_categories ON budget_plans USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_budget_plans_subcategories ON budget_plans USING GIN (subcategories);
CREATE INDEX IF NOT EXISTS idx_budget_plans_metadata ON budget_plans USING GIN (metadata);

-- Add comments for documentation
COMMENT ON TABLE budget_plans IS 'Main table for budget plans created by users';
COMMENT ON COLUMN budget_plans.categories IS 'Array of category IDs used in this plan. Example: ["air_travel", "car_maintenance"]';
COMMENT ON COLUMN budget_plans.subcategories IS 'Array of objects with category_id and subcategory_id. Example: [{"category_id": "air_travel", "subcategory_id": "flight_tickets"}]';
COMMENT ON COLUMN budget_plans.current_balance IS 'Current available balance in the plan wallet';
COMMENT ON COLUMN budget_plans.total_spent IS 'Total amount spent from this budget plan';
COMMENT ON COLUMN budget_plans.auto_topup_next_date IS 'Next scheduled date for auto top-up';
COMMENT ON COLUMN budget_plans.metadata IS 'Flexible JSONB field for storing additional plan data';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_budget_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trg_update_budget_plans_updated_at ON budget_plans;
CREATE TRIGGER trg_update_budget_plans_updated_at
  BEFORE UPDATE ON budget_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_plans_updated_at();

-- Enable Row Level Security
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view their own budget plans
CREATE POLICY "Users can view their own budget plans"
  ON budget_plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own budget plans
CREATE POLICY "Users can insert their own budget plans"
  ON budget_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own budget plans
CREATE POLICY "Users can update their own budget plans"
  ON budget_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own budget plans
CREATE POLICY "Users can delete their own budget plans"
  ON budget_plans
  FOR DELETE
  USING (auth.uid() = user_id);

