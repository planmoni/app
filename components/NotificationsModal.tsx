import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { X, Wallet, Calendar, Shield, Bell, TriangleAlert as AlertTriangle, Smartphone, Check, Download } from 'lucide-react-native';

type NotificationsModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function NotificationsModal({ isVisible, onClose }: NotificationsModalProps) {
  if (!isVisible) return null;

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
    },
    {
      id: '6',
      type: 'Vault Matured',
      message: 'Vault \'School Fees\' has matured and funds are being disbursed',
      time: '1w ago',
      icon: Check,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
    },
    {
      id: '7',
      type: 'App Update Available',
      message: 'Version 2.1.0 is now available with new features',
      time: '1w ago',
      icon: Smartphone,
      iconBg: '#F1F5F9',
      iconColor: '#64748B',
    },
    {
      id: '8',
      type: 'Funds Added',
      message: '₦1,000,000 added to your wallet balance',
      time: '2w ago',
      icon: Download,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
    },
  ];

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Bell size={20} color="#1E293B" />
              <Text style={styles.headerTitle}>Notifications</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable style={styles.markAllButton}>
                <Text style={styles.markAllText}>Mark all as read</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            <Pressable style={[styles.filterButton, styles.activeFilterButton]}>
              <Text style={[styles.filterText, styles.activeFilterText]}>All</Text>
            </Pressable>
            <Pressable style={styles.filterButton}>
              <Text style={styles.filterText}>Payouts</Text>
            </Pressable>
            <Pressable style={styles.filterButton}>
              <Text style={styles.filterText}>Vaults</Text>
            </Pressable>
            <Pressable style={styles.filterButton}>
              <Text style={styles.filterText}>Security</Text>
            </Pressable>
          </ScrollView>

          <ScrollView 
            style={styles.notificationsList}
            showsVerticalScrollIndicator={false}
          >
            {notifications.map((notification) => (
              <Pressable 
                key={notification.id} 
                style={styles.notification}
                onPress={() => {}}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 400,
    height: '90%',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: 80,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterContent: {
    padding: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#1E3A8A',
  },
  filterText: {
    fontSize: 14,
    color: '#64748B',
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#FFFFFF',
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
    marginRight: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  notificationTime: {
    fontSize: 12,
    color: '#64748B',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#64748B',
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
    backgroundColor: '#1E3A8A',
  },
});