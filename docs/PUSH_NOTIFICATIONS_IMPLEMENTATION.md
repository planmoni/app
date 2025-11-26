# Push Notifications Implementation - Works When App is Closed

## Overview

This document explains how push notifications are sent directly from the database, allowing users to receive notifications even when the app is completely closed.

## Architecture

### 1. **Database Triggers** (Automatic)
When events or notifications are created in the database, triggers automatically queue push notifications:

- **`trigger_send_push_on_event_insert`**: Triggered when a new event is inserted
- **`trigger_send_push_on_notification_insert`**: Triggered when a new notification is inserted

These triggers call the `send_push_notification()` function which:
- Checks user's notification preferences
- Gets the user's FCM token
- Queues the notification in `push_notification_queue` table

### 2. **Push Notification Queue**
The `push_notification_queue` table stores pending notifications:
- Status: `pending`, `sent`, `failed`
- Contains FCM token, title, body, and data payload

### 3. **Cron Job** (Every 2 minutes)
A PostgreSQL cron job runs every 2 minutes to process the queue:
- Calls the `send-push-notifications` edge function
- Processes up to 50 pending notifications per run

### 4. **Edge Function** (`send-push-notifications`)
The edge function:
- Fetches pending notifications from the queue
- Sends them via Firebase Cloud Messaging (FCM) API
- Updates queue status (`sent` or `failed`)

## Flow Diagram

```
Deposit/Payout Event Occurs
         ↓
Database Function Creates Event/Notification
         ↓
Database Trigger Fires
         ↓
send_push_notification() Function Called
         ↓
Checks User Preferences & Gets FCM Token
         ↓
Queues Notification in push_notification_queue
         ↓
Cron Job Runs (Every 2 minutes)
         ↓
Calls send-push-notifications Edge Function
         ↓
Sends via FCM API
         ↓
User Receives Push Notification (Even if app is closed!)
```

## Key Functions

### `process_paystack_deposit()` & `process_safehaven_deposit()`
These functions now:
1. Process the deposit transaction
2. Create event and notification records
3. Automatically trigger push notification via database trigger

### `send_push_notification(user_id, title, body, data)`
Database function that:
- Checks if push notifications are enabled for the user
- Checks notification type preferences (deposit_alerts, payout_alerts, etc.)
- Gets the user's FCM token from `user_fcm_tokens` table
- Queues notification in `push_notification_queue`

## Supported Event Types

Push notifications are automatically sent for:
- ✅ `deposit_successful` - When deposits are received
- ✅ `deposit_failed` - When deposits fail
- ✅ `payout_completed` - When payouts complete
- ✅ `payout_scheduled` - When payouts are initiated
- ✅ `withdrawal_scheduled` - When withdrawals are scheduled
- ✅ `disbursement_failed` - When payouts fail
- ✅ `security_alert` - Security-related alerts
- ✅ Any other event type

## User Preferences

Users can control push notifications via `profiles.push_notifications`:
```json
{
  "enabled": true,
  "deposit_alerts": true,
  "payout_alerts": true,
  "security_alerts": true,
  "marketing_alerts": false
}
```

## FCM Token Storage

FCM tokens are stored in `user_fcm_tokens` table:
- One token per user per platform (ios/android/web)
- Updated when user logs in or app starts
- Used by `send_push_notification()` to send notifications

## Testing

To test push notifications:

1. **Ensure user has FCM token**:
   ```sql
   SELECT * FROM user_fcm_tokens WHERE user_id = 'your-user-id';
   ```

2. **Create a test event**:
   ```sql
   INSERT INTO events (user_id, type, title, description, status)
   VALUES ('your-user-id', 'deposit_successful', 'Test', 'Test notification', 'unread');
   ```

3. **Check queue**:
   ```sql
   SELECT * FROM push_notification_queue 
   WHERE status = 'pending' 
   ORDER BY created_at DESC;
   ```

4. **Wait for cron job** (runs every 2 minutes) or manually trigger:
   ```bash
   curl -X POST https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/send-push-notifications \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

5. **Check queue status**:
   ```sql
   SELECT * FROM push_notification_queue 
   WHERE status IN ('sent', 'failed')
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## Troubleshooting

### Notifications not being sent?

1. **Check user has FCM token**:
   ```sql
   SELECT * FROM user_fcm_tokens WHERE user_id = 'user-id';
   ```

2. **Check user preferences**:
   ```sql
   SELECT push_notifications FROM profiles WHERE id = 'user-id';
   ```

3. **Check queue**:
   ```sql
   SELECT * FROM push_notification_queue 
   WHERE status = 'pending' 
   ORDER BY created_at DESC;
   ```

4. **Check cron job**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'send-push-notifications';
   ```

5. **Check edge function logs** in Supabase Dashboard

### Notifications stuck in queue?

- Check edge function logs for errors
- Verify Firebase credentials are configured
- Check FCM token validity

## Benefits

✅ **Works when app is closed** - Notifications sent from server, not app
✅ **Automatic** - Database triggers handle everything
✅ **Reliable** - Queue system ensures delivery
✅ **Scalable** - Processes in batches
✅ **User-controlled** - Respects notification preferences

## Future Improvements

- Add retry logic for failed notifications
- Add notification delivery tracking
- Add analytics for notification open rates
- Support for rich notifications (images, actions)

