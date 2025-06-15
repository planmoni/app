CREATE OR REPLACE FUNCTION lock_funds(p_user_id bigint, p_amount numeric)
RETURNS void AS $$
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
    balance = balance - p_amount, -- Add this line to deduct from available balance
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql;