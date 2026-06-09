-- Inverse of transfer_funds(uuid, numeric): restore balance + locked_balance when an automated
-- payout was debited locally but SafeHaven later reports Failed/Reversed (no money left the user).

CREATE OR REPLACE FUNCTION public.refund_payout_wallet_debit(
  arg_user_id uuid,
  arg_amount  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_record wallets%ROWTYPE;
BEGIN
  IF arg_amount IS NULL OR arg_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM allow_wallet_update();

  SELECT * INTO wallet_record
  FROM wallets
  WHERE user_id = arg_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Same magnitude as transfer_funds, opposite sign on both columns (funds return to locked + balance).
  UPDATE wallets
  SET balance        = COALESCE(balance, 0)        + arg_amount,
      locked_balance = COALESCE(locked_balance, 0) + arg_amount,
      updated_at     = now()
  WHERE user_id = arg_user_id
  RETURNING * INTO wallet_record;

  RETURN jsonb_build_object(
    'success',           true,
    'balance',           wallet_record.balance,
    'locked_balance',    wallet_record.locked_balance,
    'available_balance', COALESCE(wallet_record.balance, 0) - COALESCE(wallet_record.locked_balance, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_payout_wallet_debit(uuid, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.refund_payout_wallet_debit(uuid, numeric) IS
  'Restores wallet after a failed/reversed automated payout: adds arg_amount to both balance and locked_balance (inverse of transfer_funds).';

-- Allow transactions.status = refunded for payout rows reconciled after SafeHaven failure.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
