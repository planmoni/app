// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   FlatList,
//   TouchableOpacity,
//   RefreshControl,
//   ActivityIndicator,
// } from 'react-native';
// import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { inAppNotificationService, InAppNotification } from '@/lib/in-app-notifications';
// import { backgroundNotificationService } from '@/lib/background-notifications';
// import { useAuth } from '@/contexts/AuthContext';
// import { useRouter } from 'expo-router';
// import { supabase } from '@/lib/supabase';
// 
// function formatDate(dateString: string): string {
//   const date = new Date(dateString);
//   const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
//   const month = months[date.getMonth()];
//   const day = date.getDate();
//   let hours = date.getHours();
//   const minutes = date.getMinutes();
//   const ampm = hours >= 12 ? 'PM' : 'AM';
//   hours = hours % 12 || 12;
//   const minutesStr = minutes < 10 ? '0' + minutes : minutes;
//   return `${month} ${day}, ${hours}:${minutesStr} ${ampm.toLowerCase()}`;
// }
// 
// interface NotificationCenterProps {
//   onClose: () => void;
//   onNotificationPress?: (notification: InAppNotification) => void;
// }
// 
// export function NotificationCenter({ onClose, onNotificationPress }: NotificationCenterProps) {
//   const { colors } = useTheme();
//   const { user } = useAuth();
//   const router = useRouter();
//   const [notifications, setNotifications] = useState<InAppNotification[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [filter, setFilter] = useState<'all' | 'unread'>('all');
// 
//   useEffect(() => {
//     loadNotifications();
// 
//     // Poll for updates every 30 seconds instead of real-time subscriptions
//     // Server-side push notifications handle delivery when app is closed
//     if (user?.id) {
//       const pollInterval = setInterval(() => {
//         loadNotifications();
//       }, 30000); // Poll every 30 seconds
// 
//       return () => {
//         clearInterval(pollInterval);
//       };
//     }
//   }, [user?.id]);
// 
//   const loadNotifications = async () => {
//     if (!user?.id) return;
// 
//     try {
//       setLoading(true);
//       const data = await inAppNotificationService.getNotifications(user.id);
//       setNotifications(data);
//     } catch (error) {
//       console.error('Error loading notifications:', error);
//     } finally {
//       setLoading(false);
//     }
//   };
// 
//   const handleRefresh = async () => {
//     setRefreshing(true);
//     await loadNotifications();
//     setRefreshing(false);
//   };
// 
//   const handleMarkAsRead = async (notificationId: string) => {
//     const success = await inAppNotificationService.markAsRead(notificationId);
//     if (success) {
//       setNotifications(prev =>
//         prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
//       );
//       // Refresh badge count after marking as read
//       if (user?.id) {
//         const count = await inAppNotificationService.getUnreadCount(user.id);
//         await inAppNotificationService.setBadgeCount(count);
//       }
//     }
//   };
// 
//   const handleMarkAllAsRead = async () => {
//     if (!user?.id) return;
//     const success = await inAppNotificationService.markAllAsRead(user.id);
//     if (success) {
//       setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
//       // Clear badge count after marking all as read
//       await inAppNotificationService.clearBadge();
//     }
//   };
// 
//   const handleDelete = async (notificationId: string) => {
//     const success = await inAppNotificationService.deleteNotification(notificationId);
//     if (success) {
//       setNotifications(prev => prev.filter(n => n.id !== notificationId));
//     }
//   };
// 
//   const handleNotificationPress = (notification: InAppNotification) => {
//     if (!notification.is_read) {
//       handleMarkAsRead(notification.id);
//     }
//     
//     // If custom handler is provided, use it
//     if (onNotificationPress) {
//       onNotificationPress(notification);
//       return;
//     }
//     
//     // Otherwise, handle navigation here
//     const data = notification.data || {};
//     
//     // If route is specified in data, use it
//     if (data.route) {
//       console.log('Navigating to route from notification:', data.route);
//       onClose(); // Close the notification center
//       router.push(data.route as any);
//       return;
//     }
//     
//     // Otherwise, navigate based on notification type
//     if (notification.type) {
//       onClose(); // Close the notification center
//       switch (notification.type) {
//         case 'payout':
//           console.log('Navigating to all-payouts for payout notification');
//           router.push('/all-payouts' as any);
//           break;
//         case 'transaction':
//           console.log('Navigating to home for transaction notification');
//           router.push('/(tabs)/' as any);
//           break;
//         case 'security':
//           console.log('Navigating to profile for security notification');
//           router.push('/profile' as any);
//           break;
//         default:
//           console.log('No navigation for notification type:', notification.type);
//       }
//     }
//   };
// 
//   const getNotificationIcon = (type: string) => {
//     switch (type) {
//       case 'transaction':
//         return '💰';
//       case 'payout':
//         return '💸';
//       case 'security':
//         return '🔒';
//       case 'marketing':
//         return '📢';
//       case 'system':
//         return 'ℹ️';
//       default:
//         return '📬';
//     }
//   };
// 
//   const getNotificationColor = (type: string) => {
//     switch (type) {
//       case 'transaction':
//         return '#10B981';
//       case 'payout':
//         return '#3B82F6';
//       case 'security':
//         return '#EF4444';
//       case 'marketing':
//         return '#8B5CF6';
//       case 'system':
//         return '#6B7280';
//       default:
//         return colors.text;
//     }
//   };
// 
//   const filteredNotifications = notifications.filter(n =>
//     filter === 'all' ? true : !n.is_read
//   );
// 
//   const unreadCount = notifications.filter(n => !n.is_read).length;
// 
//   const renderNotification = ({ item }: { item: InAppNotification }) => (
//     <TouchableOpacity
//       style={[
//         styles.notificationItem,
//         {
//           backgroundColor: item.is_read ? colors.card : colors.background,
//           borderLeftColor: getNotificationColor(item.type),
//         },
//       ]}
//       onPress={() => handleNotificationPress(item)}
//       activeOpacity={0.7}
//     >
//       <View style={styles.notificationContent}>
//         <View style={styles.notificationHeader}>
//           <Text style={styles.notificationIcon}>{getNotificationIcon(item.type)}</Text>
//           <View style={styles.notificationTextContainer}>
//             <Text style={[styles.notificationTitle, { color: colors.text }]}>
//               {item.title}
//             </Text>
//             <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
//               {item.message}
//             </Text>
//             <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
//               {formatDate(item.created_at)}
//             </Text>
//           </View>
//           {!item.is_read && (
//             <View style={[styles.unreadDot, { backgroundColor: getNotificationColor(item.type) }]} />
//           )}
//         </View>
//       </View>
// 
//       <View style={styles.notificationActions}>
//         {!item.is_read && (
//           <TouchableOpacity
//             style={styles.actionButton}
//             onPress={(e) => {
//               e.stopPropagation();
//               handleMarkAsRead(item.id);
//             }}
//           >
//             <Check size={18} color={colors.primary} />
//           </TouchableOpacity>
//         )}
//         <TouchableOpacity
//           style={styles.actionButton}
//           onPress={(e) => {
//             e.stopPropagation();
//             handleDelete(item.id);
//           }}
//         >
//           <Trash2 size={18} color={colors.error || '#EF4444'} />
//         </TouchableOpacity>
//       </View>
//     </TouchableOpacity>
//   );
// 
//   return (
//     <View style={[styles.container, { backgroundColor: colors.background }]}>
//       <View style={[styles.header, { backgroundColor: colors.card }]}>
//         <View style={styles.headerLeft}>
//           <Bell size={24} color={colors.primary} />
//           <Text style={[styles.headerTitle, { color: colors.text }]}>
//             Notifications
//           </Text>
//           {unreadCount > 0 && (
//             <View style={[styles.badge, { backgroundColor: colors.primary }]}>
//               <Text style={styles.badgeText}>{unreadCount}</Text>
//             </View>
//           )}
//         </View>
//         <TouchableOpacity onPress={onClose} style={styles.closeButton}>
//           <X size={24} color={colors.text} />
//         </TouchableOpacity>
//       </View>
// 
//       <View style={styles.filterContainer}>
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'all' && { backgroundColor: colors.primary },
//           ]}
//           onPress={() => setFilter('all')}
//         >
//           <Text
//             style={[
//               styles.filterText,
//               { color: filter === 'all' ? '#FFFFFF' : colors.text },
//             ]}
//           >
//             All ({notifications.length})
//           </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'unread' && { backgroundColor: colors.primary },
//           ]}
//           onPress={() => setFilter('unread')}
//         >
//           <Text
//             style={[
//               styles.filterText,
//               { color: filter === 'unread' ? '#FFFFFF' : colors.text },
//             ]}
//           >
//             Unread ({unreadCount})
//           </Text>
//         </TouchableOpacity>
//         {unreadCount > 0 && (
//           <TouchableOpacity
//             style={styles.markAllButton}
//             onPress={handleMarkAllAsRead}
//           >
//             <CheckCheck size={20} color={colors.primary} />
//           </TouchableOpacity>
//         )}
//       </View>
// 
//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color={colors.primary} />
//         </View>
//       ) : filteredNotifications.length === 0 ? (
//         <View style={styles.emptyContainer}>
//           <Bell size={64} color={colors.textTertiary} />
//           <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
//             {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
//           </Text>
//         </View>
//       ) : (
//         <FlatList
//           data={filteredNotifications}
//           renderItem={renderNotification}
//           keyExtractor={(item) => item.id}
//           refreshControl={
//             <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
//           }
//           contentContainerStyle={styles.listContent}
//         />
//       )}
//     </View>
//   );
// }
// 
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     padding: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: 'rgba(0, 0, 0, 0.1)',
//   },
//   headerLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },
//   headerTitle: {
//     fontSize: 20,
//     fontWeight: '700',
//   },
//   badge: {
//     minWidth: 24,
//     height: 24,
//     borderRadius: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 8,
//   },
//   badgeText: {
//     color: '#FFFFFF',
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   closeButton: {
//     padding: 4,
//   },
//   filterContainer: {
//     flexDirection: 'row',
//     padding: 16,
//     gap: 12,
//   },
//   filterButton: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//     backgroundColor: 'rgba(0, 0, 0, 0.05)',
//   },
//   filterText: {
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   markAllButton: {
//     marginLeft: 'auto',
//     padding: 8,
//   },
//   listContent: {
//     padding: 16,
//     gap: 12,
//   },
//   notificationItem: {
//     borderRadius: 12,
//     padding: 16,
//     borderLeftWidth: 4,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },
//   notificationContent: {
//     flex: 1,
//   },
//   notificationHeader: {
//     flexDirection: 'row',
//     gap: 12,
//   },
//   notificationIcon: {
//     fontSize: 24,
//   },
//   notificationTextContainer: {
//     flex: 1,
//   },
//   notificationTitle: {
//     fontSize: 16,
//     fontWeight: '600',
//     marginBottom: 4,
//   },
//   notificationMessage: {
//     fontSize: 14,
//     marginBottom: 8,
//     lineHeight: 20,
//   },
//   notificationTime: {
//     fontSize: 12,
//   },
//   unreadDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//   },
//   notificationActions: {
//     flexDirection: 'row',
//     gap: 12,
//     marginTop: 12,
//     paddingTop: 12,
//     borderTopWidth: 1,
//     borderTopColor: 'rgba(0, 0, 0, 0.05)',
//   },
//   actionButton: {
//     padding: 8,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 32,
//   },
//   emptyText: {
//     fontSize: 16,
//     marginTop: 16,
//     textAlign: 'center',
//   },
// });
// 
