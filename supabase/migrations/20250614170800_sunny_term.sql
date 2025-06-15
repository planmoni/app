/*
  # Create Separate Payout Accounts Table
  
  1. New Tables
    - `payout_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `account_name` (text)
      - `account_number` (text)
      - `bank_name` (text)
      - `is_default` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    
  3. Changes
    - Update payout_plans to reference payout_accounts instead of bank_accounts
    - Update process_payout function to use payout_accounts
*/

-- Create payout_accounts table
CREATE TABLE IF NOT EXISTS payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payout_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own payout accounts"
  ON payout_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payout accounts"
  ON payout_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payout accounts"
  ON payout_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payout accounts"
  ON payout_accounts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user_default ON payout_accounts(user_id, is_default);

-- Add trigger to update updated_at
CREATE TRIGGER update_payout_accounts_updated_at
  BEFORE UPDATE ON payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add payout_account_id to payout_plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_plans' AND column_name = 'payout_account_id'
  ) THEN
    ALTER TABLE payout_plans ADD COLUMN payout_account_id uuid REFERENCES payout_accounts(id);
  END IF;
END $$;

-- Update process_payout function to use payout_accounts
CREATE OR REPLACE FUNCTION process_payout(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_payout_account payout_accounts%ROWTYPE;
  v_bank_account bank_accounts%ROWTYPE;
  v_transaction_id uuid;
  v_account_info text;
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
  
  -- Try to get payout account details first
  SELECT * INTO v_payout_account FROM payout_accounts 
  WHERE id = v_plan.payout_account_id;
  
  -- If payout account exists, use it
  IF FOUND THEN
    v_account_info := v_payout_account.bank_name || ' (' || v_payout_account.account_number || ')';
  ELSE
    -- Fall back to bank account if payout_account_id is null or not found
    SELECT * INTO v_bank_account FROM bank_accounts 
    WHERE id = v_plan.bank_account_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No valid payout destination found';
    END IF;
    
    v_account_info := v_bank_account.bank_name || ' (' || v_bank_account.account_number || ')';
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
    v_account_info,
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
    format('₦%s has been sent to your account', v_plan.payout_amount::text),
    'unread',
    p_plan_id,
    v_transaction_id
  );
END;
$$;