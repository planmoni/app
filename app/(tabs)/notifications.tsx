import { TriangleAlert as AlertTriangle, Calendar, Check, Download, Shield, Smartphone, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type NotificationType = 'all' | 'payouts' | 'vaults' | 'security';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<NotificationType>('all');

  const notifications = [
    {
      id: '1',
      type: 'Payout Completed',
      message: '₦500,000 disbursed to your bank from \'Rent Vault\'',
      status: 'Success',
      statusColor: '#22C55E',
      statusBg: '#DCFCE7',
      time: '2h ago',
      icon: Wallet,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      unread: true,
      category: 'payouts',
    },
    {
      id: '2',
      type: 'Upcoming Payout',
      message: 'Next payout from \'Salary Vault\' is in 3 days',
      status: 'Scheduled',
      statusColor: '#3B82F6',
      statusBg: '#EFF6FF',
      time: '5h ago',
      icon: Calendar,
      iconBg: '#EFF6FF',
      iconColor: '#3B82F6',
      unread: true,
      category: 'payouts',
    },
    {
      id: '3',
      type: 'New Vault Created',
      message: 'You created a new vault: \'Emergency Fund\'',
      time: '1d ago',
      icon: Shield,
      iconBg: '#F0F9FF',
      iconColor: '#0EA5E9',
      unread: true,
      category: 'vaults',
    },
    {
      id: '4',
      type: 'Disbursement Failed',
      message: 'Disbursement from \'Car Fund\' failed due to insufficient balance',
      status: 'Failed',
      statusColor: '#EF4444',
      statusBg: '#FEE2E2',
      time: '2d ago',
      icon: AlertTriangle,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      category: 'payouts',
    },
    {
      id: '5',
      type: 'Security Reminder',
      message: 'Set up 2FA to better secure your account',
      time: '3d ago',
      icon: Shield,
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      unread: true,
      category: 'security',
    },
    {
      id: '6',
      type: 'Vault Matured',
      message: 'Vault \'School Fees\' has matured and funds are being disbursed',
      time: '1w ago',
      icon: Check,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      category: 'vaults',
    },
    {
      id: '7',
      type: 'App Update Available',
      message: 'Version 2.1.0 is now available with new features',
      time: '1w ago',
      icon: Smartphone,
      iconBg: '#F1F5F9',
      iconColor: '#64748B',
      category: 'security',
    },
    {
      id: '8',
      type: 'Funds Added',
      message: '₦1,000,000 added to your wallet balance',
      time: '2w ago',
      icon: Download,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      category: 'vaults',
    },
  ];

  const filteredNotifications = notifications.filter(
    notification => activeFilter === 'all' || notification.category === activeFilter
  );

  const handleMarkAllAsRead = () => {
    // Implement mark all as read functionality
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable style={styles.markAllButton} onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterContent}
        >
          <Pressable 
            style={[styles.filterButton, activeFilter === 'all' && styles.activeFilterButton]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>
              All
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterButton, activeFilter === 'payouts' && styles.activeFilterButton]}
            onPress={() => setActiveFilter('payouts')}
          >
            <Text style={[styles.filterText, activeFilter === 'payouts' && styles.activeFilterText]}>
              Payouts
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterButton, activeFilter === 'vaults' && styles.activeFilterButton]}
            onPress={() => setActiveFilter('vaults')}
          >
            <Text style={[styles.filterText, activeFilter === 'vaults' && styles.activeFilterText]}>
              Vaults
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterButton, activeFilter === 'security' && styles.activeFilterButton]}
            onPress={() => setActiveFilter('security')}
          >
            <Text style={[styles.filterText, activeFilter === 'security' && styles.activeFilterText]}>
              Security
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView style={styles.notificationsList}>
        {filteredNotifications.map((notification) => (
          <Pressable 
            key={notification.id} 
            style={[styles.notification, notification.unread && styles.unreadNotification]}
          >
            <View style={[styles.notificationIcon, { backgroundColor: notification.iconBg }]}>
              <notification.icon size={20} color={notification.iconColor} />
            </View>
            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationType}>{notification.type}</Text>
                <Text style={styles.notificationTime}>{notification.time}</Text>
              </View>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              {notification.status && (
                <View style={[styles.statusTag, { backgroundColor: notification.statusBg }]}>
                  <Text style={[styles.statusText, { color: notification.statusColor }]}>
                    {notification.status}
                  </Text>
                </View>
              )}
            </View>
            {notification.unread && <View style={styles.unreadDot} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingTop: 50, // Add padding to account for status bar
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
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
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
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