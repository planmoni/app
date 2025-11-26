# Push Notification 401 Error Fix

## Problem
The `send-push-notifications` edge function is returning 401 (Unauthorized) errors because it has JWT verification enabled, but the database trigger cannot authenticate properly.

## Root Cause
- Edge function has `verify_jwt: true` in Supabase dashboard
- Database trigger calls function via `net.http_post` with service role key
- Supabase rejects request BEFORE it reaches function code due to JWT verification
- Result: 401 errors and notifications stuck in "pending" status

## Solution

### Step 1: Disable JWT Verification (Required)

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/rqmpnoaavyizlwzfngpr/functions
2. Click on `send-push-notifications` function
3. Go to Settings/Configuration
4. **Disable "Verify JWT"** or set `verify_jwt: false`
5. Save changes

**Why this is safe:**
- Function uses service role key internally from environment variables
- Only processes notifications from the queue table
- No sensitive data exposed
- Internal function, not public API

### Step 2: Process Pending Notifications

After disabling JWT verification, manually trigger the function to process pending notifications:

```sql
-- Check pending notifications
SELECT id, user_id, title, status, created_at 
FROM push_notification_queue 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Manually trigger the function (after disabling JWT verification)
-- Or wait for cron job to process them
```

### Step 3: Verify Function Works

Test by creating a deposit event or manually queuing a notification:

```sql
-- Test notification
SELECT send_push_notification(
  'your-user-id'::uuid,
  'Test Notification',
  'Testing push notifications',
  '{"type": "system"}'::jsonb
);
```

## Current Status

✅ **Fixed:**
- Function code correctly uses Expo Push API
- Function handles unauthenticated calls
- Database trigger properly configured

⚠️ **Action Required:**
- **Disable JWT verification** in Supabase Dashboard for `send-push-notifications` function

## Alternative: Keep JWT Verification

If you want to keep JWT verification enabled, you need to configure the service role key in database settings:

```sql
-- Set service role key (less secure, not recommended)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

However, this is less secure and the recommended approach is to disable JWT verification for internal functions.

