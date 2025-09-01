# Notification System Fixes

## Overview

This document outlines the fixes implemented to resolve the multiple email sending bug and add push notifications to the Planmoni app.

## Issues Identified

### 1. Multiple Email Sending Bug
- **Root Cause**: The `check-new-transactions` edge function was running every 1 minute, causing race conditions and duplicate processing
- **Symptoms**: Users received multiple emails for the same transaction
- **Impact**: Poor user experience and potential data inconsistencies

### 2. Missing Push Notifications
- **Root Cause**: No Firebase Cloud Messaging (FCM) integration
- **Symptoms**: Users only received email notifications, no real-time push notifications
- **Impact**: Users missed important updates when app was not active

### 3. Webhook vs Edge Function Conflict
- **Root Cause**: Both Paystack webhook and edge function could process the same transaction
- **Symptoms**: Potential duplicate processing and inconsistent data
- **Impact**: Data integrity issues and user confusion

## Fixes Implemented

### 1. Duplicate Prevention System

#### A. Processing Lock Mechanism
- **File**: `supabase/migrations/20250101000001_add_system_locks.sql`
- **Purpose**: Prevents multiple simultaneous executions of edge functions
- **Implementation**: 
  - Created `system_locks` table with expiration mechanism
  - Added cleanup function to remove expired locks
  - Integrated lock checking in edge function

#### B. Atomic Transaction Processing
- **File**: `supabase/migrations/20250101000002_add_process_paystack_deposit_function.sql`
- **Purpose**: Ensures atomic processing of deposits with proper duplicate prevention
- **Implementation**:
  - Created `process_paystack_deposit` function
  - Handles wallet balance update, transaction record creation, and notification in single transaction
  - Returns processing status to prevent duplicates

#### C. Enhanced Duplicate Detection
- **File**: `supabase/functions/check-new-transactions/index.ts`
- **Improvements**:
  - Added age-based filtering (skip transactions older than 24 hours)
  - Enhanced reference checking
  - Better error handling and logging

### 2. Reduced Processing Frequency
- **File**: `scripts/setup-scheduled-transactions.js`
- **Change**: Reduced cron schedule from every 1 minute to every 5 minutes
- **Reason**: Reduces the chance of race conditions and duplicate processing

### 3. Push Notification System

#### A. Firebase Integration
- **File**: `lib/firebase.ts`
- **Features**:
  - Firebase Cloud Messaging initialization
  - FCM token management
  - Foreground message handling

#### B. Push Notification Service
- **File**: `lib/push-notifications.ts`
- **Features**:
  - FCM token storage and management
  - Notification settings management
  - Token refresh handling

#### C. Database Schema
- **File**: `supabase/migrations/20250101000003_add_push_notifications.sql`
- **Tables**:
  - `user_fcm_tokens`: Stores FCM tokens for each user
  - `push_notification_queue`: Queues notifications for processing
- **Functions**:
  - `send_push_notification`: Database function to queue notifications

#### D. Push Notification Edge Function
- **File**: `supabase/functions/send-push-notifications/index.ts`
- **Features**:
  - Processes pending notifications from queue
  - Sends notifications via FCM API
  - Handles success/failure tracking

#### E. Cron Job for Push Notifications
- **File**: `supabase/migrations/20250101000004_add_push_notification_cron.sql`
- **Schedule**: Every 2 minutes
- **Purpose**: Processes pending push notifications

### 4. Integration with Existing Systems

#### A. Edge Function Integration
- **File**: `supabase/functions/check-new-transactions/index.ts`
- **Changes**:
  - Added push notification sending after successful deposit processing
  - Integrated with new atomic processing function
  - Enhanced logging and error handling

#### B. Setup Scripts
- **File**: `scripts/setup-push-notifications.js`
- **Purpose**: Automated setup of push notification system
- **Features**:
  - Edge function deployment
  - Environment variable verification
  - Function testing

## How It Works

### 1. When Money is Sent (App Active)
1. Paystack webhook (`app/api/paystack-webhook+api.ts`) receives real-time notification
2. Processes transaction immediately
3. Sends push notification via `send_push_notification` function
4. Creates notification event in `events` table

### 2. When Money is Sent (App Inactive)
1. Edge function (`check-new-transactions`) runs every 5 minutes
2. Checks for new transactions using processing lock
3. Processes transactions atomically using `process_paystack_deposit`
4. Sends both email and push notifications
5. Creates notification events

### 3. Push Notification Flow
1. Notification is queued in `push_notification_queue`
2. Cron job processes queue every 2 minutes
3. Edge function sends notification via FCM
4. Success/failure status is updated in queue

## Environment Variables Required

### For Edge Functions
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYSTACK_LIVE_SECRET_KEY=your_paystack_secret
RESEND_API_KEY=your_resend_api_key
FIREBASE_SERVER_KEY=your_firebase_server_key
```

### For App
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Setup Instructions

### 1. Deploy Database Migrations
```bash
supabase db push
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy check-new-transactions
supabase functions deploy send-push-notifications
```

### 3. Set Up Cron Jobs
```bash
node scripts/setup-scheduled-transactions.js
node scripts/setup-push-notifications.js
```

### 4. Configure Firebase
1. Get FCM server key from Firebase Console
2. Set `FIREBASE_SERVER_KEY` environment variable
3. Update VAPID key in `lib/firebase.ts`

### 5. Test the System
```bash
node scripts/test-scheduled-transactions.js
```

## Benefits

### 1. Eliminated Duplicate Emails
- Processing locks prevent multiple simultaneous executions
- Atomic transactions ensure data consistency
- Reduced processing frequency minimizes race conditions

### 2. Added Push Notifications
- Real-time notifications even when app is closed
- Configurable notification preferences
- Reliable delivery via FCM

### 3. Improved Reliability
- Better error handling and logging
- Automatic retry mechanisms
- Comprehensive monitoring

### 4. Enhanced User Experience
- Immediate notifications for active users
- Background processing for inactive users
- Multiple notification channels (email + push)

## Monitoring

### 1. Edge Function Logs
```bash
supabase functions logs check-new-transactions --follow
supabase functions logs send-push-notifications --follow
```

### 2. Database Monitoring
- Check `system_locks` table for processing status
- Monitor `push_notification_queue` for delivery status
- Review `events` table for notification history

### 3. Error Tracking
- Failed notifications are marked in queue with error messages
- Processing errors are logged with detailed information
- Duplicate attempts are tracked and prevented

## Future Improvements

1. **WebSocket Integration**: Real-time updates for active users
2. **Notification Templates**: Customizable notification content
3. **Delivery Analytics**: Track notification delivery rates
4. **A/B Testing**: Test different notification strategies
5. **Smart Scheduling**: Optimize notification timing based on user behavior 