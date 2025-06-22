/*
  # Add Email Notification Settings to Profiles Table
  
  1. Changes
    - Add email_notifications column to profiles table
    - This column will store user preferences for email notifications
  
  2. Rationale
    - Store user preferences for different types of email notifications
    - Allow users to customize their notification experience
*/

-- Add email_notifications column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_notifications jsonb DEFAULT jsonb_build_object(
      'login_alerts', true,
      'payout_alerts', true,
      'expiry_reminders', true,
      'wallet_summary', 'weekly'
    );
  END IF;
END $$;

-- Create function to send email notifications for payouts
CREATE OR REPLACE FUNCTION notify_payout_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_plan_name text;
  v_bank_account_id uuid;
  v_bank_name text;
  v_account_number text;
  v_account_name text;
  v_next_payout_date date;
  v_email text;
  v_first_name text;
  v_notifications jsonb;
BEGIN
  -- Get transaction details
  SELECT user_id, payout_plan_id, bank_account_id INTO v_user_id, v_plan_name, v_bank_account_id
  FROM transactions
  WHERE id = NEW.id;
  
  -- Get plan details
  SELECT name, next_payout_date INTO v_plan_name, v_next_payout_date
  FROM payout_plans
  WHERE id = v_plan_name;
  
  -- Get bank account details
  SELECT bank_name, account_number, account_name INTO v_bank_name, v_account_number, v_account_name
  FROM bank_accounts
  WHERE id = v_bank_account_id;
  
  -- Get user email and notification preferences
  SELECT email, first_name, email_notifications INTO v_email, v_first_name, v_notifications
  FROM profiles
  WHERE id = v_user_id;
  
  -- Check if payout notifications are enabled
  IF v_notifications->>'payout_alerts' = 'true' THEN
    -- In a real implementation, this would call an external email service
    -- For now, we'll just log the notification
    RAISE NOTICE 'Sending payout notification email to %: Amount: %, Plan: %, Bank: %, Account: %',
      v_email, NEW.amount, v_plan_name, v_bank_name, v_account_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payout notifications
DROP TRIGGER IF EXISTS payout_notification_trigger ON transactions;
CREATE TRIGGER payout_notification_trigger
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.type = 'payout' AND NEW.status = 'completed')
  EXECUTE FUNCTION notify_payout_completed();

-- Create function to send email notifications for plan expiry
CREATE OR REPLACE FUNCTION check_plan_expiry()
RETURNS void AS $$
DECLARE
  v_plan RECORD;
  v_user_id uuid;
  v_email text;
  v_first_name text;
  v_notifications jsonb;
BEGIN
  -- Find plans that are about to expire (7 days or less remaining)
  FOR v_plan IN
    SELECT 
      p.id, 
      p.user_id, 
      p.name, 
      p.total_amount, 
      p.payout_amount, 
      p.duration, 
      p.completed_payouts,
      p.next_payout_date,
      (p.duration - p.completed_payouts) AS remaining_payouts,
      profiles.email,
      profiles.first_name,
      profiles.email_notifications
    FROM payout_plans p
    JOIN profiles ON p.user_id = profiles.id
    WHERE 
      p.status = 'active' AND
      p.next_payout_date IS NOT NULL AND
      (p.duration - p.completed_payouts) <= 3 AND
      (profiles.email_notifications->>'expiry_reminders')::boolean = true
  LOOP
    -- In a real implementation, this would call an external email service
    -- For now, we'll just log the notification
    RAISE NOTICE 'Sending plan expiry notification email to %: Plan: %, Remaining Payouts: %',
      v_plan.email, v_plan.name, v_plan.remaining_payouts;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to send wallet summary emails
CREATE OR REPLACE FUNCTION send_wallet_summaries(p_period text)
RETURNS void AS $$
DECLARE
  v_user RECORD;
  v_transactions RECORD;
  v_wallet RECORD;
BEGIN
  -- Find users who have opted for this period's summary
  FOR v_user IN
    SELECT 
      id, 
      email, 
      first_name
    FROM profiles
    WHERE 
      (email_notifications->>'wallet_summary')::text = p_period
  LOOP
    -- Get wallet details
    SELECT 
      balance, 
      locked_balance, 
      (balance - locked_balance) AS available_balance
    INTO v_wallet
    FROM wallets
    WHERE user_id = v_user.id;
    
    -- In a real implementation, this would call an external email service
    -- For now, we'll just log the notification
    RAISE NOTICE 'Sending % wallet summary email to %: Balance: %, Locked: %, Available: %',
      p_period, v_user.email, v_wallet.balance, v_wallet.locked_balance, v_wallet.available_balance;
  END LOOP;
END;
$$ LANGUAGE plpgsql;