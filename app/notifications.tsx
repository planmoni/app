import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  type ListRenderItem,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  Calendar,
  Shield,
  ShieldUser,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';
import { syncBadgeCount as syncBadge } from '@/lib/badge-sync';
import type { NotificationEvent } from '@/lib/queries/notificationsQueries';

type DisplayNotification = NotificationEvent & {
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
  const {
    notifications,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotificationsQuery();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        void syncBadge(session.user.id);
      }
    }, [session?.user?.id])
  );

  const formatNotification = useCallback(
    (event: NotificationEvent): DisplayNotification => {
      let icon = Info;
      let iconBg = colors.backgroundTertiary;
      let iconColor = colors.textSecondary;
      let statusColor: string | undefined;
      let statusBg: string | undefined;

      switch (event.type) {
        case 'deposit_successful':
          icon = ArrowDownRight;
          iconBg = colors.accent;
          iconColor = colors.primary;
          statusColor = colors.primary;
          statusBg = colors.accent;
          break;
        case 'payout_completed':
          if (event.title?.toLowerCase().includes('emergency withdrawal')) {
            icon = ArrowUpRight;
            iconBg = '#F97316';
            iconColor = '#fff';
            statusColor = '#fff';
            statusBg = '#F97316';
          } else {
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
          break;
      }

      return { ...event, icon, iconBg, iconColor, statusColor, statusBg };
    },
    [colors, isDark]
  );

  const displayNotifications = useMemo(
    () => notifications.map(formatNotification),
    [notifications, formatNotification]
  );

  const handleRefresh = async () => {
    haptics.lightImpact();
    setIsRefreshing(true);
    try {
      await refetch();
      if (session?.user?.id) await syncBadge(session.user.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!session?.user?.id) {
      showToast('Please login to mark notifications as read', 'error');
      return;
    }
    const unreadCount = notifications.filter((n) => n.status === 'unread').length;
    if (unreadCount === 0) {
      showToast('All notifications are already read', 'info');
      return;
    }
    try {
      haptics.mediumImpact();
      await markAllAsRead();
      showToast(
        `Marked ${unreadCount} notification${unreadCount > 1 ? 's' : ''} as read`,
        'success'
      );
    } catch {
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  };

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const styles = createStyles(colors, isDark);

  const renderItem: ListRenderItem<DisplayNotification> = ({ item: notification }) => (
    <Pressable
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
              {notification.status === 'unread' && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationTime}>
              {formatTimeAgo(new Date(notification.created_at))}
            </Text>
          </View>
          <Text style={styles.notificationMessage}>{notification.description}</Text>
          {notification.statusColor && notification.statusBg && (
            <View style={[styles.statusTag, { backgroundColor: notification.statusBg }]}>
              {(notification.type === 'deposit_successful' ||
                notification.type === 'payout_completed') && (
                <CheckCircle2 size={12} color={notification.statusColor} />
              )}
              {(notification.type === 'payout_scheduled' ||
                notification.type === 'withdrawal_scheduled') && (
                <Clock size={12} color={notification.statusColor} />
              )}
              {notification.type === 'disbursement_failed' && (
                <XCircle size={12} color={notification.statusColor} />
              )}
              <Text style={[styles.statusText, { color: notification.statusColor }]}>
                {notification.type === 'deposit_successful'
                  ? 'Deposit'
                  : notification.type === 'payout_completed' &&
                      notification.title?.toLowerCase().includes('emergency withdrawal')
                    ? 'Withdrawal'
                    : notification.type === 'payout_completed'
                      ? 'Completed'
                      : notification.type === 'payout_scheduled' &&
                          notification.title?.toLowerCase().includes('payout initiated')
                        ? 'DISBURSED'
                        : notification.type === 'payout_scheduled'
                          ? 'Scheduled'
                          : notification.type === 'withdrawal_scheduled'
                            ? 'Scheduled'
                            : notification.type === 'disbursement_failed'
                              ? 'Failed'
                              : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Activities</Text>
        <Pressable
          style={[
            styles.markAllButton,
            (isMarkingAllAsRead || !notifications.some((n) => n.status === 'unread')) &&
              styles.markAllButtonDisabled,
          ]}
          onPress={handleMarkAllAsRead}
          disabled={isMarkingAllAsRead || !notifications.some((n) => n.status === 'unread')}
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
  );

  // Warm cache: no full-screen spinner when we already have rows
  if (isLoading && displayNotifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading activities..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}

      {error && displayNotifications.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : !session?.user?.id ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No activities</Text>
          <Text style={styles.emptySubtext}>Login to see activities</Text>
        </View>
      ) : (
        <FlatList
          data={displayNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.notificationsList}
          contentContainerStyle={
            displayNotifications.length === 0 ? styles.emptyListContent : { paddingBottom: 24 }
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bell size={64} color={colors.textTertiary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No activities</Text>
              <Text style={styles.emptySubtext}>Your recent activities will appear here</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      minHeight: 320,
    },
    emptyListContent: {
      flexGrow: 1,
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
    footerLoader: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  });

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInDays / 365)}y ago`;
}
