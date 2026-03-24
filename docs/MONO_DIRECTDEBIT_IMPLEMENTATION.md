# Mono DirectDebit Production Implementation Guide

## CRITICAL: DirectDebit vs DirectPay

### Why DirectPay Failed for This Use Case

**DirectPay Limitations:**
- Requires user authorization for **every single payment**
- Not suitable for recurring deposits or wallet top-ups
- Poor user experience for frequent transactions
- Each payment requires separate Mono widget authorization

**Why DirectDebit is Required:**
- User authorizes **once** via mandate creation
- Multiple debits can be initiated using the same mandate
- Better UX for recurring deposits
- Suitable for wallet top-ups and subscription payments
- Mandates can be reused until cancelled or expired

### Key Architectural Changes

1. **Mandate Management System**
   - New `mono_mandates` table to track mandates
   - Mandate lifecycle: `pending` → `active` → `cancelled`/`expired`
   - One active mandate per bank account

2. **Debit Initiation Flow**
   - Debits use mandate reference (not account ID)
   - Debits can be initiated programmatically (no widget needed)
   - Debits settle in 1-3 business days

3. **Settlement-Based Crediting**
   - **CRITICAL**: Only credit wallet when debit is `successful` AND `settled`
   - DirectDebit debits may be successful but not yet settled
   - Webhook handler checks settlement status before crediting

4. **Webhook Events**
   - `mandate.activated` - Mandate authorized and ready
   - `mandate.cancelled` - Mandate cancelled by user
   - `debit.successful` - Debit successful (may not be settled yet)
   - `debit.failed` - Debit failed
   - `debit.reversed` - Debit reversed (requires wallet reversal)

## DirectDebit Flow (Authoritative)

### 1. Bank Account Linking / Mandate Creation

```typescript
// User links bank account via Mono Connect
// After linking, create a DirectDebit mandate
const mandate = await createMandate({
  bankAccountId: 'bank_account_id',
  monoAccountId: 'mono_account_id',
  accountName: 'John Doe',
  accountNumber: '1234567890',
  bankName: 'Access Bank',
});
```

**What Happens:**
- Mandate record created in database (status: `pending`)
- Mono API call to create mandate
- Mandate reference generated
- User needs to authorize mandate via Mono widget

### 2. User Consent & Authorization

```typescript
// User authorizes mandate via Mono Connect widget
// Widget opens with mandate_id in data
<MonoProvider
  publicKey={MONO_PUBLIC_KEY}
  scope="payments"
  data={{ mandate_id: mandate.mono_mandate_id }}
  onSuccess={() => {
    // Mandate authorized - webhook will update status to 'active'
  }}
/>
```

**What Happens:**
- User sees mandate authorization screen
- User provides consent for recurring debits
- Mono processes authorization
- Webhook `mandate.activated` received
- Mandate status updated to `active`

### 3. Mandate Verification & Activation

**Webhook Handler:**
```typescript
// When mandate.activated webhook received:
- Verify webhook signature
- Update mandate status to 'active'
- Set activated_at timestamp
- Mandate is now ready for debits
```

**Mandate States:**
- `pending` - Created, awaiting authorization
- `active` - Authorized, ready for debits
- `cancelled` - Cancelled by user
- `expired` - Mandate expired
- `failed` - Authorization failed

### 4. Debit Initiation

```typescript
// Initiate debit using active mandate
const debit = await initiateDebit({
  mandateId: mandate.id,
  amount: 5000, // ₦5,000
  description: 'Wallet top-up',
});
```

**What Happens:**
- Verify mandate is `active`
- Check KYC Level 0 limits
- Call Mono API to initiate debit
- Create pending transaction record
- Debit status: `pending` → `processing` → `successful` → `settled`

### 5. Debit Status Tracking

**Debit Statuses:**
- `pending` - Debit initiated, awaiting processing
- `processing` - Debit being processed by bank
- `successful` - Debit successful (may not be settled yet)
- `failed` - Debit failed
- `reversed` - Debit reversed

**CRITICAL**: Only credit wallet when status is `successful` AND `settled = true`

### 6. Settlement Confirmation

**Webhook Handler Logic:**
```typescript
// When debit.successful webhook received:
1. Verify webhook signature
2. Check if debit is settled (settled === true)
3. If not settled: Update transaction status, don't credit wallet
4. If settled: Verify with Mono API
5. Verify amount matches
6. Process deposit atomically (process_mono_deposit)
7. Credit wallet balance
```

**Settlement Timeline:**
- Debits typically settle in 1-3 business days
- Settlement status checked via Mono API
- Wallet credited only after confirmed settlement

## Deposits via DirectDebit

### Implementation

1. **Mandate Required**
   - User must have active mandate before debiting
   - One mandate per bank account
   - Mandate can be reused for multiple debits

2. **Debit Initiation**
   - Use `useMonoDirectDebit` hook
   - Pass mandate ID (not account ID)
   - Amount in Naira (converted to kobo internally)

3. **Status Tracking**
   - Transaction status: `pending` → `completed`
   - Debit status tracked in transaction metadata
   - Polling available for status checks

4. **Wallet Crediting**
   - Only after confirmed settlement
   - Atomic processing prevents double crediting
   - Idempotency checks by reference

### Handling Different Debit States

**Pending Debits:**
- Transaction status: `pending`
- Wallet not credited
- Monitor for settlement

**Successful but Not Settled:**
- Transaction status: `pending`
- Wallet not credited
- Wait for settlement webhook

**Settled Debits:**
- Transaction status: `completed`
- Wallet credited
- Balance updated

**Failed Debits:**
- Transaction status: `failed`
- Wallet not credited
- User notified

**Reversed Debits:**
- If already credited: Reverse wallet credit
- Transaction status: `reversed`
- Balance adjusted

## KYC Level 0 Constraints

### What KYC 0 Users CAN Do

✅ Create DirectDebit mandates
✅ Initiate debits up to ₦50,000 per transaction
✅ Debit up to ₦50,000 per day
✅ Debit up to ₦200,000 per week (cumulative)

### What KYC 0 Users CANNOT Do

❌ Debit more than ₦50,000 in a single transaction
❌ Debit more than ₦50,000 per day
❌ Debit more than ₦200,000 per week

### Limits Enforcement

**Server-Side Enforcement (Non-Negotiable):**
```typescript
// In webhook handler and debit initiation:
- Check KYC tier from database
- Enforce single transaction limit: ₦50,000
- Enforce daily limit: ₦50,000
- Enforce weekly limit: ₦200,000
- Reject debits exceeding limits
```

**Client-Side Validation (UX Only):**
- Show limits to user
- Prevent form submission if limit exceeded
- Display helpful error messages

**CRITICAL**: Client-side checks are for UX only. Server-side enforcement is mandatory.

## Security & Compliance

### 1. Webhook Signature Verification

```typescript
// HMAC SHA256 signature verification
// Constant-time comparison prevents timing attacks
// Rejects unsigned or invalid webhooks
```

### 2. Idempotency on Debit Requests

```typescript
// Unique reference per debit
// Database-level duplicate prevention
// Atomic processing prevents double crediting
```

### 3. Prevent Duplicate Mandate Usage

```typescript
// One active mandate per bank account
// Database constraint: unique_active_mandate_per_account
// Check mandate status before debit initiation
```

### 4. Validate User Ownership

```typescript
// Verify user_id matches mandate owner
// Verify bank_account_id belongs to user
// RLS policies enforce data isolation
```

### 5. Secrets in Environment Variables

```bash
# Supabase secrets (server-side only)
MONO_SECRET_KEY=live_sk_...
MONO_WEBHOOK_SECRET=webhook_secret

# Client environment (public key only)
EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_...
```

### 6. No Client-Side Trust

```typescript
// Webhook handler verifies debit with Mono API
// Amount verification before crediting
// Status verification (only credit if settled)
// Client claims are NEVER trusted
```

## Steps Faced (Deployment Checklist)

### Pre-Deployment Requirements

1. **Mono Dashboard Configuration**
   - [ ] Request DirectDebit access (may require approval)
   - [ ] Enable DirectDebit in app settings
   - [ ] Verify LIVE API keys (not sandbox)
   - [ ] Configure webhook URL: `https://[project].supabase.co/functions/v1/mono-webhook`
   - [ ] Set webhook events: `mandate.*`, `debit.*`
   - [ ] Copy webhook secret

2. **Database Setup**
   - [ ] Run migration: `20250125000001_add_mono_mandates_table.sql`
   - [ ] Verify `mono_mandates` table created
   - [ ] Verify RLS policies active
   - [ ] Test mandate creation

3. **Edge Functions**
   - [ ] Deploy `mono-api-proxy` function
   - [ ] Deploy `mono-webhook` function
   - [ ] Set secrets: `MONO_SECRET_KEY`, `MONO_WEBHOOK_SECRET`
   - [ ] Test webhook signature verification

4. **Client Configuration**
   - [ ] Set `EXPO_PUBLIC_MONO_PUBLIC_KEY` (LIVE key)
   - [ ] Update hooks to use DirectDebit
   - [ ] Update UI for mandate flow

### Technical Blockers Encountered

1. **Mono API Documentation**
   - DirectDebit API docs less clear than DirectPay
   - Mandate creation endpoint: `/v2/mandates`
   - Debit initiation endpoint: `/v2/debits`
   - Settlement status in debit response

2. **Settlement Timing**
   - Debits may be `successful` but not `settled`
   - Must check `settled` flag before crediting
   - Settlement can take 1-3 business days

3. **Mandate State Management**
   - Mandate must be `active` before debits
   - Handle mandate cancellation gracefully
   - Prevent debits on cancelled mandates

### Compliance & Approval Delays

1. **Mono DirectDebit Access**
   - May require business verification
   - Compliance review for recurring debits
   - Approval process can take 1-2 weeks

2. **Bank-Level Restrictions**
   - Some banks have additional restrictions
   - Mandate authorization may require additional verification
   - Debit limits may vary by bank

### API Limitations & Unclear Behaviors

1. **Settlement Status**
   - `settled` flag may not be immediately available
   - Must poll or wait for webhook
   - Settlement webhook may arrive before status update

2. **Mandate Expiry**
   - Mandate expiry not always clear
   - Handle expired mandates gracefully
   - Prompt user to re-authorize if expired

3. **Debit Retries**
   - Failed debits may be retried automatically
   - Handle retry webhooks
   - Prevent duplicate processing

### Mono-Side Dependencies

1. **Webhook Delivery**
   - Webhooks may be delayed
   - Implement retry logic
   - Monitor webhook delivery

2. **Manual Reviews**
   - Large debits may require manual review
   - Mandate creation may be reviewed
   - Contact Mono support for issues

## Differences from DirectPay

### Architecture Changes

| Aspect | DirectPay | DirectDebit |
|--------|-----------|-------------|
| Authorization | Per payment | Once (mandate) |
| Widget Required | Every payment | Only for mandate |
| Settlement | Instant | 1-3 business days |
| Reusability | No | Yes (mandate) |
| Use Case | One-time payments | Recurring payments |

### Code Changes

1. **Hooks**
   - `useMonoDirectPay` → `useMonoDirectDebit`
   - Mandate management functions added
   - Debit initiation uses mandate reference

2. **Webhook Handler**
   - Handles mandate events
   - Checks settlement status
   - Handles reversals

3. **Database Schema**
   - New `mono_mandates` table
   - Mandate status tracking
   - One active mandate per account

### User Experience Changes

1. **First Time**
   - User creates mandate (one-time)
   - Authorizes via Mono widget
   - Mandate becomes active

2. **Subsequent Debits**
   - No widget needed
   - Direct debit initiation
   - Faster user experience

## Deployment Checklist

### Environment Variables

```bash
# Supabase Secrets
supabase secrets set MONO_SECRET_KEY=live_sk_...
supabase secrets set MONO_WEBHOOK_SECRET=webhook_secret

# Client Environment
EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_...
```

### Database Migrations

```bash
# Run migrations
supabase migration up

# Verify tables
supabase db inspect
```

### Edge Functions

```bash
# Deploy functions
supabase functions deploy mono-api-proxy
supabase functions deploy mono-webhook

# Test webhook
curl -X POST https://[project].supabase.co/functions/v1/mono-webhook \
  -H "x-mono-signature: test" \
  -d '{"type":"test"}'
```

### Mono Dashboard

1. Go to Settings → Webhooks
2. Add webhook URL: `https://[project].supabase.co/functions/v1/mono-webhook`
3. Select events: `mandate.*`, `debit.*`
4. Copy webhook secret to Supabase secrets

### Testing

1. **Mandate Creation**
   - [ ] Create mandate
   - [ ] Verify mandate record created
   - [ ] Authorize via Mono widget
   - [ ] Verify mandate activated

2. **Debit Initiation**
   - [ ] Initiate debit with active mandate
   - [ ] Verify transaction record created
   - [ ] Check debit status

3. **Webhook Processing**
   - [ ] Test mandate.activated webhook
   - [ ] Test debit.successful webhook
   - [ ] Verify settlement check
   - [ ] Verify wallet crediting

4. **Error Handling**
   - [ ] Test failed debits
   - [ ] Test reversed debits
   - [ ] Test cancelled mandates
   - [ ] Test KYC limit violations

## Post-Deployment Monitoring

### Key Metrics

- Mandate creation success rate
- Mandate activation rate
- Debit initiation success rate
- Settlement time (average)
- Failed debit rate
- Reversal rate

### Alerts

- Webhook signature failures
- Debit verification failures
- Duplicate transaction attempts
- KYC limit violations
- Mandate activation failures

## Support & Troubleshooting

### Common Issues

1. **Mandate Not Activating**
   - Check webhook delivery
   - Verify mandate authorization
   - Check Mono dashboard for status

2. **Debit Not Settling**
   - Settlement can take 1-3 business days
   - Check debit status via Mono API
   - Verify `settled` flag

3. **Wallet Not Credited**
   - Verify debit is settled
   - Check transaction status
   - Review webhook logs

### Contact

- Mono Support: support@mono.co
- Internal Team: [your-team-contact]

---

**Last Updated**: [Date]
**Version**: 2.0.0 (DirectDebit)
**Previous Version**: 1.0.0 (DirectPay)



