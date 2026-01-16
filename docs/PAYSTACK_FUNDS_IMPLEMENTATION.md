# Paystack Funds Implementation - Adding Funds to Account

This document provides a comprehensive overview of the Paystack integration for adding funds to user accounts (wallet deposits). This implementation supports multiple payment methods including card payments, USSD, and virtual account transfers.

## Table of Contents

- [Overview](#overview)
- [Architecture & Flow](#architecture--flow)
- [File Structure](#file-structure)
- [Payment Methods](#payment-methods)
- [Database Schema](#database-schema)
- [Webhook Handling](#webhook-handling)
- [Setup Instructions](#setup-instructions)
- [Testing](#testing)

## Overview

The Paystack integration allows users to add funds to their wallet through multiple payment channels:

1. **Card Payments** - Credit/Debit card payments via Paystack Checkout
2. **USSD Payments** - Bank USSD codes for supported banks (GTBank, UBA, Sterling, Zenith)
3. **Virtual Account Transfers** - Bank transfers to dedicated virtual accounts

All payment methods are processed through Paystack's API and webhooks, with automatic balance updates and transaction tracking.

## Architecture & Flow

### High-Level Flow

```
User → Select Payment Method → Initialize Payment → Paystack API → Webhook → Database Update → Balance Refresh
```

### Detailed Flow

1. **User Initiates Payment**
   - User navigates to "Add Funds" screen
   - Selects payment method (Card, USSD, or Bank Transfer)
   - Enters amount

2. **Payment Initialization**
   - Frontend calls Paystack API to initialize payment
   - Paystack returns payment details (authorization URL, USSD code, or virtual account details)
   - Transaction record created in database with `pending` status

3. **Payment Processing**
   - User completes payment on Paystack's platform
   - Paystack processes payment

4. **Webhook Notification**
   - Paystack sends webhook to `/api/paystack-webhook`
   - Webhook signature is verified
   - Payment is processed atomically using `process_paystack_deposit` function

5. **Balance Update**
   - Wallet balance is updated
   - Transaction status changed to `completed`
   - Notification event created
   - Email notification sent (optional)

6. **UI Update**
   - Real-time subscription updates UI
   - User sees updated balance

## File Structure

### Frontend Files

#### Main Screens

- **`app/add-funds.tsx`**
  - Main entry point for adding funds
  - Displays payment method options (Bank Transfer, Paystack)
  - Routes to appropriate payment screens

- **`app/paystack-payment.tsx`**
  - Card payment screen using Paystack Checkout
  - Handles payment initialization and verification
  - Uses `react-native-paystack-webview` for checkout modal
  - Supports both wallet deposits and plan funding

- **`app/paystack-payment/success.tsx`**
  - Success screen after successful payment
  - Displays payment details and confirmation

- **`app/paystack-payment/failure.tsx`**
  - Failure screen for failed/cancelled payments
  - Shows error details and retry options

- **`app/add-card.tsx`**
  - Alternative card payment screen
  - Direct Paystack API integration
  - Supports saving card for future payments
  - Polls payment status after redirect

- **`app/add-ussd.tsx`**
  - USSD payment screen
  - Bank selection and USSD code generation
  - Real-time bank availability checking
  - Payment status verification

#### Hooks

- **`hooks/useRealtimePaystackAccount.ts`**
  - Real-time subscription to Paystack account changes
  - Fetches and updates virtual account details
  - Handles account activation status

- **`hooks/useUSSD.ts`**
  - USSD payment initialization
  - Bank availability checking
  - Payment status verification
  - Handles USSD code generation for supported banks

- **`hooks/usePaymentMethods.ts`**
  - Payment method management
  - Card token storage and retrieval
  - Default payment method selection

- **`hooks/usePaystackTransactions.ts`**
  - Fetches Paystack transaction history
  - Processes new transactions
  - Syncs with local database

#### Libraries

- **`lib/paystack.ts`**
  - Paystack API utilities
  - Titan account creation
  - Payment plan creation
  - Payment initialization helpers
  - Reference generation

- **`lib/paystack-transfers.ts`**
  - Transfer operations
  - Payout processing

- **`lib/paystack-banks.json`**
  - Bank list and codes
  - Bank metadata

### Backend Files

#### API Routes

- **`app/api/paystack-webhook+api.ts`**
  - Main webhook handler for Paystack events
  - Handles `charge.success`, `transfer.success`, `dedicated_account.assigned` events
  - Verifies webhook signatures
  - Processes deposits atomically
  - Handles both wallet deposits and plan funding
  - Sends email notifications

- **`app/api/fetch-paystack-transactions+api.ts`**
  - Fetches transactions from Paystack API
  - Processes new transactions
  - Syncs with local database
  - Prevents duplicate processing

- **`app/api/paystack-transfer-webhook+api.ts`**
  - Handles transfer webhooks
  - Processes payout transactions

- **`api/paystack-tokenize+api.ts`**
  - Card tokenization
  - Secure card storage

#### Supabase Edge Functions

- **`supabase/functions/verify-paystack-payment/index.ts`**
  - Verifies payment status with Paystack
  - Updates transaction records
  - Processes deposits
  - Handles both wallet and plan deposits

- **`supabase/functions/paystack-webhook-updated.ts`**
  - Alternative webhook handler
  - Legacy implementation

### Database Migrations

- **`supabase/migrations/20250623000000_paystack_accounts.sql`**
  - Creates `paystack_accounts` table
  - Stores virtual account details
  - RLS policies for user access

- **`supabase/migrations/20250101000002_add_process_paystack_deposit_function.sql`**
  - Creates `process_paystack_deposit` function
  - Atomic deposit processing
  - Duplicate prevention
  - Wallet balance update
  - Transaction creation
  - Event/notification creation

- **`supabase/migrations/20250120000001_fix_paystack_deposit_available_balance.sql`**
  - Fixes available balance calculation
  - Ensures proper balance tracking

- **`supabase/migrations/20250120000002_fix_missing_paystack_transactions.sql`**
  - Fixes missing transaction records
  - Data integrity improvements

- **`supabase/migrations/20250120000003_add_process_paystack_plan_deposit.sql`**
  - Creates `process_paystack_plan_deposit` function
  - Handles plan-specific deposits
  - Separate from wallet deposits

### Documentation

- **`docs/PAYSTACK_INTEGRATION.md`**
  - General Paystack integration guide
  - Virtual account setup
  - Webhook configuration

- **`docs/PAYSTACK_WEBHOOK_SETUP.md`**
  - Webhook setup instructions
  - Signature verification
  - Event handling

- **`docs/CARD_PAYMENT_INTEGRATION.md`**
  - Card payment implementation details
  - Tokenization process

- **`docs/USSD_INTEGRATION.md`**
  - USSD payment implementation
  - Supported banks
  - Availability checking

- **`docs/PAYSTACK_PAYMENT_FIX.md`**
  - Bug fixes and improvements
  - Troubleshooting guide

### Scripts

- **`scripts/test-paystack-webhook.js`**
  - Webhook testing script
  - Simulates webhook events

- **`scripts/test-card-payment.js`**
  - Card payment testing
  - Payment flow validation

- **`scripts/test-ussd-availability.js`**
  - USSD availability testing
  - Bank service checking

## Payment Methods

### 1. Card Payments

**Files:**
- `app/paystack-payment.tsx`
- `app/add-card.tsx`
- `supabase/functions/verify-paystack-payment/index.ts`

**Flow:**
1. User enters amount
2. Paystack Checkout modal opens
3. User enters card details
4. Payment processed by Paystack
5. Webhook received or payment verified
6. Balance updated

**Features:**
- Secure card processing
- Card tokenization support
- Real-time payment verification
- Success/failure handling

### 2. USSD Payments

**Files:**
- `app/add-ussd.tsx`
- `hooks/useUSSD.ts`

**Supported Banks:**
- GTBank (058) - *737#
- UBA (033) - *919#
- Sterling Bank (232) - *822#
- Zenith Bank (057) - *966#

**Flow:**
1. User selects bank
2. System checks bank availability
3. USSD code generated
4. User dials code on phone
5. Payment completed on phone
6. User verifies payment status
7. Balance updated

**Features:**
- Real-time bank availability checking
- USSD code generation
- Payment status polling
- Automatic balance update

### 3. Virtual Account Transfers

**Files:**
- `app/bank-transfer.tsx` (referenced but not in this implementation)
- `hooks/useRealtimePaystackAccount.ts`
- `app/api/paystack-webhook+api.ts`

**Flow:**
1. User creates virtual account
2. Virtual account details displayed
3. User transfers money from bank
4. Paystack webhook received
5. Balance automatically updated

**Features:**
- Real-time account status updates
- Automatic balance updates
- Transaction tracking
- Email notifications

## Database Schema

### Tables

#### `paystack_accounts`
Stores virtual account information for each user.

```sql
CREATE TABLE paystack_accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  customer_code text UNIQUE,
  account_number text UNIQUE,
  account_name text,
  bank_name text,
  accountId text,
  is_active boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);
```

#### `transactions`
Stores all payment transactions.

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  type text, -- 'deposit', 'withdrawal', etc.
  amount numeric,
  status text, -- 'pending', 'completed', 'failed'
  source text,
  destination text,
  reference text UNIQUE,
  description text,
  metadata jsonb
);
```

#### `wallets`
Stores user wallet balances.

```sql
CREATE TABLE wallets (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  balance numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  updated_at timestamptz
);
```

### Functions

#### `process_paystack_deposit`
Atomically processes Paystack deposits.

**Parameters:**
- `arg_user_id` - User ID
- `arg_amount` - Deposit amount
- `arg_reference` - Transaction reference
- `arg_paystack_data` - Paystack transaction data

**Returns:**
- `success` - Processing status
- `already_processed` - Duplicate flag
- `transaction_id` - Created transaction ID
- `new_balance` - Updated wallet balance

**Features:**
- Duplicate prevention
- Atomic operations
- Automatic balance update
- Transaction creation
- Event/notification creation

## Webhook Handling

### Webhook Endpoint

**URL:** `/api/paystack-webhook`

**Method:** `POST`

**Headers:**
- `x-paystack-signature` - HMAC-SHA512 signature

### Supported Events

#### `charge.success`
Triggered when a payment is successful.

**Processing:**
1. Extract payment details (amount, reference, account number)
2. Identify user (by virtual account or USSD reference)
3. Check if plan funding or wallet deposit
4. Call appropriate processing function
5. Update balance and create transaction

#### `dedicated_account.assigned`
Triggered when a virtual account is assigned.

**Processing:**
1. Extract account details
2. Find user by customer code
3. Update `paystack_accounts` table
4. Set account as active

#### `transfer.success`
Triggered when a transfer is successful.

**Processing:**
1. Extract transfer details
2. Find user by account number
3. Create transaction record
4. Update balance if needed

### Signature Verification

```typescript
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
```

## Setup Instructions

### 1. Environment Variables

Add to `.env`:

```bash
# Paystack API Keys
EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
EXPO_PUBLIC_PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx

# Webhook Secret
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Email (optional)
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 2. Database Migrations

Run migrations:

```bash
npx supabase db push
```

Or apply manually:
- `20250623000000_paystack_accounts.sql`
- `20250101000002_add_process_paystack_deposit_function.sql`
- `20250120000003_add_process_paystack_plan_deposit.sql`

### 3. Webhook Configuration

#### Development (ngrok)

1. Install ngrok: `npm install -g ngrok`
2. Start dev server: `npm run dev`
3. Run ngrok: `ngrok http 3000`
4. Copy ngrok URL
5. Configure in Paystack dashboard: `https://your-ngrok-url.ngrok.io/api/paystack-webhook`

#### Production

1. Deploy your app
2. Configure webhook URL in Paystack dashboard: `https://yourdomain.com/api/paystack-webhook`
3. Add webhook secret to environment variables

### 4. Paystack Dashboard Setup

1. Log in to Paystack dashboard
2. Go to Settings > Webhooks
3. Add webhook URL
4. Select events:
   - `charge.success`
   - `dedicated_account.assigned`
   - `transfer.success`
5. Copy webhook secret to environment variables

### 5. Install Dependencies

```bash
npm install react-native-paystack-webview
# or
yarn add react-native-paystack-webview
```

## Testing

### Test Card Payments

1. Use test card: `4084084084084081`
2. CVV: Any 3 digits
3. Expiry: Any future date
4. PIN: Any 4 digits
5. OTP: `123456`

### Test USSD Payments

1. Select supported bank (GTBank recommended)
2. Check bank availability
3. Initialize payment
4. Use test USSD code (if available)
5. Verify payment status

### Test Webhooks

Use the test script:

```bash
node scripts/test-paystack-webhook.js
```

Or use Paystack's webhook testing tool in the dashboard.

### Test Virtual Accounts

1. Create virtual account for user
2. Transfer test amount
3. Verify webhook received
4. Check balance updated
5. Verify transaction created

## Error Handling

### Common Errors

1. **Webhook Signature Mismatch**
   - Check `PAYSTACK_WEBHOOK_SECRET` is correct
   - Verify webhook URL is correct
   - Check payload format

2. **Payment Verification Failed**
   - Check Paystack API keys
   - Verify transaction reference
   - Check network connectivity

3. **Duplicate Transaction**
   - Already handled by `process_paystack_deposit`
   - Check transaction reference uniqueness
   - Verify webhook idempotency

4. **Balance Not Updated**
   - Check `process_paystack_deposit` function
   - Verify wallet exists
   - Check transaction status

## Security Considerations

1. **Webhook Signature Verification**
   - Always verify webhook signatures
   - Never trust unverified webhooks
   - Use secure webhook secret

2. **API Key Protection**
   - Never expose secret keys in frontend
   - Use environment variables
   - Rotate keys regularly

3. **Transaction Validation**
   - Verify amounts match
   - Check user authorization
   - Validate references

4. **Duplicate Prevention**
   - Use unique transaction references
   - Check for existing transactions
   - Implement idempotency

## Monitoring & Logging

### Key Metrics to Monitor

1. Payment success rate
2. Webhook delivery rate
3. Average processing time
4. Failed transaction count
5. Duplicate transaction attempts

### Logging

All critical operations are logged:
- Payment initialization
- Webhook reception
- Deposit processing
- Error conditions

Check logs for:
- `app/api/paystack-webhook+api.ts` - Webhook logs
- `supabase/functions/verify-paystack-payment/index.ts` - Verification logs
- Browser console - Frontend logs

## Support & Troubleshooting

### Common Issues

1. **Payment not processing**
   - Check Paystack dashboard for transaction status
   - Verify webhook is configured correctly
   - Check API keys are valid

2. **Balance not updating**
   - Verify webhook is being received
   - Check `process_paystack_deposit` function
   - Verify transaction was created

3. **USSD not available**
   - Check bank availability
   - Verify bank code is correct
   - Check Paystack service status

### Getting Help

1. Check Paystack documentation: https://paystack.com/docs
2. Review error logs
3. Test with Paystack test mode
4. Contact Paystack support if needed

## Future Enhancements

Potential improvements:

1. **Payment Retry Logic**
   - Automatic retry for failed payments
   - Exponential backoff
   - Maximum retry limits

2. **Payment Scheduling**
   - Recurring deposits
   - Scheduled transfers
   - Auto-top-up

3. **Enhanced Notifications**
   - Push notifications
   - SMS notifications
   - In-app notifications

4. **Analytics**
   - Payment analytics dashboard
   - Success rate tracking
   - Revenue reporting

5. **Multi-currency Support**
   - Support for other currencies
   - Currency conversion
   - Exchange rate handling

---

**Last Updated:** January 2025
**Version:** 1.0.0
