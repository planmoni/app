import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { inAppNotificationService, InAppNotification } from '@/lib/in-app-notifications';
import { backgroundNotificationService } from '@/lib/background-notifications';
import { useAuth } from './AuthContext';

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      // Stop listening if user logs out
      backgroundNotificationService.stopListening();
      return;
    }

    const initializeNotifications = async () => {
      console.log('🔔 Initializing notifications for user:', user.id);
      
      const hasPermission = await inAppNotificationService.requestPermissions();
      console.log('🔔 Notification permissions granted:', hasPermission);

      if (hasPermission) {
        // Start background notification listener for events
        // This will listen for NEW events and send notifications in real-time
        await backgroundNotificationService.startListening(user.id);
        console.log('✅ Background notification listener started');

        // Refresh badge count for existing unread notifications
        // NOTE: This does NOT send push notifications - only refreshes the badge
        await backgroundNotificationService.checkMissedNotifications(user.id);
      } else {
        console.warn('⚠️ Notification permissions not granted');
      }

      await refreshUnreadCount();

      // Real-time subscriptions disabled - server-side push notifications handle delivery
      // No need to subscribe to notifications table changes
      
      return () => {
        // Cleanup function (no-op since we're not subscribing)
      };
    };

    const cleanup = initializeNotifications();

    return () => {
      cleanup.then(unsub => {
        if (unsub) unsub();
      });
      inAppNotificationService.removeListeners();
      backgroundNotificationService.stopListening();
    };
  }, [user?.id]);

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
