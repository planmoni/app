# Account Creation Email Verification Guide

## Overview

Account creation emails are sent when a SafeHaven bank account is successfully created during KYC verification (NIN or BVN). The implementation has multiple layers:

1. **Application Layer** (`lib/email-service.ts`) - Called from `lib/safehaven-service.ts`
2. **Edge Function** (`supabase/functions/send-account-creation-email`) - Can be called directly
3. **Database Tracking** (`account_creation_emails` table) - Tracks all email attempts

## Verification Methods

### 1. Check Database Records

The `account_creation_emails` table tracks all email attempts:

```sql
-- View all account creation email records
SELECT 
  id,
  user_id,
  account_number,
  account_name,
  bank_name,
  email_sent,
  sent_at,
  error_message,
  email_provider_response,
  created_at
FROM account_creation_emails
ORDER BY created_at DESC
LIMIT 50;

-- Check success rate
SELECT 
  email_sent,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM account_creation_emails
GROUP BY email_sent;

-- Find failed emails
SELECT 
  id,
  user_id,
  account_number,
  error_message,
  email_provider_response,
  created_at
FROM account_creation_emails
WHERE email_sent = false
ORDER BY created_at DESC;

-- Check emails for a specific user
SELECT 
  ace.*,
  p.email,
  p.first_name,
  p.last_name
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
ORDER BY ace.created_at DESC;
```

### 2. Test the Edge Function Directly

```sql
-- Get user_id for testing
SELECT id, email, first_name 
FROM profiles 
WHERE email = 'itsmartinsevans@gmail.com';

-- Then call the edge function via HTTP (using pg_net if available)
-- Or use the test function:
SELECT send_test_account_creation_email(
  'itsmartinsevans@gmail.com',
  '1234567890',
  'Test Account Name',
  'SafeHaven Microfinance Bank'
);
```

### 3. Check Edge Function Logs

```bash
# View edge function logs
supabase functions logs send-account-creation-email --follow

# Or in Supabase Dashboard:
# Edge Functions > send-account-creation-email > Logs
```

### 4. Verify Email Provider Response

The `email_provider_response` column stores the Resend API response:

```sql
-- View successful email responses
SELECT 
  id,
  user_id,
  account_number,
  sent_at,
  email_provider_response->>'id' as resend_email_id,
  email_provider_response->>'from' as from_email,
  email_provider_response->>'to' as to_email,
  email_provider_response->>'created_at' as resend_created_at
FROM account_creation_emails
WHERE email_sent = true
ORDER BY sent_at DESC
LIMIT 20;

-- View error responses
SELECT 
  id,
  user_id,
  account_number,
  error_message,
  email_provider_response
FROM account_creation_emails
WHERE email_sent = false
ORDER BY created_at DESC;
```

### 5. Check Application Logs

The application logs email sending attempts in the console:

- **Success**: `"Account creation email sent successfully"`
- **Failure**: `"Failed to send account creation email: [error]"`

Check logs where account creation happens:
- NIN verification: `lib/safehaven-service.ts:1112-1129`
- BVN verification: `lib/safehaven-service.ts:1577-1594`

### 6. Manual Test via Edge Function

Test the edge function directly using curl or Postman:

```bash
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-account-creation-email' \
  -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "[USER_UUID]",
    "account_number": "1234567890",
    "account_name": "Test Account",
    "bank_name": "SafeHaven Microfinance Bank"
  }'
```

### 7. Verify Resend API Status

Check Resend dashboard:
1. Go to https://resend.com/emails
2. Look for emails from `notifications@planmoni.com`
3. Check delivery status and any bounces

## Common Issues

### Issue 1: Email Not Sending

**Symptoms**: `email_sent = false`, `error_message` populated

**Check**:
```sql
SELECT error_message, email_provider_response
FROM account_creation_emails
WHERE email_sent = false
ORDER BY created_at DESC
LIMIT 10;
```

**Possible Causes**:
- RESEND_API_KEY not configured in edge function
- Invalid email address
- Resend API rate limits
- Email domain not verified in Resend

### Issue 2: Function Not Called

**Symptoms**: No records in `account_creation_emails` table

**Check**:
- Verify account creation is completing successfully
- Check application logs for errors
- Ensure `sendAccountCreationEmail` is being called

### Issue 3: Edge Function Not Deployed

**Symptoms**: Function call fails with 404

**Solution**:
```bash
supabase functions deploy send-account-creation-email
```

## Monitoring Queries

### Daily Email Stats

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE email_sent = true) as successful,
  COUNT(*) FILTER (WHERE email_sent = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email_sent = true) / COUNT(*), 2) as success_rate
FROM account_creation_emails
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Recent Activity

```sql
SELECT 
  ace.*,
  p.email as user_email,
  p.first_name
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE ace.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ace.created_at DESC;
```

## Testing Checklist

- [ ] Edge function is deployed
- [ ] RESEND_API_KEY is configured in Supabase secrets
- [ ] Test email sent successfully
- [ ] Record created in `account_creation_emails` table
- [ ] `email_sent` flag is `true`
- [ ] `email_provider_response` contains valid Resend response
- [ ] Email received in inbox (check spam folder)
- [ ] Email content is correct (account number, name, etc.)

