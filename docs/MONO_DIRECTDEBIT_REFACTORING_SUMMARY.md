# Mono DirectDebit Refactoring Summary

## Executive Summary

**Decision**: Switched from Mono DirectPay to Mono DirectDebit based on technical meeting with Mono team.

**Reason**: DirectPay requires user authorization for every payment, making it unsuitable for recurring deposits and wallet top-ups. DirectDebit allows one-time mandate authorization with subsequent programmatic debits.

**Impact**: Complete refactoring of Mono integration, new mandate management system, updated webhook handlers, and settlement-based crediting.

## Files Created

### 1. Database Schema
- `supabase/migrations/20250125000001_add_mono_mandates_table.sql`
  - New `mono_mandates` table
  - Tracks mandate lifecycle
  - One active mandate per bank account

### 2. Hooks
- `hooks/useMonoDirectDebit.ts`
  - Mandate creation and management
  - Debit initiation
  - Status checking
  - Mandate cancellation

### 3. Webhook Handler
- `supabase/functions/mono-webhook/index.ts` (updated)
  - Handles mandate events
  - Handles debit events
  - Settlement verification
  - Reversal handling

### 4. Documentation
- `docs/MONO_DIRECTDEBIT_IMPLEMENTATION.md`
  - Complete implementation guide
  - DirectDebit flow documentation
  - KYC Level 0 constraints
  - Security & compliance
  - Deployment checklist

## Files Modified

### 1. Database Functions
- `supabase/migrations/20250125000000_add_process_mono_deposit_function.sql`
  - Updated to support both DirectPay and DirectDebit
  - Source detection based on mono_data

### 2. Webhook Handler
- `supabase/functions/mono-webhook/index.ts`
  - Complete rewrite for DirectDebit
  - Mandate event handling
  - Settlement-based crediting
  - Reversal handling

## Files to Update (Pending)

### 1. Payment Methods Screen
- `app/deposit-flow/payment-methods.tsx`
  - Update to use DirectDebit mandates
  - Show mandate status
  - Handle mandate creation flow

### 2. Authorization Screen
- `app/deposit-flow/authorization.tsx`
  - Update for mandate authorization
  - Remove DirectPay widget logic

### 3. Amount Screen
- `app/deposit-flow/amount.tsx`
  - Update routing for DirectDebit

### 4. Mono Pay Screen
- `app/deposit-flow/mono-pay.tsx`
  - Update for mandate creation
  - Show mandate authorization widget

## Key Architectural Changes

### Before (DirectPay)
```
User → Select Account → Enter Amount → Authorize Payment → Wallet Credited
```

### After (DirectDebit)
```
User → Select Account → Create Mandate → Authorize Mandate → Mandate Active
User → Select Mandate → Enter Amount → Initiate Debit → Wait for Settlement → Wallet Credited
```

## Critical Differences

| Aspect | DirectPay | DirectDebit |
|--------|-----------|-------------|
| Authorization | Per payment | Once (mandate) |
| Widget Required | Every payment | Only for mandate |
| Settlement | Instant | 1-3 business days |
| Reusability | No | Yes |
| Use Case | One-time | Recurring |

## Security Considerations

### Maintained
- ✅ Webhook signature verification
- ✅ Idempotency checks
- ✅ Amount verification
- ✅ User ownership validation
- ✅ Server-side secret storage

### Enhanced
- ✅ Settlement verification (only credit when settled)
- ✅ Mandate status validation
- ✅ Reversal handling
- ✅ KYC Level 0 limits (weekly limit added)

## Deployment Steps

1. **Database Migration**
   ```bash
   supabase migration up
   ```

2. **Deploy Edge Functions**
   ```bash
   supabase functions deploy mono-api-proxy
   supabase functions deploy mono-webhook
   ```

3. **Set Secrets**
   ```bash
   supabase secrets set MONO_SECRET_KEY=live_sk_...
   supabase secrets set MONO_WEBHOOK_SECRET=webhook_secret
   ```

4. **Configure Mono Dashboard**
   - Enable DirectDebit
   - Set webhook URL
   - Configure webhook events

5. **Update Client Code**
   - Replace `useMonoDirectPay` with `useMonoDirectDebit`
   - Update payment flow screens
   - Test mandate creation
   - Test debit initiation

## Testing Checklist

- [ ] Mandate creation
- [ ] Mandate authorization
- [ ] Mandate activation webhook
- [ ] Debit initiation
- [ ] Debit settlement webhook
- [ ] Wallet crediting (only when settled)
- [ ] Failed debit handling
- [ ] Reversed debit handling
- [ ] KYC Level 0 limits
- [ ] Mandate cancellation

## Rollback Plan

If issues occur:

1. **Disable DirectDebit in UI**
   - Remove from payment methods
   - Keep webhook active for pending debits

2. **Monitor Existing Debits**
   - Check pending transactions
   - Process manually if needed

3. **Fix Issues**
   - Review logs
   - Fix code
   - Re-test thoroughly
   - Re-enable feature

## Next Steps

1. Update payment flow screens
2. Test end-to-end flow
3. Update user documentation
4. Monitor production metrics
5. Gather user feedback

---

**Refactored By**: [Name]
**Date**: [Date]
**Version**: 2.0.0


