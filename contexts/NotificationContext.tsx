import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { inAppNotificationService, InAppNotification } from '@/lib/in-app-notifications';
import { useAuth } from './AuthContext';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  createNotification: (
    title: string,
    message: string,
    type: InAppNotification['type'],
    data?: Record<string, any>
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const initializeNotifications = async () => {
      console.log('🔔 Initializing notifications for user:', user.id);
      
      const hasPermission = await inAppNotificationService.requestPermissions();
      console.log('🔔 Notification permissions granted:', hasPermission);

      if (hasPermission) {
        console.log('🔔 Setting up notification listeners...');
        inAppNotificationService.setupListeners(
          (notification) => {
            console.log('🔔 Foreground notification received:', notification.request.content.title);
            Toast.show({
              type: 'info',
              text1: notification.request.content.title || 'New Notification',
              text2: notification.request.content.body || undefined,
              visibilityTime: 4000,
              autoHide: true,
              topOffset: 50,
              onPress: () => {
                // Handle navigation when toast is tapped
                const data = notification.request.content.data;
                handleNotificationNavigation(data);
              },
            });
            refreshUnreadCount();
          },
          (data) => {
            console.log('🔔 Notification tapped:', data);
            handleNotificationNavigation(data);
          }
        );
        console.log('✅ Notification listeners set up successfully');
      } else {
        console.warn('⚠️ Notification permissions not granted');
      }

      await refreshUnreadCount();

      const unsubscribe = inAppNotificationService.subscribeToNotifications(
        user.id,
        async (notification) => {
          console.log('New notification via realtime:', notification);

          Toast.show({
            type: 'info',
            text1: notification.title,
            text2: notification.message,
            visibilityTime: 4000,
            autoHide: true,
            topOffset: 50,
            onPress: () => {
              // Handle navigation when toast is tapped
              const data = notification.data || {};
              handleNotificationNavigation(data);
            },
          });

          await refreshUnreadCount();
        }
      );

      return unsubscribe;
    };

    const cleanup = initializeNotifications();

    return () => {
      cleanup.then(unsub => {
        if (unsub) unsub();
      });
      inAppNotificationService.removeListeners();
    };
  }, [user?.id]);

  const handleNotificationNavigation = (data: any) => {
    if (!data) return;

    // If route is specified in data, use it
    if (data.route) {
      console.log('Navigating to route from notification:', data.route);
      router.push(data.route as any);
      return;
    }

    // Otherwise, navigate based on notification type
    if (data.type) {
      switch (data.type) {
        case 'payout':
        case 'payout_completed':
        case 'payout_scheduled':
          console.log('Navigating to all-payouts for payout notification');
          router.push('/all-payouts' as any);
          break;
        case 'transaction':
        case 'deposit_successful':
          console.log('Navigating to home for transaction notification');
          router.push('/(tabs)/' as any);
          break;
        case 'security':
        case 'security_alert':
          console.log('Navigating to profile for security notification');
          router.push('/profile' as any);
          break;
        default:
          console.log('No navigation for notification type:', data.type);
      }
    }
  };

  const refreshUnreadCount = async () => {
    if (!user?.id) return;
    const count = await inAppNotificationService.getUnreadCount(user.id);
    setUnreadCount(count);
    await inAppNotificationService.setBadgeCount(count);
  };

  const createNotification = async (
    title: string,
    message: string,
    type: InAppNotification['type'],
    data?: Record<string, any>
  ) => {
    if (!user?.id) return;
    await inAppNotificationService.createNotification(user.id, title, message, type, data, true);
    await refreshUnreadCount();
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        createNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
