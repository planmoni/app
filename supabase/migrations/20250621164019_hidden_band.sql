/*
  # Add Referral Transactions Support
  
  1. New Transaction Type
    - Add 'referral_bonus' to the transaction type check constraint
    - This allows tracking of referral bonuses separately from other transaction types
  
  2. Referral Tracking
    - Add 'referred_by' column to profiles table to track who referred each user
    - This enables proper attribution of referral bonuses
  
  3. Functions
    - Create function to process referral bonuses when a user completes their first payout
*/

-- Add 'referral_bonus' to transaction type check constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('deposit', 'payout', 'withdrawal', 'referral_bonus'));

-- Add referred_by column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referred_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Create function to process referral bonus
CREATE OR REPLACE FUNCTION process_referral_bonus(
  p_user_id uuid,
  p_bonus_amount numeric DEFAULT 1000
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Get the referrer ID
  SELECT referred_by INTO v_referrer_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- If no referrer, exit
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if this user has already completed a payout
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE user_id = p_user_id
    AND type = 'payout'
    AND status = 'completed'
  ) THEN
    -- Check if referral bonus has already been paid
    IF EXISTS (
      SELECT 1 FROM transactions
      WHERE user_id = v_referrer_id
      AND type = 'referral_bonus'
      AND description LIKE '%' || p_user_id || '%'
    ) THEN
      -- Bonus already paid, exit
      RETURN;
    END IF;
    
    -- Add bonus to referrer's wallet
    UPDATE wallets
    SET 
      balance = balance + p_bonus_amount,
      updated_at = now()
    WHERE user_id = v_referrer_id;
    
    -- Create transaction record for the bonus
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      status,
      source,
      destination,
      description
    ) VALUES (
      v_referrer_id,
      'referral_bonus',
      p_bonus_amount,
      'completed',
      'referral',
      'wallet',
      'Referral bonus for user ' || p_user_id
    ) RETURNING id INTO v_transaction_id;
    
    -- Create notification event
    INSERT INTO events (
      user_id,
      type,
      title,
      description,
      status
    ) VALUES (
      v_referrer_id,
      'vault_created',
      'Referral Bonus Received',
      format('₦%s referral bonus has been added to your wallet', p_bonus_amount::text),
      'unread'
    );
  END IF;
END;
$$;

-- Create trigger to update referred_by when a user signs up with a referral code
CREATE OR REPLACE FUNCTION update_referred_by()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- If referral_code is provided, find the referrer
  IF NEW.referral_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM profiles
    WHERE referral_code = NEW.referral_code
    LIMIT 1;
    
    -- If referrer found, update referred_by
    IF v_referrer_id IS NOT NULL THEN
      NEW.referred_by := v_referrer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS update_referred_by_trigger ON profiles;
CREATE TRIGGER update_referred_by_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_referred_by();