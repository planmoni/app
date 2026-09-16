// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React, { useState, useEffect } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
// import { Bell } from 'lucide-react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { useAuth } from '@/contexts/AuthContext';
// import { inAppNotificationService } from '@/lib/in-app-notifications';
// import { NotificationCenter } from './NotificationCenter';
// import { useRouter } from 'expo-router';
// 
// export function NotificationBell() {
//   const { theme } = useTheme();
//   const { user } = useAuth();
//   const router = useRouter();
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [showCenter, setShowCenter] = useState(false);
// 
//   useEffect(() => {
//     loadUnreadCount();
// 
//     // Poll for updates every 30 seconds instead of real-time subscription
//     // Server-side push notifications handle delivery when app is closed
//     if (user?.id) {
//       const pollInterval = setInterval(() => {
//         loadUnreadCount();
//       }, 30000); // Poll every 30 seconds
// 
//       return () => {
//         clearInterval(pollInterval);
//       };
//     }
//   }, [user?.id]);
// 
//   const loadUnreadCount = async () => {
//     if (!user?.id) return;
//     const count = await inAppNotificationService.getUnreadCount(user.id);
//     setUnreadCount(count);
//     await inAppNotificationService.setBadgeCount(count);
//   };
// 
//   const handlePress = () => {
//     setShowCenter(true);
//   };
// 
//   const handleNotificationPress = (notification: any) => {
//     setShowCenter(false);
// 
//     if (notification.data?.route) {
//       router.push(notification.data.route);
//     } else {
//       switch (notification.type) {
//         case 'transaction':
//           router.push('/(tabs)/');
//           break;
//         case 'payout':
//           router.push('/all-payouts');
//           break;
//         case 'security':
//           router.push('/profile');
//           break;
//         default:
//           break;
//       }
//     }
//   };
// 
//   return (
//     <>
//       <TouchableOpacity onPress={handlePress} style={styles.container}>
//         <Bell size={24} color={theme.colors.text} />
//         {unreadCount > 0 && (
//           <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
//             <Text style={styles.badgeText}>
//               {unreadCount > 99 ? '99+' : unreadCount}
//             </Text>
//           </View>
//         )}
//       </TouchableOpacity>
// 
//       <Modal
//         visible={showCenter}
//         animationType="slide"
//         presentationStyle="pageSheet"
//         onRequestClose={() => setShowCenter(false)}
//       >
//         <NotificationCenter
//           onClose={() => setShowCenter(false)}
//           onNotificationPress={handleNotificationPress}
//         />
//       </Modal>
//     </>
//   );
// }
// 
// const styles = StyleSheet.create({
//   container: {
//     position: 'relative',
//     padding: 8,
//   },
//   badge: {
//     position: 'absolute',
//     top: 4,
//     right: 4,
//     minWidth: 18,
//     height: 18,
//     borderRadius: 9,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 4,
//   },
//   badgeText: {
//     color: '#FFFFFF',
//     fontSize: 10,
//     fontWeight: '700',
//   },
// });
// 
