# Push Notification System - Complete Fix

## Issues Identified

1. **Edge Function JWT Verification**: The `send-push-notifications` edge function has `verify_jwt: true`, which requires authentication. This causes 401 errors when called from cron jobs or database triggers.

2. **Cron Job Authentication**: The cron job is getting 401 errors because it can't pass the service role key properly.

3. **Immediate Trigger**: The immediate trigger in `send_push_notification()` may be failing silently.

## Solutions

### Option 1: Disable JWT Verification (Recommended)

The `send-push-notifications` edge function should have JWT verification disabled since it's an internal function:

1. Go to Supabase Dashboard → Edge Functions → `send-push-notifications`
2. Click on Settings/Configuration
3. Disable "Verify JWT" or set `verify_jwt: false`
4. Save

This allows the function to be called from:
- Cron jobs (without authentication header)
- Database triggers via `net.http_post`
- Internal systems

The function is still secure because it:
- Uses service role key from environment variables internally
- Only processes notifications from the queue
- Doesn't expose sensitive data

### Option 2: Configure Service Role Key in Database Settings

If you want to keep JWT verification enabled, you need to set the service role key in database settings:

```sql
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

However, this is less secure and not recommended.

## Current Status

✅ **Fixed:**
- Edge function code (deployed version 23)
- `send_push_notification()` function with immediate trigger
- Database trigger for `deposit_successful` events
- Notification queue processing logic

⚠️ **Needs Manual Action:**
- Disable JWT verification for `send-push-notifications` edge function in Supabase Dashboard

## Testing

After disabling JWT verification:

1. Create a test deposit event
2. Check `push_notification_queue` table - notification should be queued
3. Check edge function logs - should process immediately
4. Verify notification is sent via Expo Push API
5. Check device receives notification

## Monitoring

Check notification status:
```sql
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM push_notification_queue
GROUP BY status;
```

Check recent notifications:
```sql
SELECT 
  id,
  status,
  title,
  error_message,
  created_at,
  sent_at
FROM push_notification_queue
ORDER BY created_at DESC
LIMIT 20;
```

