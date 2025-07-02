/*
  # Add Available Balance Column to Wallets Table
  
  1. Schema Updates
    - Add `available_balance` column to wallets table
    - Update functions to properly calculate and store available balance
    - Add constraint to ensure available_balance = balance - locked_balance
  
  2. Functions
    - Update add_funds, lock_funds, unlock_funds, and transfer_funds functions
    - Ensure available_balance is always calculated correctly
*/

-- Add available_balance column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'available_balance'
  ) THEN
    ALTER TABLE wallets ADD COLUMN available_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Update existing wallets to set available_balance = balance - locked_balance
UPDATE wallets
SET available_balance = balance - locked_balance
WHERE true;

-- Add constraint to ensure available_balance = balance - locked_balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallets' AND constraint_name = 'wallets_available_balance_check'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_available_balance_check 
    CHECK (available_balance = balance - locked_balance);
  END IF;
END $$;

-- Create or replace the add_funds function to update available_balance
CREATE OR REPLACE FUNCTION add_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get or create wallet
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id;

  IF NOT FOUND THEN
    -- Create new wallet
    INSERT INTO wallets (user_id, balance, locked_balance, available_balance)
    VALUES (arg_user_id, arg_amount, 0, arg_amount)
    RETURNING * INTO wallet_record;
  ELSE
    -- Update existing wallet
    UPDATE wallets
    SET balance = COALESCE(balance, 0) + arg_amount,
        available_balance = COALESCE(balance, 0) + arg_amount - COALESCE(locked_balance, 0),
        updated_at = now()
    WHERE user_id = arg_user_id
    RETURNING * INTO wallet_record;
  END IF;

  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    arg_user_id,
    'deposit',
    arg_amount,
    'completed',
    'bank_transfer',
    'wallet',
    'Funds added to wallet'
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the lock_funds function to update available_balance
CREATE OR REPLACE FUNCTION lock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient funds available
  IF COALESCE(wallet_record.available_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient available balance. Available: %s, Required: %s', 
                     COALESCE(wallet_record.available_balance, 0), arg_amount)
    );
  END IF;

  -- Lock the funds
  UPDATE wallets
  SET locked_balance = COALESCE(locked_balance, 0) + arg_amount,
      available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) + arg_amount),
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  -- Create transaction record for the locked funds
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    arg_user_id,
    'payout',
    arg_amount,
    'pending',
    'wallet',
    'locked_balance',
    'Funds locked for payout plan'
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the unlock_funds function to update available_balance
CREATE OR REPLACE FUNCTION unlock_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient locked funds
  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient locked balance. Locked: %s, Required: %s', 
                     COALESCE(wallet_record.locked_balance, 0), arg_amount)
    );
  END IF;

  -- Unlock the funds
  UPDATE wallets
  SET locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      available_balance = COALESCE(balance, 0) - (COALESCE(locked_balance, 0) - arg_amount),
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create or replace the transfer_funds function to update available_balance
CREATE OR REPLACE FUNCTION transfer_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Validate input
  IF arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get wallet with row lock
  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Check if sufficient locked funds
  IF COALESCE(wallet_record.locked_balance, 0) < arg_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Insufficient locked balance for transfer. Locked: %s, Required: %s', 
                     COALESCE(wallet_record.locked_balance, 0), arg_amount)
    );
  END IF;

  -- Transfer funds (reduce both balance and locked_balance)
  UPDATE wallets
  SET balance = COALESCE(balance, 0) - arg_amount,
      locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      -- Available balance remains the same since both balance and locked_balance decrease by the same amount
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', wallet_record.available_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update process_payout function to properly handle available_balance
CREATE OR REPLACE FUNCTION process_payout(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_bank_account bank_accounts%ROWTYPE;
  v_transaction_id uuid;
BEGIN
  -- Get the plan details
  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active payout plan not found';
  END IF;
  
  -- Check if it's time for payout
  IF v_plan.next_payout_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payout date has not arrived yet';
  END IF;
  
  -- Get bank account details
  SELECT * INTO v_bank_account FROM bank_accounts WHERE id = v_plan.bank_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account not found';
  END IF;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    payout_plan_id,
    bank_account_id,
    description
  ) VALUES (
    v_plan.user_id,
    'payout',
    v_plan.payout_amount,
    'completed',
    'wallet',
    v_bank_account.bank_name || ' (' || v_bank_account.account_number || ')',
    p_plan_id,
    v_plan.bank_account_id,
    'Automated payout from ' || v_plan.name
  ) RETURNING id INTO v_transaction_id;
  
  -- Update payout plan
  UPDATE payout_plans
  SET 
    completed_payouts = completed_payouts + 1,
    updated_at = now()
  WHERE id = p_plan_id;
  
  -- Update progress and next payout date
  PERFORM update_payout_plan_progress(p_plan_id);
  
  -- Update wallet balance and locked_balance
  -- Decrease both balance and locked_balance by the payout amount
  -- Available balance remains the same since both balance and locked_balance decrease by the same amount
  UPDATE wallets
  SET 
    balance = balance - v_plan.payout_amount,
    locked_balance = locked_balance - v_plan.payout_amount,
    updated_at = now()
  WHERE user_id = v_plan.user_id;
  
  -- Create notification event
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status,
    payout_plan_id,
    transaction_id
  ) VALUES (
    v_plan.user_id,
    'payout_completed',
    'Payout Completed',
    format('₦%s has been sent to your %s account', v_plan.payout_amount::text, v_bank_account.bank_name),
    'unread',
    p_plan_id,
    v_transaction_id
  );
END;
$$;