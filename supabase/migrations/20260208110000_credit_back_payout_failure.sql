-- RPC to credit back a payout amount to the user's wallet when a SafeHaven (or other) payout
-- is confirmed failed (e.g. 400 "Unable to locate record"). Restores both balance and locked_balance
-- so the user can retry or use funds elsewhere. Idempotent: safe to call multiple times for same payout
-- if we track in metadata (caller should only call once per failed payout).

CREATE OR REPLACE FUNCTION credit_back_payout_failure(
  arg_user_id uuid,
  arg_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_locked numeric;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT id, balance, COALESCE(locked_balance, 0)
  INTO v_wallet_id, v_balance, v_locked
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  PERFORM allow_wallet_update();

  UPDATE wallets
  SET
    balance = balance + arg_amount,
    locked_balance = locked_balance + arg_amount,
    available_balance = GREATEST(0, (balance + arg_amount) - (locked_balance + arg_amount)),
    updated_at = now()
  WHERE user_id = arg_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_balance + arg_amount,
    'new_locked_balance', v_locked + arg_amount,
    'amount_credited', arg_amount
  );
END;
$$;

COMMENT ON FUNCTION credit_back_payout_failure IS 'Credits back a failed payout amount to user wallet (balance + locked_balance). Used when SafeHaven transfer status returns 400 Unable to locate or transfer failed.';

GRANT EXECUTE ON FUNCTION credit_back_payout_failure(uuid, numeric) TO service_role;
