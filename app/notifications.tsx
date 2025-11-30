import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { 
  TriangleAlert as AlertTriangle, 
  Calendar, 
  Check, 
  Shield, 
  Smartphone, 
  Wallet, 
  ArrowLeft, 
  Bell, 
  ShieldUser,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import * as Notifications from 'expo-notifications';
import { syncBadgeCount as syncBadge } from '@/lib/badge-sync';

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
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
      syncBadgeCount(); // Sync badge count when screen loads

      // Poll for updates every 30 seconds instead of real-time subscription
      // Server-side push notifications handle delivery when app is closed
      const pollInterval = setInterval(() => {
        fetchNotifications(true); // Refresh notifications
        syncBadgeCount(); // Sync badge count on refresh
      }, 30000); // Poll every 30 seconds

      return () => {
        clearInterval(pollInterval);
      };
    } else {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Sync badge count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (session?.user?.id) {
        syncBadgeCount();
      }
    }, [session?.user?.id])
  );

  const syncBadgeCount = async () => {
    if (!session?.user?.id) return;
    await syncBadge(session.user.id);
  };

  const fetchNotifications = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
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
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    haptics.lightImpact();
    await fetchNotifications(true);
    await syncBadgeCount(); // Sync badge count on manual refresh
  };

  const formatNotification = (event: any): Notification => {
    // Determine icon and colors based on type using theme colors
    let icon = Wallet;
    let iconBg = colors.successLight;
    let iconColor = colors.success;
    let statusColor, statusBg;

    switch (event.type) {
      case 'deposit_successful':
        icon = ArrowDownRight;
        iconBg = colors.accent;
        iconColor = colors.primary;
        statusColor = colors.primary;
        statusBg = colors.accent;
        break;
      case 'payout_completed':
        // Check if this is an emergency withdrawal by checking the title
        if (event.title && event.title.toLowerCase().includes('emergency withdrawal')) {
          // Emergency withdrawal - use yellow/orange color like MostRecentPayoutsCard
          icon = ArrowUpRight;
          iconBg = '#F97316';
          iconColor = '#fff'; // Orange color matching MostRecentPayoutsCard
          statusColor = '#fff';
          statusBg = '#F97316';
        } else {
          // Regular payout completion
          icon = ArrowUpRight;
          iconBg = colors.successLight;
          iconColor = colors.success;
          statusColor = colors.success;
          statusBg = colors.successLight;
        }
        break;
      case 'payout_scheduled':
      case 'withdrawal_scheduled':
        icon = Calendar;
        iconBg = colors.primary;
        iconColor = colors.accent;
        statusColor = colors.accent;
        statusBg = colors.primary;
        break;
      case 'vault_created':
        icon = Shield;
        iconBg = isDark ? 'rgba(14, 165, 233, 0.15)' : '#F0F9FF';
        iconColor = '#0EA5E9';
        break;
      case 'disbursement_failed':
        icon = XCircle;
        iconBg = colors.errorLight;
        iconColor = colors.error;
        statusColor = colors.error;
        statusBg = colors.errorLight;
        break;
      case 'security_alert':
        icon = ShieldUser;
        iconBg = colors.warningLight;
        iconColor = colors.warning;
        break;
      default:
        icon = Info;
        iconBg = colors.backgroundTertiary;
        iconColor = colors.textSecondary;
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
    if (!session?.user?.id) {
      showToast('Please login to mark notifications as read', 'error');
      return;
    }

    // Check if there are any unread notifications
    const hasUnreadNotifications = notifications.some(n => n.status === 'unread');
    if (!hasUnreadNotifications) {
      showToast('All notifications are already read', 'info');
      return;
    }

    try {
      setIsMarkingAllAsRead(true);
      haptics.mediumImpact();
      
      // Count unread notifications before updating
      const unreadCount = notifications.filter(n => n.status === 'unread').length;
      
      const { error } = await supabase
        .from('events')
        .update({ status: 'read' })
        .eq('user_id', session.user.id)
        .eq('status', 'unread');

      if (error) {
        console.error('Error marking notifications as read:', error);
        throw error;
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          status: 'read' as const
        }))
      );
      
      // Sync badge count after marking all as read (should be 0)
      await syncBadgeCount();
      
      // Show success message
      showToast(
        unreadCount > 0 
          ? `Marked ${unreadCount} notification${unreadCount > 1 ? 's' : ''} as read` 
          : 'All notifications marked as read',
        'success'
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      showToast('Failed to mark notifications as read', 'error');
    } finally {
      setIsMarkingAllAsRead(false);
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
      
      // Sync badge count after marking as read
      if (session?.user?.id) {
        await syncBadgeCount();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const styles = createStyles(colors, isDark);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Activities</Text>
            <Pressable 
              style={[
                styles.markAllButton,
                (isMarkingAllAsRead || !notifications.some(n => n.status === 'unread')) && styles.markAllButtonDisabled
              ]} 
              onPress={handleMarkAllAsRead}
              disabled={isMarkingAllAsRead || !notifications.some(n => n.status === 'unread')}
            >
              {isMarkingAllAsRead ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.markAllText}>Marking...</Text>
                </>
              ) : (
                <Text style={styles.markAllText}>Mark all as read</Text>
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading activities..." />
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
          <Text style={styles.headerTitle}>Activities</Text>
          <Pressable 
            style={[
              styles.markAllButton,
              (isMarkingAllAsRead || !notifications.some(n => n.status === 'unread')) && styles.markAllButtonDisabled
            ]} 
            onPress={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead || !notifications.some(n => n.status === 'unread')}
          >
            {isMarkingAllAsRead ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.markAllText}>Marking...</Text>
              </>
            ) : (
              <Text style={styles.markAllText}>Mark all as read</Text>
            )}
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => fetchNotifications(false)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : !session?.user?.id ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No activities</Text>
          <Text style={styles.emptySubtext}>
            Login to see activities
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bell size={64} color={colors.textTertiary} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No activities</Text>
          <Text style={styles.emptySubtext}>
            Your recent activities will appear here
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.notificationsList}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {notifications.map((notification) => (
            <Pressable 
              key={notification.id} 
              style={[styles.notification, notification.status === 'unread' && styles.unreadNotification]}
              onPress={() => handleMarkAsRead(notification.id)}
            >
              <View style={styles.notificationContentWrapper}>
                <View style={[styles.notificationIcon, { backgroundColor: notification.iconBg }]}>
                  <notification.icon size={24} color={notification.iconColor} strokeWidth={2} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={styles.notificationType}>{notification.title}</Text>
                      {notification.status === 'unread' && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                    <Text style={styles.notificationTime}>
                      {formatTimeAgo(new Date(notification.created_at))}
                    </Text>
                  </View>
                  <Text style={styles.notificationMessage}>{notification.description}</Text>
                  {notification.statusColor && notification.statusBg && (
                    <View style={[styles.statusTag, { backgroundColor: notification.statusBg }]}>
                      {notification.type === 'deposit_successful' && (
                        <CheckCircle2 size={12} color={notification.statusColor} />
                      )}
                      {notification.type === 'payout_completed' && (
                        <>
                          {notification.title && notification.title.toLowerCase().includes('emergency withdrawal') ? (
                            <CheckCircle2 size={12} color={notification.statusColor} />
                          ) : (
                            <CheckCircle2 size={12} color={notification.statusColor} />
                          )}
                        </>
                      )}
                      {(notification.type === 'payout_scheduled' || notification.type === 'withdrawal_scheduled') && (
                        <Clock size={12} color={notification.statusColor} />
                      )}
                      {notification.type === 'disbursement_failed' && (
                        <XCircle size={12} color={notification.statusColor} />
                      )}
                      <Text style={[styles.statusText, { color: notification.statusColor }]}>
                        {notification.type === 'deposit_successful' ? 'Deposit' :
                         notification.type === 'payout_completed' && notification.title && notification.title.toLowerCase().includes('emergency withdrawal') ? 'Withdrawal' :
                         notification.type === 'payout_completed' ? 'Completed' : 
                         notification.type === 'payout_scheduled' && notification.title && notification.title.toLowerCase().includes('payout initiated') ? 'DISBURSED' :
                         notification.type === 'payout_scheduled' ? 'Scheduled' :
                         notification.type === 'withdrawal_scheduled' ? 'Scheduled' : 
                         notification.type === 'disbursement_failed' ? 'Failed' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginLeft: 12,
  },
  markAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
    opacity: 1,
  },
  markAllButtonDisabled: {
    opacity: 0.4,
  },
  markAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
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
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
   
  },
  unreadNotification: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 1.5,
  
  },
  notificationContentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  statusTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
});

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