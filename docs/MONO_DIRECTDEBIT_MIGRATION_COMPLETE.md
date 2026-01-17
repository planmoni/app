# Mono DirectPay → DirectDebit Migration Complete

## ✅ Migration Summary

This document confirms the complete migration from Mono DirectPay to Mono DirectDebit with mandate-based debits.

## 🗑️ Removed DirectPay Code

### Files Deleted
- ✅ `hooks/useMonoDirectPay.ts` - Removed DirectPay hook
- ✅ `docs/MONO_DIRECTPAY_IMPLEMENTATION.md` - Removed DirectPay documentation
- ✅ `docs/MONO_DIRECTPAY_DEPLOYMENT_CHECKLIST.md` - Removed DirectPay checklist

### UI Components Updated
- ✅ `app/deposit-flow/authorization.tsx` - Removed DirectPay widget logic
- ✅ `app/deposit-flow/payment-methods.tsx` - Updated to DirectDebit
- ✅ `app/deposit-flow/amount.tsx` - Updated payment type references
- ✅ `app/deposit-flow/mono-pay.tsx` - Updated comments

## 🆕 New Edge Functions

### 1. `mono-mandate-initiate`
**Purpose**: Initiates a DirectDebit mandate with Mono

**Configuration** (as required):
```typescript
{
  type: "recurring-debit",
  method: "mandate",
  mandate_type: "emandate",
  debit_type: "variable",
  amount: 100000000, // Maximum total debit authorization in kobo (₦1,000,000)
  description: "Wallet funding authorisation"
}
```

**Security Features**:
- User authentication required
- Validates bank account ownership
- Server-side secret key storage
- Returns `mono_url` for user authorization

### 2. `mono-debit-execute`
**Purpose**: Executes a user-initiated debit using an active mandate

**Security Features**:
- User authentication required
- Validates mandate ownership and status
- Ensures debit does not exceed mandate limit
- KYC Level 0 limit checks
- Server-side secret key storage

### 3. `mono-webhook` (Updated)
**Purpose**: Handles Mono webhook events with enhanced security

**Security Enhancements**:
- ✅ HMAC SHA256 signature verification
- ✅ Event ID-based idempotency
- ✅ Mandate & debit ownership validation
- ✅ Only credits wallet after confirmed settlement

**Webhook Events Handled**:
- `mandate.activated` - Mandate authorized and activated
- `mandate.cancelled` - Mandate cancelled by user
- `mandate.expired` - Mandate expired
- `debit.successful` - Debit successful and settled
- `debit.failed` - Debit failed
- `debit.reversed` - Debit reversed

## 🎣 New Custom Hooks (React Query + Axios)

### 1. `useInitiateMandate`
**Purpose**: Initiates a DirectDebit mandate

**Usage**:
```typescript
const { mutate: initiateMandate, isLoading, error } = useInitiateMandate();

initiateMandate({
  bankAccountId: '...',
  monoAccountId: '...',
  accountName: '...',
  accountNumber: '...',
  bankName: '...',
  amount: 1000000 // Maximum authorization in Naira
});
```

### 2. `useFundWallet`
**Purpose**: Executes a user-initiated debit to fund wallet

**Usage**:
```typescript
const { mutate: fundWallet, isLoading, error } = useFundWallet();

fundWallet({
  mandateId: '...',
  amount: 50000, // Amount in Naira
  description: 'Wallet funding'
});
```

### 3. `useMandateStatus`
**Purpose**: Fetches mandate status

**Usage**:
```typescript
const { data: mandate, isLoading } = useMandateStatus(mandateId);
const { data: mandates } = useUserMandates();
```

## 🔐 Security Features

### Backend (Edge Functions)
- ✅ All API calls go through Edge Functions
- ✅ No secret keys exposed to client
- ✅ User authentication required for all operations
- ✅ Mandate ownership validation
- ✅ Webhook signature verification (HMAC SHA256)
- ✅ Event ID-based idempotency
- ✅ Amount verification before crediting
- ✅ Settlement status verification

### Frontend (Custom Hooks)
- ✅ Uses React Query for state management
- ✅ Uses Axios with automatic auth token injection
- ✅ No direct Mono API calls
- ✅ No secret keys in client code
- ✅ Proper error handling and loading states

## 📊 Data Model

### `mono_mandates` Table
Tracks all DirectDebit mandates with:
- `mandate_id` - Internal mandate ID
- `user_id` - User who owns the mandate
- `authorized_limit` - Maximum total debit authorization
- `total_debited` - Total amount debited (tracked via transactions)
- `mandate_status` - Status: pending, active, cancelled, expired, failed
- `debit_reference` - Mandate reference for debits
- `webhook_event_id` - Event ID for idempotency

## 🚫 Explicitly Forbidden

- ❌ Mono DirectPay (completely removed)
- ❌ Expo internal APIs (removed)
- ❌ Signed mandates (using emandate only)
- ❌ GSM mandates (using emandate only)
- ❌ Fixed debit type (using variable only)
- ❌ Automatic or scheduled debits (user-initiated only)

## ✅ Required Configuration

### Mandate Initiation
```typescript
{
  type: "recurring-debit",
  method: "mandate",
  mandate_type: "emandate",
  debit_type: "variable",
  amount: 100000000, // Maximum total debit authorization in kobo
  description: "Wallet funding authorisation"
}
```

### UX Copy (Mandate Consent)
"This allows us to debit your bank account only when you choose to fund your wallet, up to ₦1,000,000 total. You can cancel anytime."

## 📝 Next Steps

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy mono-mandate-initiate
   supabase functions deploy mono-debit-execute
   supabase functions deploy mono-webhook
   ```

2. **Set Environment Variables**:
   - `MONO_SECRET_KEY` (in Supabase Edge Function secrets)
   - `MONO_WEBHOOK_SECRET` (in Supabase Edge Function secrets)

3. **Configure Mono Webhook**:
   - URL: `https://your-project.supabase.co/functions/v1/mono-webhook`
   - Events: `mandate.activated`, `mandate.cancelled`, `mandate.expired`, `debit.successful`, `debit.failed`, `debit.reversed`

4. **Test Migration**:
   - Test mandate creation
   - Test debit execution
   - Test webhook handling
   - Verify idempotency

## ✨ Key Improvements

1. **Better UX**: User authorizes once via mandate, then can fund wallet multiple times
2. **Enhanced Security**: All operations through Edge Functions with proper validation
3. **Idempotency**: Event ID tracking prevents duplicate processing
4. **Settlement-Based**: Only credits wallet after confirmed settlement
5. **Modern Stack**: React Query + Axios for better state management

## 🔍 Verification Checklist

- [x] All DirectPay code removed
- [x] Edge Functions created and configured correctly
- [x] Custom hooks using React Query + Axios
- [x] Webhook handler with signature verification and idempotency
- [x] UI components updated
- [x] No Expo internal APIs
- [x] Correct mandate configuration (emandate, variable)
- [x] Database schema supports mandate tracking

---

**Migration Date**: 2025-01-25
**Status**: ✅ Complete


