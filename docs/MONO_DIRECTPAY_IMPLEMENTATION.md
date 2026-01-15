# Mono DirectPay Production Implementation Guide

## Overview

This document describes the complete, production-ready Mono DirectPay integration for customer deposits. The implementation follows fintech security best practices and handles real money transactions.

## Architecture

### Flow Diagram

```
User Initiates Payment
    ↓
Client (useMonoDirectPay hook)
    ↓
Secure Edge Function (mono-api-proxy)
    ↓
Mono LIVE API
    ↓
Payment Authorization (Mono Widget)
    ↓
Mono Webhook (mono-webhook Edge Function)
    ↓
Payment Verification (via Mono API)
    ↓
Atomic Deposit Processing (process_mono_deposit RPC)
    ↓
Wallet Credit + Transaction Record
```

## Security Features

### 1. Server-Side Secret Storage
- ✅ `MONO_SECRET_KEY` stored in Supabase Edge Function secrets only
- ✅ No secret keys exposed to client
- ✅ All API calls go through secure proxy

### 2. Webhook Signature Verification
- ✅ HMAC SHA256 signature verification
- ✅ Constant-time comparison (prevents timing attacks)
- ✅ Rejects unsigned or invalid webhooks

### 3. Idempotency
- ✅ Transaction reference-based duplicate prevention
- ✅ Atomic RPC function prevents double crediting
- ✅ Database-level checks before wallet update

### 4. Payment Verification
- ✅ Webhook handler verifies payment with Mono API before crediting
- ✅ Amount verification (prevents amount tampering)
- ✅ Status verification (only credits successful payments)
- ✅ Client-side claims are NOT trusted

### 5. KYC Level 0 Support
- ✅ Single transaction limit: ₦50,000
- ✅ Daily limit: ₦50,000
- ✅ Velocity checks (prevents rapid deposits)
- ✅ Client and server-side validation

## Components

### 1. Secure Mono API Proxy (`supabase/functions/mono-api-proxy/index.ts`)

**Purpose**: Proxies all Mono API requests, keeping secrets server-side.

**Security Features**:
- User authentication required
- Endpoint validation (prevents SSRF)
- Only allows `/v2/` endpoints
- Blocks dangerous endpoints
- LIVE key validation

**Usage**:
```typescript
POST /functions/v1/mono-api-proxy
Headers: Authorization: Bearer <user_token>
Body: {
  endpoint: '/v2/payments/initiate',
  method: 'POST',
  body: { ... }
}
```

### 2. Mono Webhook Handler (`supabase/functions/mono-webhook/index.ts`)

**Purpose**: Handles Mono webhook events with signature verification (Edge Function).

**Security Features**:
- HMAC SHA256 signature verification
- Payment verification before crediting
- Idempotency checks
- KYC Level 0 limit enforcement
- Service role key for database access

**Webhook Events**:
- `directpay.success` - Payment successful
- `directpay.failed` - Payment failed
- `directpay.pending` - Payment pending (monitor only)

**Webhook URL**: `https://your-project.supabase.co/functions/v1/mono-webhook`

### 3. Secure DirectPay Hook (`hooks/useMonoDirectPay.ts`)

**Purpose**: Client-side hook for initiating DirectPay payments.

**Security Features**:
- Uses secure edge function (no direct API calls)
- KYC Level 0 limit checks
- Amount validation
- User authentication required

**Usage**:
```typescript
const { initiatePayment, checkPaymentStatus } = useMonoDirectPay();

const result = await initiatePayment({
  accountId: 'mono_account_id',
  amount: 5000, // in Naira
  description: 'Deposit'
});
```

### 4. Atomic Deposit Function (`process_mono_deposit` RPC)

**Purpose**: Atomically processes deposits with idempotency.

**Features**:
- Prevents double crediting
- Atomic wallet update + transaction creation
- Event creation for notifications
- Returns processing status

**Usage**:
```sql
SELECT process_mono_deposit(
  'user_id'::uuid,
  5000::numeric,
  'reference'::text,
  '{"mono_payment_id": "..."}'::jsonb
);
```

## Environment Variables

### Required (Supabase Secrets)
```bash
MONO_SECRET_KEY=live_sk_...          # LIVE key only
MONO_WEBHOOK_SECRET=your_webhook_secret
```

### Required (Client)
```bash
EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_...  # Public key (safe to expose)
EXPO_PUBLIC_SUPABASE_URL=...
```

## Deployment Checklist

### Pre-Deployment

- [ ] Set `MONO_SECRET_KEY` in Supabase secrets (LIVE key only)
- [ ] Set `MONO_WEBHOOK_SECRET` in Supabase secrets
- [ ] Verify webhook URL is accessible: `https://your-domain.com/api/mono-webhook`
- [ ] Configure webhook in Mono dashboard
- [ ] Test webhook signature verification
- [ ] Verify `process_mono_deposit` function exists in database
- [ ] Run migration: `20250125000000_add_process_mono_deposit_function.sql`

### Security Verification

- [ ] No `EXPO_PUBLIC_MONO_SECRET_KEY` in codebase
- [ ] All Mono API calls go through edge function
- [ ] Webhook signature verification working
- [ ] Idempotency checks working
- [ ] Payment verification before crediting
- [ ] KYC Level 0 limits enforced

### Testing

- [ ] Test payment initiation
- [ ] Test payment authorization flow
- [ ] Test webhook handling (success)
- [ ] Test webhook handling (failed)
- [ ] Test idempotency (duplicate webhook)
- [ ] Test KYC Level 0 limits
- [ ] Test amount verification
- [ ] Test error handling

## KYC Level 0 Limits

Mono allows deposits for KYC Level 0 users with the following limits:

- **Single Transaction**: ₦50,000 maximum
- **Daily Limit**: ₦50,000 maximum
- **Velocity**: No rapid deposits (enforced by daily limit)

These limits are enforced:
1. Client-side (before API call)
2. Server-side (in webhook handler)

## Error Handling

### Payment Initiation Errors
- Invalid account ID → Error message
- Amount exceeds limit → KYC limit error
- API error → Generic error (don't expose details)

### Webhook Errors
- Invalid signature → Reject (401)
- Payment not verified → Don't credit
- Amount mismatch → Don't credit
- Already processed → Return success (idempotency)

### Transaction Errors
- Database error → Log and alert
- Wallet not found → Error
- Duplicate transaction → Return success (idempotency)

## Monitoring & Logging

### Key Metrics to Monitor
- Payment initiation success rate
- Webhook processing time
- Failed webhook signatures
- Duplicate transaction attempts
- KYC limit violations
- Payment verification failures

### Logging Points
- Payment initiation (client)
- API proxy requests (edge function)
- Webhook receipt (webhook handler)
- Payment verification (webhook handler)
- Deposit processing (RPC function)
- Errors at all levels

## Edge Cases

### 1. Webhook Before Authorization
- Payment is created as "pending"
- Webhook will verify status before crediting
- If not successful, transaction remains pending

### 2. Duplicate Webhooks
- Idempotency check prevents double crediting
- Returns success if already processed

### 3. Payment Verification Failure
- Webhook handler verifies with Mono API
- If verification fails, don't credit wallet
- Log error for investigation

### 4. Network Issues
- Client polls for payment status
- Webhook is primary source of truth
- Manual verification possible via admin

## Production Safety

### ✅ Implemented
- Server-side secret storage
- Webhook signature verification
- Payment verification before crediting
- Idempotency checks
- KYC Level 0 limits
- Atomic deposit processing
- Comprehensive error handling
- HTTPS-only communication

### ⚠️ Additional Recommendations
- Set up monitoring alerts for failed webhooks
- Implement rate limiting on webhook endpoint
- Add IP whitelist for Mono webhooks (if available)
- Set up automated testing for critical paths
- Regular security audits
- Backup webhook processing mechanism

## Support & Troubleshooting

### Common Issues

**Webhook not receiving events**
- Verify webhook URL is accessible
- Check Mono dashboard webhook configuration
- Verify signature secret matches

**Payment not crediting**
- Check webhook logs
- Verify payment status with Mono API
- Check transaction table for errors
- Verify user wallet exists

**Duplicate credits**
- Check idempotency logic
- Verify reference uniqueness
- Review transaction table for duplicates

## References

- [Mono DirectPay Documentation](https://docs.mono.co)
- [Mono Webhook Guide](https://docs.mono.co/webhooks)
- [Mono API Reference](https://docs.mono.co/api-reference)

