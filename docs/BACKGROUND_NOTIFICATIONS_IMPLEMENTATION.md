# Background & Push Notifications Implementation

## Overview

This document describes the comprehensive in-app and push notification system implemented for Planmoni. The system listens for events in the background and sends push notifications to users' devices using Expo Notifications.

## Features Implemented

### 1. **Background Event Listener Service** (`lib/background-notifications.ts`)
   - Real-time subscription to `events` table changes
   - Real-time subscription to `notifications` table changes
   - Automatic conversion of events to notifications
   - Background notification handling when app is in background/killed state
   - Missed notification recovery on app startup

### 2. **Enhanced Notification Context** (`contexts/NotificationContext.tsx`)
   - Integrated background notification service
   - Foreground notification handling with toast messages
   - App state awareness (only shows toasts when app is active)
   - Automatic badge count updates

### 3. **Event-to-Notification Mapping**
   - Maps event types to notification types:
     - `payout_completed`, `payout_scheduled`, `disbursement_failed` → `payout`
     - `deposit_successful`, `deposit_failed`, `transaction_completed` → `transaction`
     - `security_alert`, `login_alert`, `suspicious_activity` → `security`
     - `vault_created`, `account_created`, `kyc_completed` → `system`
   - Automatic route mapping for navigation

### 4. **Background Notification Handling**
   - Notifications work when app is:
     - **Foreground**: Shows toast + local notification
     - **Background**: Shows push notification
     - **Killed**: Shows push notification, navigates on tap

## How It Works

### Event Flow

1. **Event Created** (in Supabase edge functions or database triggers)
   ```
   events table INSERT → Real-time subscription triggers
   ```

2. **Background Service Detects Event**
   ```
   background-notifications.ts → handleNewEvent()
   ```

3. **Notification Created**
   ```
   Creates notification in notifications table
   Schedules local/push notification based on app state
   ```

4. **User Receives Notification**
   - **Foreground**: Toast message + badge update
   - **Background**: Push notification
   - **Killed**: Push notification (handled by OS)

5. **User Taps Notification**
   ```
   App opens → Checks last notification → Navigates to appropriate screen
   ```

### Real-time Subscriptions

The system sets up two real-time subscriptions:

1. **Events Channel** (`events:{userId}`)
   - Listens for INSERT events on `events` table
   - Filters by `user_id`
   - Converts events to notifications

2. **Notifications Channel** (`notifications:{userId}`)
   - Listens for INSERT events on `notifications` table
   - Filters by `user_id`
   - Handles direct notifications

### App State Handling

```typescript
AppState.currentState:
- 'active' → Show toast + schedule notification
- 'background' → Send push notification immediately
- 'inactive' → Send push notification immediately
```

## Supported Event Types

### Payout Events
- `payout_completed` → Navigate to `/all-payouts`
- `payout_scheduled` → Navigate to `/all-payouts`
- `disbursement_failed` → Navigate to `/all-payouts`

### Transaction Events
- `deposit_successful` → Navigate to `/(tabs)/`
- `deposit_failed` → Navigate to `/(tabs)/`
- `transaction_completed` → Navigate to `/transactions`
- `transaction_failed` → Navigate to `/transactions`

### Security Events
- `security_alert` → Navigate to `/profile`
- `login_alert` → Navigate to `/profile`
- `suspicious_activity` → Navigate to `/profile`

### System Events
- `vault_created` → Navigate to `/(tabs)/`
- `account_created` → Navigate to `/(tabs)/`
- `kyc_completed` → Navigate to `/profile`
- `kyc_failed` → Navigate to `/profile`

## Notification Channels (Android)

The system uses different notification channels for different types:

- **transactions** - Transaction notifications
- **payouts** - Payout notifications
- **security** - Security alerts (MAX importance)
- **default** - General notifications

## Initialization

The notification system is initialized in `NotificationContext`:

```typescript
useEffect(() => {
  if (user?.id) {
    // Request permissions
    // Set up foreground listeners
    // Start background listener
    // Check for missed notifications
  }
}, [user?.id]);
```

## Missed Notification Recovery

When the app starts, the system checks for missed notifications from the last 24 hours:

1. Fetches unread events from `events` table
2. Fetches unread notifications from `notifications` table
3. Processes each missed notification
4. Updates badge count

## Notification Data Structure

Notifications include the following data:

```typescript
{
  eventId: string,
  eventType: string,
  notificationType: 'transaction' | 'payout' | 'security' | 'marketing' | 'system',
  payoutPlanId?: string,
  transactionId?: string,
  route: string // Navigation route
}
```

## Configuration

### iOS
- `UIBackgroundModes: ["remote-notification"]` ✅ Configured
- `aps-environment: "development"` ✅ Configured (change to "production" for App Store)

### Android
- `useNextNotificationsApi: true` ✅ Configured
- Notification channels configured ✅

## Usage Examples

### Creating a Notification from an Event

When an event is created in the database, the background service automatically:
1. Detects the event via real-time subscription
2. Creates a notification in the `notifications` table
3. Sends a push notification if app is in background
4. Shows a toast if app is in foreground

### Manual Notification Creation

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

const { createNotification } = useNotifications();

await createNotification(
  'Payout Completed',
  'Your payout of ₦5,000 has been completed.',
  'payout',
  { payoutPlanId: '...' }
);
```

## Testing

### Test Event Creation

```sql
INSERT INTO events (user_id, type, title, description, status)
VALUES (
  'user-uuid',
  'payout_completed',
  'Payout Completed',
  'Your payout has been completed successfully.',
  'unread'
);
```

### Test Notification Creation

```sql
INSERT INTO notifications (user_id, title, message, type, is_read)
VALUES (
  'user-uuid',
  'Test Notification',
  'This is a test notification.',
  'system',
  false
);
```

## Troubleshooting

### Notifications Not Showing

1. **Check Permissions**
   ```typescript
   const hasPermission = await inAppNotificationService.requestPermissions();
   ```

2. **Check App State**
   - Foreground: Should show toast
   - Background: Should show push notification
   - Killed: Should show push notification (OS handles)

3. **Check Real-time Subscription**
   - Verify Supabase real-time is enabled
   - Check network connectivity
   - Verify user is authenticated

4. **Check Notification Preferences**
   - User may have disabled notifications
   - Check `notification_preferences` in profiles table

### Background Notifications Not Working

1. **iOS**: Ensure `UIBackgroundModes` includes `remote-notification`
2. **Android**: Ensure notification channels are created
3. **Check Expo Push Token**: Verify token is registered in database

## Future Enhancements

- [ ] Scheduled notifications (reminders)
- [ ] Rich notifications with images
- [ ] Action buttons on notifications
- [ ] Notification grouping
- [ ] Silent notifications for background sync

## Files Modified/Created

### Created
- `lib/background-notifications.ts` - Background notification service

### Modified
- `contexts/NotificationContext.tsx` - Integrated background service
- `lib/in-app-notifications.ts` - Made `getChannelForType` public
- `app/_layout.tsx` - Enhanced notification tap handling

## Dependencies

- `expo-notifications` - Already installed ✅
- `expo-router` - For navigation ✅
- `@supabase/supabase-js` - For real-time subscriptions ✅

## Notes

- The system respects user notification preferences
- Notifications are queued if user is offline
- Badge count is automatically updated
- Navigation routes are automatically determined based on event type

