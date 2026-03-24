-- Fix Paystack transaction that was credited with fees included
-- This migration corrects transactions where the full payment amount (including fees) was credited
-- instead of just the amount the user wanted to add

-- Update transaction amount from 1115 to 1000 (for reference PMN-1768591872012-6oi1b7)
UPDATE transactions
SET amount = 1000
WHERE reference = 'PMN-1768591872012-6oi1b7'
  AND amount = 1115;

-- Update wallet balance: deduct 115 (the fee that was incorrectly added)
UPDATE wallets
SET 
  balance = balance - 115,
  updated_at = NOW()
WHERE user_id = '20cc8270-d06c-4e39-9de2-c273e61d1919';

-- Verify the update
SELECT 
  t.id as transaction_id,
  t.reference,
  t.amount as transaction_amount,
  w.balance as wallet_balance,
  w.available_balance,
  t.metadata->'paystack_data'->'metadata'->>'amount_to_credit' as amount_to_credit_from_metadata
FROM transactions t
JOIN wallets w ON w.user_id = t.user_id
WHERE t.reference = 'PMN-1768591872012-6oi1b7';
