# Fix Failed Account Creation Emails

## Problem

When `email_sent = false` but both `error_message` and `email_provider_response` are NULL, it means:
- The email record was created in the database
- But the email sending code never completed or crashed before updating the record
- This leaves the record in an incomplete state

## Solution

### Option 1: Retry Using SQL Function (Recommended)

First, apply the migration to create the retry function:
```bash
# Apply the migration
supabase migration up
```

Then run this SQL to retry all failed emails for your user:

```sql
-- Retry all failed emails for a specific user
SELECT retry_user_account_creation_emails('itsmartinsevans@gmail.com');
```

Or retry a specific record:

```sql
-- Get the record ID first
SELECT id, account_number, created_at
FROM account_creation_emails
WHERE user_id = (SELECT id FROM profiles WHERE email = 'itsmartinsevans@gmail.com')
  AND email_sent = false
ORDER BY created_at DESC
LIMIT 1;

-- Then retry (replace [RECORD_ID] with actual ID)
SELECT retry_account_creation_email('[RECORD_ID]');
```

### Option 2: Manual Retry via Edge Function

If the SQL function doesn't work (pg_net not enabled), call the edge function directly:

```bash
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-account-creation-email' \
  -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "[USER_UUID]",
    "account_number": "[ACCOUNT_NUMBER]",
    "account_name": "[ACCOUNT_NAME]",
    "bank_name": "SafeHaven Microfinance Bank"
  }'
```

Get the values from your database:
```sql
SELECT 
  ace.user_id,
  ace.account_number,
  ace.account_name,
  p.email
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
  AND ace.email_sent = false
ORDER BY ace.created_at DESC
LIMIT 1;
```

### Option 3: Fix the Code Issue

The code has been updated to ensure records are always updated, even on errors. The fix:
- Always updates the record with error details if sending fails
- Handles cases where the initial insert fails
- Ensures `updated_at` is always set

## Verification

After retrying, check if it worked:

```sql
SELECT 
  ace.id,
  ace.email_sent,
  ace.sent_at,
  ace.error_message,
  ace.email_provider_response->>'id' as resend_email_id,
  ace.updated_at
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
ORDER BY ace.created_at DESC
LIMIT 1;
```

Expected results:
- ✅ `email_sent = true` and `sent_at` is set → Success!
- ❌ `email_sent = false` but `error_message` is now populated → Check the error message

## Common Issues

### Issue: "pg_net extension not enabled"
**Solution**: Enable the extension or use Option 2 (direct edge function call)

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Issue: "Edge function not deployed"
**Solution**: Deploy the edge function

```bash
supabase functions deploy send-account-creation-email
```

### Issue: "RESEND_API_KEY not configured"
**Solution**: Set the secret in Supabase Dashboard

1. Go to Edge Functions → Settings → Secrets
2. Add `RESEND_API_KEY` with your Resend API key

## Prevention

The code has been updated to prevent this issue in the future:
- Records are always updated with error details
- Better error handling throughout the email sending process
- Fallback mechanisms if initial insert fails

