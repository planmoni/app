/*
  # Add process_paystack_plan_deposit function
  
  This function processes Paystack deposits directly to expense plans.
  It creates a plan_transaction with type 'manual_topup', which triggers
  automatic updates to plan_wallets.balance and expense_plans.current_balance.
  
  1. New Functions
    - process_paystack_plan_deposit
      - Validates plan exists and belongs to user
      - Checks for duplicate transactions by reference
      - Creates plan_transaction with type 'manual_topup'
      - Creates notification event
      - Returns processing status
  
  2. Ensures required tables exist
    - plan_transactions table (if not already created)
    - plan_wallets table (if not already created)
*/

-- Ensure expense_plans table has current_balance column
ALTER TABLE expense_plans
  ADD COLUMN IF NOT EXISTS current_balance numeric DEFAULT 0 CHECK (current_balance >= 0),
  ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0 CHECK (total_spent >= 0);

-- Ensure events table has metadata column
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Update events type constraint to include deposit_successful
-- First, update any existing rows with invalid types to a valid type
-- This prevents constraint violation when we add the new constraint
UPDATE events
SET type = 'vault_created'
WHERE type IS NOT NULL
  AND type NOT IN (
    'payout_completed',
    'payout_scheduled',
    'vault_created',
    'disbursement_failed',
    'security_alert',
    'deposit_successful'
  );

-- Drop the existing constraint
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_type_check;

-- Add the constraint with all allowed types (including deposit_successful)
ALTER TABLE events
  ADD CONSTRAINT events_type_check
  CHECK (type IN (
    'payout_completed',
    'payout_scheduled',
    'vault_created',
    'disbursement_failed',
    'security_alert',
    'deposit_successful'
  ));

-- Ensure plan_wallets table exists
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

-- Ensure plan_transactions table exists
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_plan_wallets_plan_id ON plan_wallets(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_plan_id ON plan_transactions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_wallet_id ON plan_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_type ON plan_transactions(type);
CREATE INDEX IF NOT EXISTS idx_plan_transactions_created_at ON plan_transactions(created_at);

CREATE OR REPLACE FUNCTION process_paystack_plan_deposit(
  arg_user_id uuid,
  arg_plan_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_paystack_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_user_id uuid;
  v_wallet_id uuid;
  v_transaction_id uuid;
  v_already_processed boolean := false;
  v_current_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Validate input parameters
  IF arg_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF arg_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID is required');
  END IF;
  
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  
  IF arg_reference IS NULL OR arg_reference = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reference is required');
  END IF;
  
  -- Check if transaction already exists (by checking description field for reference)
  SELECT EXISTS(
    SELECT 1 FROM plan_transactions 
    WHERE plan_id = arg_plan_id
    AND type = 'manual_topup'
    AND description LIKE '%' || arg_reference || '%'
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed'
    );
  END IF;
  
  -- Validate plan exists and belongs to user
  SELECT id, user_id INTO v_plan_id, v_plan_user_id
  FROM expense_plans
  WHERE id = arg_plan_id;
  
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;
  
  IF v_plan_user_id != arg_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan does not belong to user');
  END IF;
  
  -- Get or create plan wallet
  SELECT id INTO v_wallet_id
  FROM plan_wallets
  WHERE plan_id = arg_plan_id;
  
  IF v_wallet_id IS NULL THEN
    -- Create wallet if it doesn't exist (shouldn't happen due to trigger, but safety check)
    INSERT INTO plan_wallets (plan_id, balance)
    VALUES (arg_plan_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM plan_wallets
  WHERE id = v_wallet_id;
  
  -- Calculate new balance
  v_new_balance := COALESCE(v_current_balance, 0) + arg_amount;
  
  -- Create plan_transaction with type 'manual_topup'
  -- The trigger will automatically update plan_wallets.balance and expense_plans.current_balance
  INSERT INTO plan_transactions (
    plan_id,
    wallet_id,
    type,
    amount,
    description
  ) VALUES (
    arg_plan_id,
    v_wallet_id,
    'manual_topup',
    arg_amount,
    format('Paystack deposit: %s (Reference: %s)', 
           to_char(arg_amount, 'FM₦999,999,999.00'), 
           arg_reference)
  ) RETURNING id INTO v_transaction_id;
  
  -- Note: Excess funds from over-funded plans are kept in the plan
  -- They are displayed in the "Available to spend" balance on the Plans tab
  -- which sums up all excess funds (current_balance - total_budget) from all plans
  
  -- Create notification event (use 'deposit_successful' as it's an allowed event type)
  -- Note: transaction_id is NULL because plan_transactions are in a different table
  -- The plan_transaction_id is stored in metadata instead
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    transaction_id,
    metadata
  ) VALUES (
    arg_user_id,
    'deposit_successful',
    'Plan Funded',
    format('₦%s has been added to your plan via Paystack', 
           to_char(arg_amount, 'FM999,999,999.00')),
    'unread',
    NULL, -- transaction_id is NULL for plan transactions (they're in plan_transactions table)
    jsonb_build_object(
      'plan_id', arg_plan_id,
      'plan_transaction_id', v_transaction_id,
      'transaction_reference', arg_reference,
      'amount', arg_amount,
      'source', 'Paystack',
      'is_plan_deposit', true
    ) || arg_paystack_data
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'plan_id', arg_plan_id,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'old_balance', COALESCE(v_current_balance, 0),
    'new_balance', v_new_balance,
    'amount_added', arg_amount,
    'message', 'Plan deposit processed successfully'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Transaction was already processed by another concurrent process
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Transaction already processed by another process'
    );
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE LOG 'Error in process_paystack_plan_deposit: %', SQLERRM;
    RAISE;
END;
$$;

-- Ensure trigger function exists to update plan wallet balance
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
    SET current_balance = COALESCE(current_balance, 0) + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  ELSIF NEW.type = 'spending' OR NEW.type = 'withdrawal' THEN
    UPDATE plan_wallets
    SET balance = balance - NEW.amount,
        updated_at = now()
    WHERE id = v_wallet_id;
    
    -- Update plan current_balance and total_spent
    UPDATE expense_plans
    SET current_balance = COALESCE(current_balance, 0) - NEW.amount,
        total_spent = COALESCE(total_spent, 0) + NEW.amount,
        updated_at = now()
    WHERE id = NEW.plan_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists to update wallet balance on transaction
DROP TRIGGER IF EXISTS trigger_update_plan_wallet_balance ON plan_transactions;
CREATE TRIGGER trigger_update_plan_wallet_balance
  AFTER INSERT ON plan_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_wallet_balance();

-- Add comment
COMMENT ON FUNCTION process_paystack_plan_deposit IS 'Processes Paystack deposits directly to expense plans. Creates plan_transaction with type manual_topup, which triggers automatic updates to plan_wallets and expense_plans.current_balance.';

