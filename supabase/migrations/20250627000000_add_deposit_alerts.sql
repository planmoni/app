/*
  # Add Deposit Alerts to Email Notification Settings
  
  1. Changes
    - Add deposit_alerts field to email_notifications column in profiles table
    - This allows users to control whether they receive email notifications for new deposits
  
  2. Rationale
    - Users should be able to control deposit notifications separately from other notifications
    - Provides granular control over email preferences
*/

-- Update existing email_notifications to include deposit_alerts
UPDATE profiles 
SET email_notifications = COALESCE(email_notifications, '{}'::jsonb) || 
    jsonb_build_object('deposit_alerts', true)
WHERE email_notifications IS NULL 
   OR NOT (email_notifications ? 'deposit_alerts');

-- Create a function to ensure deposit_alerts is always present
CREATE OR REPLACE FUNCTION ensure_deposit_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure deposit_alerts field exists in email_notifications
  IF NEW.email_notifications IS NULL THEN
    NEW.email_notifications := jsonb_build_object(
      'login_alerts', true,
      'payout_alerts', true,
      'expiry_reminders', true,
      'wallet_summary', 'weekly',
      'deposit_alerts', true
    );
  ELSIF NOT (NEW.email_notifications ? 'deposit_alerts') THEN
    NEW.email_notifications := NEW.email_notifications || jsonb_build_object('deposit_alerts', true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure deposit_alerts is always present
DROP TRIGGER IF EXISTS ensure_deposit_alerts_trigger ON profiles;
CREATE TRIGGER ensure_deposit_alerts_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_deposit_alerts(); 