import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { TriangleAlert as AlertTriangle, Calendar, Check, Download, Shield, Smartphone, Wallet, ArrowLeft, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import PlanmoniLoader from '@/components/PlanmoniLoader';

type Notification = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: 'unread' | 'read';
  payout_plan_id: string | null;
  transaction_id: string | null;
  created_at: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  statusColor?: string;
  statusBg?: string;
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
    }
  }, [session?.user?.id]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Format notifications for display
      const formattedNotifications = data?.map(formatNotification) || [];
      setNotifications(formattedNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNotification = (event: any): Notification => {
    // Determine icon and colors based on type
    let icon = Wallet;
    let iconBg = '#DCFCE7';
    let iconColor = '#22C55E';
    let statusColor, statusBg;

    switch (event.type) {
      case 'payout_completed':
        icon = Wallet;
        iconBg = '#DCFCE7';
        iconColor = '#22C55E';
        statusColor = '#22C55E';
        statusBg = '#DCFCE7';
        break;
      case 'payout_scheduled':
        icon = Calendar;
        iconBg = '#EFF6FF';
        iconColor = '#1E3A8A';
        statusColor = '#1E3A8A';
        statusBg = '#EFF6FF';
        break;
      case 'vault_created':
        icon = Shield;
        iconBg = '#F0F9FF';
        iconColor = '#0EA5E9';
        break;
      case 'disbursement_failed':
        icon = AlertTriangle;
        iconBg = '#FEE2E2';
        iconColor = '#EF4444';
        statusColor = '#EF4444';
        statusBg = '#FEE2E2';
        break;
      case 'security_alert':
        icon = Shield;
        iconBg = '#FEF3C7';
        iconColor = '#D97706';
        break;
      default:
        icon = Smartphone;
        iconBg = '#F1F5F9';
        iconColor = '#64748B';
    }

    return {
      ...event,
      icon,
      iconBg,
      iconColor,
      statusColor,
      statusBg,
    };
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'read' })
        .eq('user_id', session?.user?.id)
        .eq('status', 'unread');

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          status: 'read'
        }))
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'read' })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, status: 'read' } 
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      marginLeft: 12,
    },
    markAllButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    markAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    notificationsList: {
      flex: 1,
    },
    notification: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    unreadNotification: {
      backgroundColor: colors.backgroundSecondary,
    },
    notificationIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    notificationContent: {
      flex: 1,
      marginRight: 24,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    notificationType: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    notificationMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    statusTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
    },
    unreadDot: {
      position: 'absolute',
      top: 20,
      right: 16,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Pressable style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading notifications..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable style={styles.markAllButton} onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications</Text>
          <Text style={styles.emptySubtext}>
            You don't have any notifications yet
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.notificationsList}>
          {notifications.map((notification) => (
            <Pressable 
              key={notification.id} 
              style={[styles.notification, notification.status === 'unread' && styles.unreadNotification]}
              onPress={() => handleMarkAsRead(notification.id)}
            >
              <View style={[styles.notificationIcon, { backgroundColor: notification.iconBg }]}>
                <notification.icon size={20} color={notification.iconColor} />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationType}>{notification.title}</Text>
                  <Text style={styles.notificationTime}>
                    {formatTimeAgo(new Date(notification.created_at))}
                  </Text>
                </View>
                <Text style={styles.notificationMessage}>{notification.description}</Text>
                {notification.statusColor && notification.statusBg && (
                  <View style={[styles.statusTag, { backgroundColor: notification.statusBg }]}>
                    <Text style={[styles.statusText, { color: notification.statusColor }]}>
                      {notification.type === 'payout_completed' ? 'Success' : 
                       notification.type === 'payout_scheduled' ? 'Scheduled' : 
                       notification.type === 'disbursement_failed' ? 'Failed' : ''}
                    </Text>
                  </View>
                )}
              </View>
              {notification.status === 'unread' && <View style={styles.unreadDot} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}