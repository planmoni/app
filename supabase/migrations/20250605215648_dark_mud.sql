-- Function to add funds to wallet
CREATE OR REPLACE FUNCTION add_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

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
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    'bank_transfer',
    'wallet',
    'Funds added to wallet'
  );

  -- Create notification event
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status
  ) VALUES (
    p_user_id,
    'vault_created',
    'Funds Added Successfully',
    format('₦%s has been added to your wallet', p_amount::text),
    'unread'
  );
END;
$$;

-- Function to lock funds for payout
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Check if sufficient funds are available
  IF NOT EXISTS (
    SELECT 1 FROM wallets
    WHERE user_id = p_user_id
    AND (balance - locked_balance) >= p_amount
  ) THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- Lock the funds
  UPDATE wallets
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;