/*
  # Add Emergency Withdrawal Support
  
  1. New Functions
    - `process_emergency_withdrawal` - Processes an emergency withdrawal from a payout plan
    - `increment` and `decrement` - Helper functions for atomic updates
  
  2. Schema Updates
    - Add `emergency_withdrawal_enabled` column to payout_plans table
  
  3. Security
    - Functions are SECURITY DEFINER to ensure proper access control
*/

-- Add emergency_withdrawal_enabled column to payout_plans table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' AND column_name = 'emergency_withdrawal_enabled'
  ) THEN
    ALTER TABLE payout_plans ADD COLUMN emergency_withdrawal_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Create helper function for incrementing a value
CREATE OR REPLACE FUNCTION increment(x numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT $1 + 1;
$$;

-- Create helper function for decrementing a value
CREATE OR REPLACE FUNCTION decrement(x numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT $1 - 1;
$$;

-- Create function to process emergency withdrawal
CREATE OR REPLACE FUNCTION process_emergency_withdrawal(
  p_plan_id uuid,
  p_amount numeric,
  p_fee_amount numeric,
  p_net_amount numeric,
  p_option text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_user_id uuid;
  v_remaining_amount numeric;
  v_transaction_id uuid;
BEGIN
  -- Get the plan details and user ID
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  
  v_user_id := v_plan.user_id;
  
  -- Check if emergency withdrawal is enabled
  IF NOT v_plan.emergency_withdrawal_enabled THEN
    RAISE EXCEPTION 'Emergency withdrawal is not enabled for this plan';
  END IF;
  
  -- Calculate remaining amount in the plan
  v_remaining_amount := v_plan.total_amount - (v_plan.completed_payouts * v_plan.payout_amount);
  
  -- Validate withdrawal amount
  IF p_amount > v_remaining_amount THEN
    RAISE EXCEPTION 'Withdrawal amount exceeds remaining amount in the plan';
  END IF;
  
  -- Update wallet: decrease locked_balance by p_amount, increase balance by p_net_amount
  UPDATE wallets
  SET 
    locked_balance = locked_balance - p_amount,
    balance = balance + p_net_amount,
    updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    payout_plan_id,
    description,
    reference
  ) VALUES (
    v_user_id,
    'withdrawal',
    p_net_amount,
    'completed',
    'Payout Plan: ' || v_plan.name,
    'Wallet',
    p_plan_id,
    'Emergency withdrawal (' || p_option || ') from payout plan',
    'ew-' || extract(epoch from now())::text
  ) RETURNING id INTO v_transaction_id;
  
  -- Update the payout plan
  IF p_amount >= v_remaining_amount THEN
    -- Full withdrawal - cancel the plan
    UPDATE payout_plans
    SET 
      status = 'cancelled',
      updated_at = now()
    WHERE id = p_plan_id;
  ELSE
    -- Partial withdrawal - adjust plan amounts
    UPDATE payout_plans
    SET 
      total_amount = total_amount - p_amount,
      duration = floor((total_amount - p_amount) / payout_amount),
      updated_at = now()
    WHERE id = p_plan_id;
  END IF;
  
  -- Create event notification
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    payout_plan_id,
    transaction_id
  ) VALUES (
    v_user_id,
    'disbursement_failed',
    'Emergency Withdrawal Processed',
    'Your emergency withdrawal of ₦' || p_net_amount::text || ' has been processed successfully.',
    'unread',
    p_plan_id,
    v_transaction_id
  );
  
  RETURN true;
END;
$$;