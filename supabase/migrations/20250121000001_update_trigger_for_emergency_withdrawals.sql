-- Migration: Update SafeHaven Balance Update Trigger to Handle Emergency Withdrawals
-- This updates the trigger to also process emergency withdrawals and use transfer_funds instead of deduct_locked_funds

CREATE OR REPLACE FUNCTION handle_safehaven_account_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  balance_change numeric;
  payment_ref text;
  automated_payout_record RECORD;
  emergency_withdrawal_record RECORD;
  transaction_record RECORD;
  wallet_update_result jsonb;
  is_success boolean;
  is_failure boolean;
  transfer_status text;
  operation_type text;
BEGIN
  -- Only process if account_balance or book_balance actually changed
  IF OLD.account_balance = NEW.account_balance AND OLD.book_balance = NEW.book_balance THEN
    RETURN NEW;
  END IF;

  -- Calculate balance change (negative means debit/outward transfer)
  balance_change := NEW.account_balance - OLD.account_balance;

  -- Skip if no meaningful change
  IF balance_change = 0 THEN
    RETURN NEW;
  END IF;

  -- Extract payment reference and operation type from metadata if available
  -- IMPORTANT: Only process if this is explicitly marked as a payout or emergency withdrawal operation
  -- This prevents interference with deposit operations (Inwards transfers)
  payment_ref := NULL;
  operation_type := NULL;
  IF NEW.metadata IS NOT NULL THEN
    operation_type := NEW.metadata->>'operation_type';
    -- Only process if this is marked as a payout or emergency withdrawal operation
    -- Skip if it's a deposit or other operation type
    IF operation_type IN ('payout', 'emergency_withdrawal') OR 
       NEW.metadata->>'updated_by' IN ('webhook_success', 'webhook_failed', 'webhook_regular_debit') THEN
      
      payment_ref := NEW.metadata->>'payment_reference';
      IF payment_ref IS NULL THEN
        payment_ref := NEW.metadata->>'transfer_reference';
      END IF;
      IF payment_ref IS NULL THEN
        payment_ref := NEW.metadata->>'reference';
      END IF;
    END IF;
  END IF;

  -- Determine if this is a success or failure based on metadata or balance change
  is_success := false;
  is_failure := false;
  transfer_status := NULL;

  IF NEW.metadata IS NOT NULL THEN
    transfer_status := NEW.metadata->>'transfer_status';
    IF transfer_status = 'Completed' OR transfer_status = 'Success' THEN
      is_success := true;
    ELSIF transfer_status = 'Failed' OR transfer_status = 'Reversed' THEN
      is_failure := true;
    END IF;
  END IF;

  -- If we have a payment reference, try to find matching automated payout or emergency withdrawal
  -- This ensures we only process payout-related balance updates
  IF payment_ref IS NOT NULL THEN
    -- First, check for emergency withdrawal
    IF operation_type = 'emergency_withdrawal' THEN
      SELECT * INTO emergency_withdrawal_record
      FROM emergency_withdrawals
      WHERE reference = payment_ref
        AND user_id = NEW.user_id
      LIMIT 1;

      -- If emergency withdrawal found, process the update
      IF FOUND THEN
        -- Find matching transaction with pending status (type can be 'withdrawal' or 'payout')
        SELECT * INTO transaction_record
        FROM transactions
        WHERE reference = payment_ref
          AND user_id = NEW.user_id
          AND type IN ('withdrawal', 'payout')
          AND status = 'pending'
        LIMIT 1;

        -- If transaction found, update it
        IF FOUND THEN
          -- Determine final status
          IF is_success THEN
            -- Update transaction to completed and set source to safehaven_payout_plan
            UPDATE transactions
            SET 
              status = 'completed',
              source = 'safehaven_payout_plan',
              completed_at = now(),
              updated_at = now(),
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'safehaven_account_balance_updated_at', now(),
                'balance_change', balance_change,
                'emergency_withdrawal_id', emergency_withdrawal_record.id
              )
            WHERE id = transaction_record.id;

            -- Update wallet balance using transfer_funds (reduces both balance and locked_balance)
            -- Use withdrawal_amount (total including fees) from emergency_withdrawals table
            SELECT transfer_funds(NEW.user_id, emergency_withdrawal_record.withdrawal_amount) INTO wallet_update_result;
            
            -- Log to audit
            INSERT INTO safehaven_audit_logs (
              user_id,
              operation_type,
              request_data,
              response_data,
              status,
              safehaven_client_id,
              safehaven_user_id
            ) VALUES (
              NEW.user_id,
              'transaction_completed',
              jsonb_build_object(
                'account_id', NEW.id,
                'account_number', NEW.account_number,
                'payment_reference', payment_ref,
                'balance_change', balance_change,
                'old_balance', OLD.account_balance,
                'new_balance', NEW.account_balance,
                'emergency_withdrawal_id', emergency_withdrawal_record.id
              ),
              jsonb_build_object(
                'transaction_id', transaction_record.id,
                'emergency_withdrawal_id', emergency_withdrawal_record.id,
                'wallet_update_result', wallet_update_result,
                'status', 'completed',
                'source', 'safehaven_payout_plan'
              ),
              'success',
              NEW.client_id,
              NEW.safehaven_account_id
            );

          ELSIF is_failure THEN
            -- Update transaction to failed and set source to safehaven_payout_plan
            UPDATE transactions
            SET 
              status = 'failed',
              source = 'safehaven_payout_plan',
              failed_at = now(),
              updated_at = now(),
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'safehaven_account_balance_updated_at', now(),
                'balance_change', balance_change,
                'emergency_withdrawal_id', emergency_withdrawal_record.id,
                'failure_reason', transfer_status
              )
            WHERE id = transaction_record.id;

            -- Do NOT update wallet on failure
            
            -- Log to audit
            INSERT INTO safehaven_audit_logs (
              user_id,
              operation_type,
              request_data,
              response_data,
              status,
              safehaven_client_id,
              safehaven_user_id
            ) VALUES (
              NEW.user_id,
              'transaction_failed',
              jsonb_build_object(
                'account_id', NEW.id,
                'account_number', NEW.account_number,
                'payment_reference', payment_ref,
                'balance_change', balance_change,
                'old_balance', OLD.account_balance,
                'new_balance', NEW.account_balance,
                'emergency_withdrawal_id', emergency_withdrawal_record.id
              ),
              jsonb_build_object(
                'transaction_id', transaction_record.id,
                'emergency_withdrawal_id', emergency_withdrawal_record.id,
                'status', 'failed',
                'source', 'safehaven_payout_plan',
                'failure_reason', transfer_status
              ),
              'failed',
              NEW.client_id,
              NEW.safehaven_account_id
            );
          END IF;
        END IF;
      END IF;
    ELSE
      -- Handle automated payouts (existing logic)
      -- Find automated payout by payment_reference or transfer_reference
      SELECT * INTO automated_payout_record
      FROM automated_payouts
      WHERE (payment_reference = payment_ref OR transfer_reference = payment_ref)
        AND user_id = NEW.user_id
      LIMIT 1;

      -- If automated payout found, process the update
      IF FOUND THEN
        -- Find matching transaction with pending status
        SELECT * INTO transaction_record
        FROM transactions
        WHERE reference = payment_ref
          AND user_id = NEW.user_id
          AND type = 'payout'
          AND status = 'pending'
        LIMIT 1;

        -- If transaction found, update it
        IF FOUND THEN
          -- Determine final status
          IF is_success THEN
            -- Update transaction to completed and set source to safehaven_payout_plan
            UPDATE transactions
            SET 
              status = 'completed',
              source = 'safehaven_payout_plan',
              completed_at = now(),
              updated_at = now(),
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'safehaven_account_balance_updated_at', now(),
                'balance_change', balance_change,
                'automated_payout_id', automated_payout_record.id
              )
            WHERE id = transaction_record.id;

            -- Update wallet balance (deduct locked funds) - only on success
            -- Use the transaction amount, not the balance change (balance change includes fees)
            SELECT deduct_locked_funds(NEW.user_id, transaction_record.amount) INTO wallet_update_result;
            
            -- Log to audit
            INSERT INTO safehaven_audit_logs (
              user_id,
              operation_type,
              request_data,
              response_data,
              status,
              safehaven_client_id,
              safehaven_user_id
            ) VALUES (
              NEW.user_id,
              'transaction_completed',
              jsonb_build_object(
                'account_id', NEW.id,
                'account_number', NEW.account_number,
                'payment_reference', payment_ref,
                'balance_change', balance_change,
                'old_balance', OLD.account_balance,
                'new_balance', NEW.account_balance
              ),
              jsonb_build_object(
                'transaction_id', transaction_record.id,
                'automated_payout_id', automated_payout_record.id,
                'wallet_update_result', wallet_update_result,
                'status', 'completed',
                'source', 'safehaven_payout_plan'
              ),
              'success',
              NEW.client_id,
              NEW.safehaven_account_id
            );

          ELSIF is_failure THEN
            -- Update transaction to failed and set source to safehaven_payout_plan
            UPDATE transactions
            SET 
              status = 'failed',
              source = 'safehaven_payout_plan',
              failed_at = now(),
              updated_at = now(),
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'safehaven_account_balance_updated_at', now(),
                'balance_change', balance_change,
                'automated_payout_id', automated_payout_record.id,
                'failure_reason', transfer_status
              )
            WHERE id = transaction_record.id;

            -- Do NOT update wallet on failure
            
            -- Log to audit
            INSERT INTO safehaven_audit_logs (
              user_id,
              operation_type,
              request_data,
              response_data,
              status,
              safehaven_client_id,
              safehaven_user_id
            ) VALUES (
              NEW.user_id,
              'transaction_failed',
              jsonb_build_object(
                'account_id', NEW.id,
                'account_number', NEW.account_number,
                'payment_reference', payment_ref,
                'balance_change', balance_change,
                'old_balance', OLD.account_balance,
                'new_balance', NEW.account_balance
              ),
              jsonb_build_object(
                'transaction_id', transaction_record.id,
                'automated_payout_id', automated_payout_record.id,
                'status', 'failed',
                'source', 'safehaven_payout_plan',
                'failure_reason', transfer_status
              ),
              'failed',
              NEW.client_id,
              NEW.safehaven_account_id
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Always log balance update to audit (even if no transaction found)
  INSERT INTO safehaven_audit_logs (
    user_id,
    operation_type,
    request_data,
    response_data,
    status,
    safehaven_client_id,
    safehaven_user_id
  ) VALUES (
    NEW.user_id,
    'account_balance_check',
    jsonb_build_object(
      'account_id', NEW.id,
      'account_number', NEW.account_number,
      'old_account_balance', OLD.account_balance,
      'new_account_balance', NEW.account_balance,
      'old_book_balance', OLD.book_balance,
      'new_book_balance', NEW.book_balance,
      'balance_change', balance_change
    ),
    jsonb_build_object(
      'account_balance', NEW.account_balance,
      'book_balance', NEW.book_balance,
      'payment_reference', payment_ref
    ),
    'success',
    NEW.client_id,
    NEW.safehaven_account_id
  );

  RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION handle_safehaven_account_balance_update() IS 
'Automatically handles wallet and transaction updates when safehaven_accounts balance changes. Updates transactions (including source field), wallets, and logs to audit. Now handles both automated payouts and emergency withdrawals.';

