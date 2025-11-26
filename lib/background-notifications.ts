import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { inAppNotificationService } from './in-app-notifications';

/**
 * Background Notification Service
 * Handles listening for events and sending push/in-app notifications
 */

export interface EventNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  status: 'unread' | 'read';
  payout_plan_id?: string;
  transaction_id?: string;
  created_at: string;
}

// Map event types to notification types
const eventTypeToNotificationType = (
  eventType: string
): 'transaction' | 'payout' | 'security' | 'marketing' | 'system' => {
  const mapping: Record<string, 'transaction' | 'payout' | 'security' | 'marketing' | 'system'> = {
    payout_completed: 'payout',
    payout_scheduled: 'payout',
    withdrawal_scheduled: 'payout',
    disbursement_failed: 'payout',
    deposit_successful: 'transaction',
    deposit_failed: 'transaction',
    transaction_completed: 'transaction',
    transaction_failed: 'transaction',
    security_alert: 'security',
    login_alert: 'security',
    suspicious_activity: 'security',
    vault_created: 'system',
    account_created: 'system',
    kyc_completed: 'system',
    kyc_failed: 'system',
  };
  return mapping[eventType] || 'system';
};

// Map event types to notification titles and messages
const getNotificationContent = (event: EventNotification) => {
  const { type, title, description } = event;
  
  // Use provided title/description if available, otherwise generate from type
  let notificationTitle = title;
  let notificationMessage = description || '';

  if (!notificationMessage) {
    switch (type) {
      case 'payout_completed':
        notificationMessage = 'Your payout has been completed successfully.';
        break;
      case 'payout_scheduled':
        notificationMessage = 'A new payout has been scheduled.';
        break;
      case 'withdrawal_scheduled':
        notificationMessage = 'Your emergency withdrawal has been scheduled.';
        break;
      case 'disbursement_failed':
        notificationMessage = 'Your payout failed. Please check your account details.';
        break;
      case 'deposit_successful':
        notificationMessage = 'Your deposit was successful.';
        break;
      case 'deposit_failed':
        notificationMessage = 'Your deposit failed. Please try again.';
        break;
      case 'security_alert':
        notificationMessage = 'A security alert has been triggered.';
        break;
      case 'login_alert':
        notificationMessage = 'A new login was detected on your account.';
        break;
      default:
        notificationMessage = description || 'You have a new notification.';
    }
  }

  return {
    title: notificationTitle,
    message: notificationMessage,
  };
};

class BackgroundNotificationService {
  private static instance: BackgroundNotificationService;
  private isListening = false;
  private userId: string | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private eventsChannel: any = null;
  private notificationsChannel: any = null;

  private constructor() {
    // Configure notification handler for background
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  static getInstance(): BackgroundNotificationService {
    if (!BackgroundNotificationService.instance) {
      BackgroundNotificationService.instance = new BackgroundNotificationService();
    }
    return BackgroundNotificationService.instance;
  }

  /**
   * Start listening for events and trigger notifications
   */
  async startListening(userId: string): Promise<void> {
    if (this.isListening && this.userId === userId) {
      console.log('🔔 Already listening for events');
      return;
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping event subscription');
      return;
    }

    // Stop existing listener if any
    this.stopListening();

    this.userId = userId;
    this.isListening = true;

    console.log(`🔔 Background notification service initialized for user: ${userId}`);

    try {
      // Handle app state changes (using subscription pattern for React Native 0.65+)
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      
      // Subscribe to events table for real-time event notifications
      this.eventsChannel = supabase
        .channel(`events:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'events',
            filter: `user_id=eq.${userId}`,
          },
          async (payload: any) => {
            console.log('🔔 New event received:', payload.new);
            await this.handleNewEvent(payload.new as EventNotification);
          }
        )
        .subscribe();

      // Subscribe to notifications table for direct notifications
      this.notificationsChannel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          async (payload: any) => {
            console.log('🔔 New notification received:', payload.new);
            await this.handleNewNotification(payload.new);
          }
        )
        .subscribe();
      
      // Refresh badge count on app state change
      this.refreshBadgeCount();
      
      console.log('✅ Real-time subscriptions active for events and notifications');
    } catch (error) {
      console.error('❌ Error setting up background notification service:', error);
      // Don't throw - allow app to continue
      this.isListening = false;
    }
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    console.log('🔔 Stopping background notification service');
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.eventsChannel) {
      supabase.removeChannel(this.eventsChannel);
      this.eventsChannel = null;
    }
    if (this.notificationsChannel) {
      supabase.removeChannel(this.notificationsChannel);
      this.notificationsChannel = null;
    }
    this.isListening = false;
    this.userId = null;
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: string) => {
    console.log('📱 App state changed:', nextAppState);
    // When app comes to foreground, refresh notification badge
    if (nextAppState === 'active' && this.userId) {
      this.refreshBadgeCount();
    }
  };

  /**
   * Handle new event from database
   */
  private async handleNewEvent(event: EventNotification): Promise<void> {
    try {
      console.log('🔔 Processing new event:', event.type);

      // Skip if already read
      if (event.status === 'read') {
        console.log('⚠️ Event already read, skipping notification');
        return;
      }

      const notificationType = eventTypeToNotificationType(event.type);
      const { title, message } = getNotificationContent(event);

      // Create notification in database
      const notificationId = await inAppNotificationService.createNotification(
        event.user_id,
        title,
        message,
        notificationType,
        {
          eventId: event.id,
          eventType: event.type,
          payoutPlanId: event.payout_plan_id,
          transactionId: event.transaction_id,
          route: this.getRouteForEvent(event.type),
        },
        true // Schedule local notification
      );

      if (notificationId) {
        console.log('✅ Notification created or found:', notificationId);
        // Send push notification (works in foreground and background)
        // The notification handler will decide whether to show alert based on app state
        await this.sendPushNotification(event, title, message, notificationType);
      } else {
        console.log('⚠️ Notification creation skipped (likely duplicate or error)');
      }
    } catch (error) {
      console.error('❌ Error handling new event:', error);
    }
  }

  /**
   * Handle new notification from database
   */
  private async handleNewNotification(notification: any): Promise<void> {
    try {
      console.log('🔔 Processing new notification:', notification.type);

      // Skip if already read
      if (notification.is_read) {
        console.log('⚠️ Notification already read, skipping');
        return;
      }

      // Always send push notification (works in foreground and background)
      await this.sendPushNotification(
        {
          id: notification.id,
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          description: notification.message,
          status: notification.is_read ? 'read' : 'unread',
          created_at: notification.created_at,
        },
        notification.title,
        notification.message,
        notification.type as any
      );
    } catch (error) {
      console.error('❌ Error handling new notification:', error);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    event: EventNotification,
    title: string,
    message: string,
    type: 'transaction' | 'payout' | 'security' | 'marketing' | 'system'
  ): Promise<void> {
    try {
      // Schedule a local notification that will show even when app is in background
      const channelId = inAppNotificationService.getChannelForType(type);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: {
            eventId: event.id,
            eventType: event.type,
            notificationType: type,
            payoutPlanId: event.payout_plan_id,
            transactionId: event.transaction_id,
            route: this.getRouteForEvent(event.type),
          },
          sound: true,
          badge: 1,
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger: null, // Send immediately
      });

      console.log('✅ Push notification scheduled:', title);
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
    }
  }

  /**
   * Get route for event type
   */
  private getRouteForEvent(eventType: string): string {
    const routeMap: Record<string, string> = {
      payout_completed: '/all-payouts',
      payout_scheduled: '/all-payouts',
      withdrawal_scheduled: '/all-payouts',
      disbursement_failed: '/all-payouts',
      deposit_successful: '/(tabs)/',
      deposit_failed: '/(tabs)/',
      transaction_completed: '/transactions',
      transaction_failed: '/transactions',
      security_alert: '/profile',
      login_alert: '/profile',
      suspicious_activity: '/profile',
      vault_created: '/(tabs)/',
      account_created: '/(tabs)/',
      kyc_completed: '/profile',
      kyc_failed: '/profile',
    };
    return routeMap[eventType] || '/(tabs)/';
  }

  /**
   * Refresh badge count
   */
  private async refreshBadgeCount(): Promise<void> {
    if (!this.userId) return;
    try {
      const count = await inAppNotificationService.getUnreadCount(this.userId);
      await inAppNotificationService.setBadgeCount(count);
    } catch (error) {
      console.error('❌ Error refreshing badge count:', error);
    }
  }

  /**
   * Refresh badge count for missed notifications when app starts
   * NOTE: This does NOT send push notifications for old events.
   * Notifications are only sent when events happen in real-time.
   */
  async checkMissedNotifications(userId: string): Promise<void> {
    // Check if Supabase is configured before attempting to fetch
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping missed notifications check');
      return;
    }

    try {
      console.log('🔔 Refreshing badge count for unread notifications...');

      // Just refresh the badge count - don't send notifications for old events
      // Notifications are already in the database and will be shown in the notification center
      // Push notifications are only sent when events happen in real-time
      await this.refreshBadgeCount();
      
      console.log('✅ Badge count refreshed');
    } catch (error) {
      console.error('❌ Error refreshing badge count:', error);
    }
  }
}

export const backgroundNotificationService = BackgroundNotificationService.getInstance();

