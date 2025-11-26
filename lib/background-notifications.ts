import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { inAppNotificationService } from './in-app-notifications';

/**
 * Background Notification Service
 * Handles local notifications when app is open using expo-notifications.
 * Also schedules local notifications for immediate feedback.
 * Server-side push notifications work when the app is closed.
 */

class BackgroundNotificationService {
  private static instance: BackgroundNotificationService;
  private isListening = false;
  private userId: string | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
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
   * Start listening for notifications to schedule local notifications and refresh badge
   * Local notifications use expo-notifications for immediate feedback when app is open
   * Server-side push notifications work when the app is closed
   */
  async startListening(userId: string): Promise<void> {
    if (this.isListening && this.userId === userId) {
      console.log('🔔 Already listening for notifications');
      return;
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping notification subscription');
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

      // Subscribe to notifications table to schedule local notifications when app is open
      // Server-side push notifications also work when the app is closed
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
            console.log('🔔 New notification received, scheduling local notification:', payload.new);
            await this.handleNewNotification(payload.new);
          }
        )
        .subscribe();
      
      // Refresh badge count on initialization
      this.refreshBadgeCount();
      
      console.log('✅ Notification subscription active - local notifications enabled');
    } catch (error) {
      console.error('❌ Error setting up background notification service:', error);
      // Don't throw - allow app to continue
      this.isListening = false;
    }
  }

  /**
   * Stop listening for notifications
   */
  stopListening(): void {
    console.log('🔔 Stopping background notification service');
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
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
   * Handle new notification from database
   * Schedules local notification using expo-notifications for immediate feedback when app is open
   * Server-side push notifications also work when the app is closed
   */
  private async handleNewNotification(notification: any): Promise<void> {
    try {
      // Skip if already read
      if (notification.is_read) {
        return;
      }

      // Schedule local notification using expo-notifications for immediate feedback
      // This works when the app is open or in background
      try {
        const prefs = await inAppNotificationService.getNotificationPreferences(this.userId!);
        const shouldShow = prefs 
          ? (prefs.local_notifications_enabled && this.shouldShowNotification(notification.type, prefs))
          : true; // Default to true if preferences unavailable
        
        if (shouldShow) {
          await inAppNotificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            {
              ...notification.data,
              notificationId: notification.id,
              type: notification.type,
            }
          );
          console.log('✅ Local notification scheduled via expo-notifications:', notification.title);
        }
      } catch (error) {
        console.error('Error scheduling local notification:', error);
        // Still refresh badge even if local notification fails
      }

      // Refresh badge count
      await this.refreshBadgeCount();
    } catch (error) {
      console.error('❌ Error handling new notification:', error);
    }
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(
    type: string,
    prefs: any
  ): boolean {
    const typeMap: Record<string, string> = {
      transaction: 'transaction_alerts',
      payout: 'payout_alerts',
      security: 'security_alerts',
      marketing: 'marketing_alerts',
      system: 'system_alerts',
    };
    const prefKey = typeMap[type];
    return prefKey ? (prefs[prefKey] !== false) : true;
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
   * Push notifications are handled server-side via database triggers and cron job
   */
  async checkMissedNotifications(userId: string): Promise<void> {
    // Check if Supabase is configured before attempting to fetch
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping missed notifications check');
      return;
    }

    try {
      console.log('🔔 Refreshing badge count for unread notifications...');

      // Just refresh the badge count - push notifications are handled server-side
      await this.refreshBadgeCount();
      
      console.log('✅ Badge count refreshed');
    } catch (error) {
      console.error('❌ Error refreshing badge count:', error);
    }
  }
}

export const backgroundNotificationService = BackgroundNotificationService.getInstance();

