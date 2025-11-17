import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'transaction' | 'payout' | 'security' | 'marketing' | 'system';
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  transaction_alerts: boolean;
  payout_alerts: boolean;
  security_alerts: boolean;
  marketing_alerts: boolean;
  system_alerts: boolean;
  local_notifications_enabled: boolean;
  notification_sound: boolean;
}

class InAppNotificationService {
  private static instance: InAppNotificationService;
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;

  private constructor() {}

  static getInstance(): InAppNotificationService {
    if (!InAppNotificationService.instance) {
      InAppNotificationService.instance = new InAppNotificationService();
    }
    return InAppNotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E3A8A',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('transactions', {
        name: 'Transactions',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('payouts', {
        name: 'Payouts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('security', {
        name: 'Security Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
        sound: 'default',
      });
    }

    return true;
  }

  setupListeners(onNotificationReceived?: (notification: Notifications.Notification) => void, onNotificationTapped?: (data: any) => void) {
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      onNotificationTapped?.(data);
    });
  }

  removeListeners() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
  }

  async scheduleLocalNotification(
    title: string,
    message: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const channelId = data?.type ? this.getChannelForType(data.type) : 'default';

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: data || {},
        sound: 'default',
        badge: 1,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: trigger || null,
    });
  }

  private getChannelForType(type: string): string {
    const channelMap: Record<string, string> = {
      transaction: 'transactions',
      payout: 'payouts',
      security: 'security',
      marketing: 'default',
      system: 'default',
    };
    return channelMap[type] || 'default';
  }

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: InAppNotification['type'],
    data?: Record<string, any>,
    scheduleLocal: boolean = true
  ): Promise<string | null> {
    try {
      const { data: notificationData, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          data: data || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      if (scheduleLocal) {
        const prefs = await this.getNotificationPreferences(userId);
        if (prefs?.local_notifications_enabled && this.shouldShowNotification(type, prefs)) {
          await this.scheduleLocalNotification(title, message, { ...data, notificationId: notificationData.id, type });
        }
      }

      return notificationData.id;
    } catch (error) {
      console.error('Error in createNotification:', error);
      return null;
    }
  }

  private shouldShowNotification(type: InAppNotification['type'], prefs: NotificationPreferences): boolean {
    const typeMap: Record<InAppNotification['type'], keyof NotificationPreferences> = {
      transaction: 'transaction_alerts',
      payout: 'payout_alerts',
      security: 'security_alerts',
      marketing: 'marketing_alerts',
      system: 'system_alerts',
    };
    const prefKey = typeMap[type];
    return prefs[prefKey] as boolean;
  }

  async getNotifications(userId: string, limit: number = 50): Promise<InAppNotification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getNotifications:', error);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      // Update notification to read status
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      // Update all unread notifications for the user
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      return false;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteNotification:', error);
      return false;
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching preferences:', error);
        return null;
      }

      // Map from database format to interface format
      const prefs = data?.notification_preferences || {};
      return {
        transaction_alerts: prefs.deposits ?? true,
        payout_alerts: prefs.payouts ?? true,
        security_alerts: prefs.security ?? true,
        marketing_alerts: prefs.general ?? false,
        system_alerts: prefs.general ?? true,
        local_notifications_enabled: true,
        notification_sound: true,
      };
    } catch (error) {
      console.error('Error in getNotificationPreferences:', error);
      return null;
    }
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      // Map from interface format to database format
      const dbPreferences: any = {};
      if (preferences.transaction_alerts !== undefined) {
        dbPreferences.deposits = preferences.transaction_alerts;
      }
      if (preferences.payout_alerts !== undefined) {
        dbPreferences.payouts = preferences.payout_alerts;
      }
      if (preferences.security_alerts !== undefined) {
        dbPreferences.security = preferences.security_alerts;
      }
      if (preferences.marketing_alerts !== undefined || preferences.system_alerts !== undefined) {
        dbPreferences.general = preferences.marketing_alerts ?? preferences.system_alerts ?? false;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: dbPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateNotificationPreferences:', error);
      return false;
    }
  }

  async schedulePayoutReminder(
    userId: string,
    payoutDate: Date,
    payoutAmount: number,
    accountName: string
  ): Promise<string | null> {
    const now = new Date();
    const dayBefore = new Date(payoutDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);

    if (dayBefore > now) {
      const secondsUntilNotification = Math.floor((dayBefore.getTime() - now.getTime()) / 1000);

      const notificationId = await this.scheduleLocalNotification(
        'Payout Reminder',
        `Your payout of ₦${payoutAmount.toLocaleString()} to ${accountName} is scheduled for tomorrow.`,
        { type: 'payout', payoutDate: payoutDate.toISOString() },
        secondsUntilNotification > 0 ? { seconds: secondsUntilNotification } as Notifications.NotificationTriggerInput : null
      );

      return notificationId;
    }

    return null;
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  subscribeToNotifications(
    userId: string,
    onNotification: (notification: InAppNotification) => void
  ): () => void {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log('New notification received via realtime:', payload);
          onNotification(payload.new as InAppNotification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const inAppNotificationService = InAppNotificationService.getInstance();
