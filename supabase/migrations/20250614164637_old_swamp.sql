/*
  # Remove status field from bank_accounts table
  
  1. Changes
    - Remove status column from bank_accounts table
    - Update any references to status in functions
  
  2. Rationale
    - Bank accounts don't require verification in this system
    - Simplifies the account management process
*/

-- Check if the status column exists and remove it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'status'
  ) THEN
    ALTER TABLE bank_accounts DROP COLUMN status;
  END IF;
END $$;

-- Update the process_payout function to not reference status
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