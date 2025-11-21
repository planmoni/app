-- Migration: Fix transfer_funds to call allow_wallet_update() before updating wallet
-- This allows transfer_funds to bypass the prevent_direct_wallet_updates trigger

CREATE OR REPLACE FUNCTION transfer_funds(arg_user_id uuid, arg_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  -- Mark this update as allowed (REQUIRED to bypass prevent_direct_wallet_updates trigger)
  PERFORM allow_wallet_update();
  
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
      'error', format('Insufficient locked balance for transfer. Locked: %s, Required: %s', COALESCE(wallet_record.locked_balance, 0), arg_amount)
    );
  END IF;

  -- Transfer funds (reduce both balance and locked_balance)
  UPDATE wallets
  SET balance = COALESCE(balance, 0) - arg_amount,
      locked_balance = COALESCE(locked_balance, 0) - arg_amount,
      updated_at = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success', true,
    'balance', wallet_record.balance,
    'locked_balance', wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Add comment
COMMENT ON FUNCTION transfer_funds(uuid, numeric) IS 
'Transfers funds by reducing both balance and locked_balance. Used for emergency withdrawals and payouts. Calls allow_wallet_update() to bypass the prevent_direct_wallet_updates trigger.';

