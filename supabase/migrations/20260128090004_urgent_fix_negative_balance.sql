/*
  # URGENT: Fix negative locked_balance immediately
  
  This migration fixes the corrupted wallet data FIRST before applying other fixes.
  It should be applied immediately to allow users to create plans.
*/

-- Step 1: Fix all wallets with negative locked_balance by setting it to 0
-- This must happen FIRST before any other operations
UPDATE wallets
SET 
  locked_balance = GREATEST(0, locked_balance),
  available_balance = balance - GREATEST(0, locked_balance),
  updated_at = now()
WHERE locked_balance < 0;

-- Step 2: Ensure locked_balance never exceeds balance
UPDATE wallets
SET 
  locked_balance = LEAST(locked_balance, balance),
  available_balance = balance - LEAST(locked_balance, balance),
  updated_at = now()
WHERE locked_balance > balance;
