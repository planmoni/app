# Paystack Payment Verification Fix

## Problem

When funding accounts with Paystack, payments are successful but:
1. Payment Status returns "Verification Failed"
2. Amounts are not being added to the transactions table
3. Amounts are not being added to the available_balance in the database

## Root Causes

1. **Missing Edge Function**: The app calls `/functions/v1/verify-paystack-payment` but this edge function didn't exist, causing verification to fail.

2. **Incomplete Database Function**: The `process_paystack_deposit` function was not updating `available_balance`, only updating `balance`.

3. **No Transaction Creation**: Without the verification function working, successful payments weren't being processed and recorded.

## Solution

### 1. Created Verify Paystack Payment Edge Function

**File**: `supabase/functions/verify-paystack-payment/index.ts`

This function:
- Verifies payments with Paystack API using the transaction reference
- Checks if payment status is 'success'
- Prevents duplicate processing
- Calls `process_paystack_deposit` to atomically:
  - Update wallet balance
  - Update available_balance
  - Create transaction record
  - Create notification event

### 2. Updated process_paystack_deposit Function

**File**: `supabase/migrations/20250120000001_fix_paystack_deposit_available_balance.sql`

The function now:
- Properly calculates and updates `available_balance = balance - locked_balance`
- Ensures atomic processing with duplicate prevention
- Returns detailed results including new_available_balance

### 3. Created Fix Functions for Existing Payments

**File**: `supabase/migrations/20250120000002_fix_missing_paystack_transactions.sql`

Provides functions to:
- `fix_paystack_payment_by_reference()`: Manually process a single payment
- `batch_fix_paystack_payments()`: Batch process multiple payments
- `reprocess_paystack_deposits()`: Reprocess failed/pending transactions

## Deployment Steps

### 1. Deploy the Edge Function

```bash
# Deploy the verify-paystack-payment function
supabase functions deploy verify-paystack-payment
```

### 2. Run Migrations

```bash
# Apply the database migrations
supabase migration up
```

### 3. Fix Existing Payments (Optional)

If you have successful Paystack payments that weren't processed:

#### Option A: Use the batch function

```sql
-- After querying Paystack API for successful payments
SELECT batch_fix_paystack_payments('[
  {
    "user_id": "user-uuid-1",
    "reference": "paystack-ref-1",
    "amount": 1000.00,
    "paystack_data": {
      "paystack_transaction_id": "123456",
      "customer_email": "user@example.com"
    }
  },
  {
    "user_id": "user-uuid-2",
    "reference": "paystack-ref-2",
    "amount": 5000.00
  }
]'::jsonb);
```

#### Option B: Process individually

```sql
SELECT fix_paystack_payment_by_reference(
  'user-uuid'::uuid,
  'paystack-reference',
  amount_in_naira,
  jsonb_build_object(
    'paystack_transaction_id', 'transaction-id',
    'customer_email', 'customer@email.com'
  )
);
```

#### Option C: Reprocess failed transactions

```sql
SELECT reprocess_paystack_deposits();
```

### 4. Verify Wallet Balances

```sql
-- Check for wallets with incorrect available_balance
SELECT 
  w.user_id,
  w.balance,
  w.locked_balance,
  w.available_balance,
  (w.balance - COALESCE(w.locked_balance, 0)) as calculated_available_balance
FROM wallets w
WHERE w.available_balance != (w.balance - COALESCE(w.locked_balance, 0));
```

## Testing

1. **Test New Payment Flow**:
   - Make a Paystack payment through the app
   - Verify it processes correctly
   - Check that:
     - Transaction is created with status 'completed'
     - Wallet balance is updated
     - Available balance is updated correctly
     - Event notification is created

2. **Verify Edge Function**:
   ```bash
   # Test the edge function directly
   curl -X POST https://your-project.supabase.co/functions/v1/verify-paystack-payment \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"reference": "test-reference"}'
   ```

## Key Changes Summary

1. ✅ Created `verify-paystack-payment` edge function
2. ✅ Updated `process_paystack_deposit` to handle `available_balance`
3. ✅ Added functions to fix existing payments
4. ✅ Fixed wallet `available_balance` for all users

## Environment Variables Required

Ensure these are set in your Supabase project:

- `PAYSTACK_LIVE_SECRET_KEY` or `PAYSTACK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Notes

- The edge function uses Deno runtime (TypeScript linter errors are expected)
- All functions use `SECURITY DEFINER` for proper permissions
- Duplicate prevention is built into all processing functions
- The fix maintains data integrity with atomic operations

