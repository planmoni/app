# Mono DirectPay Deployment Checklist

## Pre-Deployment Security Audit

### ✅ Critical Security Checks

- [ ] **No Secret Keys in Client Code**
  - [ ] Verify no `EXPO_PUBLIC_MONO_SECRET_KEY` in codebase
  - [ ] All Mono API calls use edge function
  - [ ] Run: `grep -r "EXPO_PUBLIC_MONO_SECRET_KEY" .`

- [ ] **Edge Function Configuration**
  - [ ] `MONO_SECRET_KEY` set in Supabase secrets (LIVE key only)
  - [ ] Key format: `live_sk_...` (not `test_sk_...`)
  - [ ] Edge function deployed: `supabase/functions/mono-api-proxy`

- [ ] **Webhook Security**
  - [ ] `MONO_WEBHOOK_SECRET` set in Supabase secrets
  - [ ] Webhook URL configured in Mono dashboard
  - [ ] Webhook endpoint accessible: `/functions/v1/mono-webhook`
  - [ ] Edge function deployed: `supabase/functions/mono-webhook`
  - [ ] Signature verification tested

- [ ] **Database Functions**
  - [ ] Migration run: `20250125000000_add_process_mono_deposit_function.sql`
  - [ ] `process_mono_deposit` function exists
  - [ ] Function has proper permissions

## Environment Variables

### Supabase Secrets (Required)
```bash
supabase secrets set MONO_SECRET_KEY=live_sk_...
supabase secrets set MONO_WEBHOOK_SECRET=your_webhook_secret
```

### Client Environment (Required)
```bash
EXPO_PUBLIC_MONO_PUBLIC_KEY=live_pk_...
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

## Mono Dashboard Configuration

### Webhook Setup
1. Go to Mono Dashboard → Settings → Webhooks
2. Add webhook URL: `https://[your-project-ref].supabase.co/functions/v1/mono-webhook`
   - Replace `[your-project-ref]` with your Supabase project reference
3. Select events: `directpay.success`, `directpay.failed`
4. Copy webhook secret to Supabase secrets: `supabase secrets set MONO_WEBHOOK_SECRET=...`
5. Test webhook delivery in Mono dashboard

### API Keys
1. Verify LIVE secret key (starts with `live_sk_`)
2. Verify LIVE public key (starts with `live_pk_`)
3. Test keys are active and not revoked

## Testing Checklist

### Payment Flow Testing
- [ ] **Initiate Payment**
  - [ ] Payment initiation succeeds
  - [ ] Payment ID returned
  - [ ] Transaction record created (pending)

- [ ] **Authorization**
  - [ ] Mono widget opens
  - [ ] User can authorize payment
  - [ ] Widget closes after authorization

- [ ] **Webhook Processing**
  - [ ] Webhook received for successful payment
  - [ ] Signature verification passes
  - [ ] Payment verified with Mono API
  - [ ] Wallet credited correctly
  - [ ] Transaction status updated to "completed"

- [ ] **Idempotency**
  - [ ] Duplicate webhook doesn't double credit
  - [ ] Returns success for already processed

- [ ] **Error Handling**
  - [ ] Failed payment webhook handled
  - [ ] Invalid signature rejected
  - [ ] Payment verification failure handled
  - [ ] KYC limit violations blocked

### KYC Level 0 Testing
- [ ] Single transaction limit enforced (₦50,000)
- [ ] Daily limit enforced (₦50,000)
- [ ] Limits checked client and server-side

## Production Monitoring

### Key Metrics
- Payment initiation success rate
- Webhook processing time
- Failed signature verifications
- Duplicate transaction attempts
- KYC limit violations

### Alerts to Set Up
- Webhook signature failures
- Payment verification failures
- Duplicate transaction attempts
- Database errors in deposit processing

## Rollback Plan

If issues occur:

1. **Disable Mono DirectPay in UI**
   - Remove from payment methods screen
   - Keep webhook active for pending payments

2. **Monitor Existing Payments**
   - Check pending transactions
   - Process manually if needed

3. **Fix Issues**
   - Review logs
   - Fix code
   - Re-test thoroughly
   - Re-enable feature

## Support Contacts

- Mono Support: support@mono.co
- Internal Team: [your-team-contact]

## Post-Deployment

- [ ] Monitor first 10 transactions manually
- [ ] Verify webhook processing
- [ ] Check wallet balances
- [ ] Review error logs
- [ ] Confirm user notifications working

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Version**: 1.0.0

