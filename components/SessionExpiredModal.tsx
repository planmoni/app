// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { Modal, View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
// import { Clock, LogIn } from 'lucide-react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { router } from 'expo-router';
// import { useAuth } from '@/contexts/AuthContext';
// 
// interface SessionExpiredModalProps {
//   isVisible: boolean;
//   onClose?: () => void;
// }
// 
// export default function SessionExpiredModal({ isVisible, onClose }: SessionExpiredModalProps) {
//   const { colors, isDark } = useTheme();
//   const { width, height } = useWindowDimensions();
//   const { signOut } = useAuth();
//   
//   // Determine if we're on a small screen
//   const isSmallScreen = width < 380 || height < 700;
//   
//   const styles = createStyles(colors, isDark, isSmallScreen);
// 
//   const handleSignInAgain = async () => {
//     try {
//       console.log('🚪 Session expired - forcing complete sign out');
//       // Force complete sign out to clear all session data
//       await signOut();
// 
//       // Also clear any stored session data from secure storage
//       const { clearSession } = await import('@/lib/session-persistence');
//       await clearSession();
// 
//       console.log('✅ Session cleared, redirecting to login');
//     } catch (error) {
//       console.error('❌ Error during forced sign out:', error);
//       // Even if sign out fails, clear session and redirect
//       try {
//         const { clearSession } = await import('@/lib/session-persistence');
//         await clearSession();
//       } catch (clearError) {
//         console.error('❌ Error clearing session:', clearError);
//       }
//     } finally {
//       // Always navigate to login, regardless of errors
//       router.replace('/(auth)/login');
//       onClose?.();
//     }
//   };
// 
//   return (
//     <Modal
//       visible={isVisible}
//       animationType="fade"
//       transparent
//       onRequestClose={() => {}} // Prevent dismissing by back button
//       statusBarTranslucent
//     >
//       <View style={styles.centeredView}>
//         <View style={styles.backdrop} />
//         <View style={styles.modalView}>
//           <View style={styles.iconContainer}>
//             <Clock size={isSmallScreen ? 48 : 56} color={colors.warning || '#F59E0B'} />
//           </View>
//           
//           <Text style={styles.title}>Your session has expired</Text>
//           
//           <Text style={styles.description}>
//             For your security, you've been signed out due to inactivity. Please sign in again to continue using the app.
//           </Text>
//           
//           <Pressable style={styles.signInButton} onPress={handleSignInAgain}>
//             <Text style={styles.signInButtonText}>Sign in again</Text>
//           </Pressable>
//         </View>
//       </View>
//     </Modal>
//   );
// }
// 
// const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
//   centeredView: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//   },
//   backdrop: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//   },
//   modalView: {
//     width: '90%',
//     maxWidth: 400,
//     backgroundColor: colors.surface || colors.background,
//     borderRadius: 16,
//     padding: isSmallScreen ? 24 : 32,
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 4,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 8,
//   },
//   iconContainer: {
//     width: isSmallScreen ? 80 : 96,
//     height: isSmallScreen ? 80 : 96,
//     borderRadius: isSmallScreen ? 40 : 48,
//     backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: isSmallScreen ? 20 : 24,
//   },
//   title: {
//     fontSize: isSmallScreen ? 20 : 24,
//     fontWeight: '700',
//     color: colors.text,
//     textAlign: 'center',
//     marginBottom: isSmallScreen ? 12 : 16,
//   },
//   description: {
//     fontSize: isSmallScreen ? 14 : 16,
//     color: colors.textSecondary,
//     textAlign: 'center',
//     lineHeight: isSmallScreen ? 20 : 24,
//     marginBottom: isSmallScreen ? 24 : 32,
//   },
//   signInButton: {
//     backgroundColor: colors.primary || '#1E3A8A',
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: isSmallScreen ? 12 : 16,
//     paddingHorizontal: isSmallScreen ? 20 : 24,
//     borderRadius: 20,
//     minWidth: '100%',
//     shadowColor: colors.primary || '#1E3A8A',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//   },
//   buttonIcon: {
//     marginRight: 8,
//   },
//   signInButtonText: {
//     color: '#FFFFFF',
//     fontSize: isSmallScreen ? 14 : 16,
//     fontWeight: '600',
//   },
// });
// 
