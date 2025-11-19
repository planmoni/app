# Notification System Debugging Guide

## Issues Found

### 1. **Local Notifications Not Showing**
   - **Problem**: Local notifications were silently failing if notification preferences couldn't be fetched or if preferences were set to disabled
   - **Fix**: Added error handling and default to showing notifications if preferences can't be fetched
   - **Location**: `lib/in-app-notifications.ts` - `createNotification()` method

### 2. **Notification Preferences Not Found**
   - **Problem**: The system was looking for `notification_preferences` but some users might have `push_notifications` field instead
   - **Fix**: Updated `getNotificationPreferences()` to check both fields and provide sensible defaults
   - **Location**: `lib/in-app-notifications.ts` - `getNotificationPreferences()` method

### 3. **Push Token Errors Blocking Local Notifications**
   - **Problem**: If push token retrieval failed, it would throw an error and prevent local notifications from working
   - **Fix**: Changed error handling to return `null` instead of throwing, allowing local notifications to work independently
   - **Location**: `lib/notifications.ts` - `getPushTokenAsync()` method

### 4. **Lack of Debugging Logs**
   - **Problem**: No console logs to help debug notification issues
   - **Fix**: Added comprehensive logging throughout the notification system
   - **Location**: `contexts/NotificationContext.tsx`, `lib/in-app-notifications.ts`, `lib/notifications.ts`

## Push Notifications vs Local Notifications

### Push Notifications (Remote)
- **How it works**: 
  1. `send_push_notification` RPC function queues notifications in `push_notification_queue` table
  2. `send-push-notifications` edge function processes the queue (needs to be triggered)
  3. Requires FCM/APNS configuration
  4. Requires push token to be registered in `user_fcm_tokens` table

- **Status**: Queued notifications need to be processed by calling the `send-push-notifications` edge function (likely via cron job)

### Local Notifications (In-App)
- **How it works**:
  1. Created via `inAppNotificationService.createNotification()`
  2. Stored in `notifications` table
  3. Scheduled locally using `expo-notifications`
  4. Displayed via `NotificationContext` listeners
  5. Works without FCM/APNS configuration

- **Status**: Should work now with the fixes applied

## Testing Checklist

1. **Check Notification Permissions**:
   ```javascript
   import * as Notifications from 'expo-notifications';
   const { status } = await Notifications.getPermissionsAsync();
   console.log('Permission status:', status);
   ```

2. **Check if Token is Registered**:
   - Check `user_fcm_tokens` table in Supabase
   - Check `user_push_tokens` table in Supabase

3. **Check Notification Preferences**:
   - Check `profiles.notification_preferences` or `profiles.push_notifications`
   - Default values should be set if missing

4. **Test Local Notification**:
   ```javascript
   import { inAppNotificationService } from '@/lib/in-app-notifications';
   await inAppNotificationService.createNotification(
     userId,
     'Test Notification',
     'This is a test',
     'system',
     {},
     true // scheduleLocal
   );
   ```

5. **Check Push Notification Queue**:
   - Query `push_notification_queue` table
   - Check if notifications are being queued
   - Check if `send-push-notifications` edge function is being called

## Common Issues

### Notifications Not Showing
1. Check if permissions are granted
2. Check console logs for errors
3. Check notification preferences in database
4. Verify `NotificationContext` is properly initialized

### Push Notifications Not Working
1. Check if FCM/APNS is configured
2. Check if push token exists in `user_fcm_tokens`
3. Check if `send-push-notifications` edge function is being triggered
4. Check `push_notification_queue` table for pending notifications

### Local Notifications Not Working
1. Check if permissions are granted
2. Check if `scheduleLocal` parameter is `true`
3. Check notification preferences
4. Check console logs for errors

## Next Steps

1. **Set up cron job** to process push notification queue (call `send-push-notifications` edge function periodically)
2. **Test notifications** after fixes
3. **Monitor logs** for any remaining issues
4. **Configure FCM/APNS** if push notifications are needed

