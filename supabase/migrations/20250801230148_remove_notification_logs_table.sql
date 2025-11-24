/*
  # Remove Notification Logs Feature

  This migration removes the notification_logs feature that was used for analytics
  and monitoring of push notifications. The feature is being removed as it's 
  not necessary for the core functionality.

  ## Changes:
  - Drop notification_logs table
  - Drop get_notification_analytics function
  - Remove all related indexes and policies

  ## Impact:
  - No more logging of push notification sending attempts
  - Reduced database storage overhead
  - Core push notification functionality remains intact
*/

-- Drop the analytics function first
DROP FUNCTION IF EXISTS get_notification_analytics(timestamptz, timestamptz);

-- Drop the notification_logs table (this will also drop related indexes and policies)
DROP TABLE IF EXISTS notification_logs;