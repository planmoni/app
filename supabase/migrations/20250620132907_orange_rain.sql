/*
  # Add Referral Bonus Trigger
  
  1. Trigger Function
    - Create a trigger function to automatically process referral bonuses
    - This will run when a user completes their first payout
  
  2. Trigger
    - Add trigger to transactions table
    - Fires after insert of a completed payout transaction
*/

-- Create trigger function to process referral bonus after first payout
CREATE OR REPLACE FUNCTION trigger_process_referral_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process for completed payout transactions
  IF NEW.type = 'payout' AND NEW.status = 'completed' THEN
    -- Check if this is the user's first completed payout
    IF (
      SELECT COUNT(*) FROM transactions 
      WHERE user_id = NEW.user_id 
      AND type = 'payout' 
      AND status = 'completed'
    ) = 1 THEN
      -- Process referral bonus (default amount is ₦1,000)
      PERFORM process_referral_bonus(NEW.user_id, 1000);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS process_referral_bonus_trigger ON transactions;
CREATE TRIGGER process_referral_bonus_trigger
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_referral_bonus();