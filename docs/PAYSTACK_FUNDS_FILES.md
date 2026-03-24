# Paystack Funds Implementation - File Directory

Complete list of all files involved in the Paystack funds implementation for adding funds to user accounts.

## Directory Structure

```
app-1/
├── app/
│   ├── add-funds.tsx                          # Main entry point - payment method selection
│   ├── add-card.tsx                          # Card payment screen (alternative)
│   ├── add-ussd.tsx                          # USSD payment screen
│   ├── paystack-payment.tsx                  # Main Paystack card payment screen
│   ├── paystack-payment/
│   │   ├── success.tsx                       # Payment success screen
│   │   └── failure.tsx                       # Payment failure screen
│   └── api/
│       ├── paystack-webhook+api.ts           # Main webhook handler
│       ├── fetch-paystack-transactions+api.ts # Transaction fetching API
│       └── paystack-transfer-webhook+api.ts  # Transfer webhook handler
│
├── hooks/
│   ├── useRealtimePaystackAccount.ts         # Real-time Paystack account subscription
│   ├── useUSSD.ts                            # USSD payment hook
│   ├── usePaymentMethods.ts                  # Payment method management
│   └── usePaystackTransactions.ts           # Paystack transaction fetching
│
├── lib/
│   ├── paystack.ts                           # Paystack API utilities
│   ├── paystack-transfers.ts                 # Transfer operations
│   └── paystack-banks.json                   # Bank list and codes
│
├── supabase/
│   ├── functions/
│   │   ├── verify-paystack-payment/
│   │   │   └── index.ts                      # Payment verification edge function
│   │   └── paystack-webhook-updated.ts       # Alternative webhook handler
│   │
│   └── migrations/
│       ├── 20250623000000_paystack_accounts.sql                    # Paystack accounts table
│       ├── 20250101000002_add_process_paystack_deposit_function.sql # Deposit processing function
│       ├── 20250120000001_fix_paystack_deposit_available_balance.sql # Balance fix
│       ├── 20250120000002_fix_missing_paystack_transactions.sql     # Transaction fix
│       └── 20250120000003_add_process_paystack_plan_deposit.sql     # Plan deposit function
│
├── api/
│   └── paystack-tokenize+api.ts             # Card tokenization API
│
├── scripts/
│   ├── test-paystack-webhook.js             # Webhook testing script
│   ├── test-card-payment.js                  # Card payment testing
│   └── test-ussd-availability.js             # USSD availability testing
│
└── docs/
    ├── PAYSTACK_INTEGRATION.md               # General integration guide
    ├── PAYSTACK_WEBHOOK_SETUP.md             # Webhook setup guide
    ├── CARD_PAYMENT_INTEGRATION.md           # Card payment details
    ├── USSD_INTEGRATION.md                   # USSD payment details
    ├── PAYSTACK_PAYMENT_FIX.md               # Bug fixes documentation
    └── PAYSTACK_FUNDS_IMPLEMENTATION.md      # This implementation guide
```

## File Descriptions

### Frontend Screens

| File | Purpose | Key Features |
|------|---------|-------------|
| `app/add-funds.tsx` | Main entry point for adding funds | Payment method selection, routing |
| `app/paystack-payment.tsx` | Card payment via Paystack Checkout | Amount input, payment initialization, verification |
| `app/paystack-payment/success.tsx` | Success screen | Payment confirmation, details display |
| `app/paystack-payment/failure.tsx` | Failure screen | Error display, retry options |
| `app/add-card.tsx` | Alternative card payment | Direct API integration, card saving |
| `app/add-ussd.tsx` | USSD payment screen | Bank selection, USSD code generation, status checking |

### Hooks

| File | Purpose | Key Features |
|------|---------|-------------|
| `hooks/useRealtimePaystackAccount.ts` | Real-time account updates | Supabase subscription, account status |
| `hooks/useUSSD.ts` | USSD payment management | Bank availability, payment init, status check |
| `hooks/usePaymentMethods.ts` | Payment method CRUD | Card storage, default selection |
| `hooks/usePaystackTransactions.ts` | Transaction fetching | Paystack API sync, new transaction processing |

### Libraries

| File | Purpose | Key Features |
|------|---------|-------------|
| `lib/paystack.ts` | Paystack API utilities | Account creation, payment init, reference generation |
| `lib/paystack-transfers.ts` | Transfer operations | Payout processing, transfer management |
| `lib/paystack-banks.json` | Bank data | Bank codes, names, metadata |

### Backend APIs

| File | Purpose | Key Features |
|------|---------|-------------|
| `app/api/paystack-webhook+api.ts` | Main webhook handler | Event processing, signature verification, deposit processing |
| `app/api/fetch-paystack-transactions+api.ts` | Transaction sync | Fetch from Paystack, process new transactions |
| `app/api/paystack-transfer-webhook+api.ts` | Transfer webhooks | Payout processing |
| `api/paystack-tokenize+api.ts` | Card tokenization | Secure card storage |

### Supabase Functions

| File | Purpose | Key Features |
|------|---------|-------------|
| `supabase/functions/verify-paystack-payment/index.ts` | Payment verification | Status check, deposit processing, plan funding |
| `supabase/functions/paystack-webhook-updated.ts` | Alternative webhook | Legacy implementation |

### Database Migrations

| File | Purpose | Key Features |
|------|---------|-------------|
| `20250623000000_paystack_accounts.sql` | Paystack accounts table | Virtual account storage, RLS policies |
| `20250101000002_add_process_paystack_deposit_function.sql` | Deposit processing | Atomic operations, duplicate prevention |
| `20250120000001_fix_paystack_deposit_available_balance.sql` | Balance fix | Available balance calculation |
| `20250120000002_fix_missing_paystack_transactions.sql` | Transaction fix | Data integrity improvements |
| `20250120000003_add_process_paystack_plan_deposit.sql` | Plan deposits | Plan-specific deposit handling |

### Scripts

| File | Purpose | Key Features |
|------|---------|-------------|
| `scripts/test-paystack-webhook.js` | Webhook testing | Simulate webhook events |
| `scripts/test-card-payment.js` | Card payment testing | Payment flow validation |
| `scripts/test-ussd-availability.js` | USSD testing | Bank availability checking |

### Documentation

| File | Purpose |
|------|---------|
| `docs/PAYSTACK_INTEGRATION.md` | General Paystack integration guide |
| `docs/PAYSTACK_WEBHOOK_SETUP.md` | Webhook configuration |
| `docs/CARD_PAYMENT_INTEGRATION.md` | Card payment details |
| `docs/USSD_INTEGRATION.md` | USSD payment implementation |
| `docs/PAYSTACK_PAYMENT_FIX.md` | Bug fixes and troubleshooting |
| `docs/PAYSTACK_FUNDS_IMPLEMENTATION.md` | Complete implementation guide |

## File Count Summary

- **Frontend Screens:** 6 files
- **Hooks:** 4 files
- **Libraries:** 3 files
- **Backend APIs:** 4 files
- **Supabase Functions:** 2 files
- **Database Migrations:** 5 files
- **Scripts:** 3 files
- **Documentation:** 6 files

**Total: 33 files**

## Key Dependencies

### NPM Packages

- `react-native-paystack-webview` - Paystack Checkout integration
- `@supabase/supabase-js` - Supabase client
- `expo-router` - Navigation
- `lucide-react-native` - Icons

### Environment Variables

- `EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY`
- `EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY`
- `EXPO_PUBLIC_PAYSTACK_SECRET_KEY`
- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (optional)

## Quick Reference

### Payment Flow Files

1. **Card Payment:**
   - `app/paystack-payment.tsx` → `supabase/functions/verify-paystack-payment/index.ts` → `app/api/paystack-webhook+api.ts`

2. **USSD Payment:**
   - `app/add-ussd.tsx` → `hooks/useUSSD.ts` → `app/api/paystack-webhook+api.ts`

3. **Virtual Account:**
   - `hooks/useRealtimePaystackAccount.ts` → `app/api/paystack-webhook+api.ts`

### Core Processing Files

- **Webhook Handler:** `app/api/paystack-webhook+api.ts`
- **Deposit Function:** `supabase/migrations/20250101000002_add_process_paystack_deposit_function.sql`
- **Verification:** `supabase/functions/verify-paystack-payment/index.ts`

---

**Last Updated:** January 2025
