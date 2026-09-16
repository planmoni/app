// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React, { useState } from 'react';
// import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { useTextSize } from '@/contexts/TextSizeContext';
// import { getScaledFontSize } from '@/lib/textSize';
// import { Edit, Pause, Play, Trash2, Lock, Unlock, ArrowDownUp } from 'lucide-react-native';
// import { router } from 'expo-router';
// import { useHaptics } from '@/hooks/useHaptics';
// import { useExpensePlans } from '@/hooks/useExpensePlans';
// 
// interface PlanControlsProps {
//   planId: string;
//   isPaused?: boolean;
//   isLocked?: boolean;
//   onEdit?: () => void;
//   onPause?: () => void;
//   onDelete?: () => void;
//   onLockToggle?: () => void;
//   onMoveMoney?: () => void;
// }
// 
// export default function PlanControls({
//   planId,
//   isPaused = false,
//   isLocked = false,
//   onEdit,
//   onPause,
//   onDelete,
//   onLockToggle,
//   onMoveMoney,
// }: PlanControlsProps) {
//   const { colors, isDark } = useTheme();
//   const { textSizeMultiplier } = useTextSize();
//   const haptics = useHaptics();
//   const { deleteExpensePlan, fetchExpensePlans } = useExpensePlans();
// 
//   const handleEdit = () => {
//     haptics.mediumImpact();
//     if (onEdit) {
//       onEdit();
//     } else {
//       router.push({
//         pathname: '/expense-planner/[id]/edit',
//         params: { id: planId },
//       });
//     }
//   };
// 
//   const handlePause = () => {
//     haptics.mediumImpact();
//     if (onPause) {
//       onPause();
//     } else {
//       // TODO: Implement pause functionality
//       Alert.alert('Pause Plan', 'Pause functionality coming soon');
//     }
//   };
// 
//   const handleDelete = () => {
//     haptics.mediumImpact();
//     Alert.alert(
//       'Delete Plan',
//       'Are you sure you want to delete this plan? This action cannot be undone.',
//       [
//         {
//           text: 'Cancel',
//           style: 'cancel',
//         },
//         {
//           text: 'Delete',
//           style: 'destructive',
//           onPress: async () => {
//             try {
//               if (onDelete) {
//                 onDelete();
//               } else {
//                 await deleteExpensePlan(planId);
//                 await fetchExpensePlans();
//                 router.back();
//               }
//               haptics.notification();
//             } catch (error: any) {
//               console.error('Error deleting plan:', error);
//               Alert.alert('Error', error.message || 'Failed to delete plan');
//             }
//           },
//         },
//       ]
//     );
//   };
// 
//   const handleLockToggle = () => {
//     haptics.mediumImpact();
//     if (onLockToggle) {
//       onLockToggle();
//     } else {
//       // TODO: Implement lock toggle
//       Alert.alert('Lock Wallet', 'Lock toggle functionality coming soon');
//     }
//   };
// 
//   const handleMoveMoney = () => {
//     haptics.mediumImpact();
//     if (onMoveMoney) {
//       onMoveMoney();
//     } else {
//       // TODO: Navigate to move money screen
//       Alert.alert('Move Money', 'Move money functionality coming soon');
//     }
//   };
// 
//   const styles = createStyles(colors, isDark, textSizeMultiplier);
// 
//   return (
//     <View style={styles.container}>
//       <Text style={styles.sectionTitle}>Controls</Text>
//       <View style={styles.controlsGrid}>
//         <Pressable
//           style={styles.controlButton}
//           onPress={handleEdit}
//         >
//           <View style={[styles.controlIconContainer, { backgroundColor: colors.primary + '20' }]}>
//             <Edit size={20} color={colors.primary} />
//           </View>
//           <Text style={styles.controlLabel}>Edit</Text>
//         </Pressable>
// 
//         <Pressable
//           style={styles.controlButton}
//           onPress={handlePause}
//         >
//           <View style={[styles.controlIconContainer, { backgroundColor: '#F59E0B' + '20' }]}>
//             {isPaused ? (
//               <Play size={20} color="#F59E0B" />
//             ) : (
//               <Pause size={20} color="#F59E0B" />
//             )}
//           </View>
//           <Text style={styles.controlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
//         </Pressable>
// 
//         <Pressable
//           style={styles.controlButton}
//           onPress={handleLockToggle}
//         >
//           <View style={[styles.controlIconContainer, { backgroundColor: '#6366F1' + '20' }]}>
//             {isLocked ? (
//               <Lock size={20} color="#6366F1" />
//             ) : (
//               <Unlock size={20} color="#6366F1" />
//             )}
//           </View>
//           <Text style={styles.controlLabel}>{isLocked ? 'Unlock' : 'Lock'}</Text>
//         </Pressable>
// 
//         <Pressable
//           style={styles.controlButton}
//           onPress={handleMoveMoney}
//         >
//           <View style={[styles.controlIconContainer, { backgroundColor: colors.primary + '20' }]}>
//             <ArrowDownUp size={20} color={colors.primary} />
//           </View>
//           <Text style={styles.controlLabel}>Move Money</Text>
//         </Pressable>
// 
//         <Pressable
//           style={styles.controlButton}
//           onPress={handleDelete}
//         >
//           <View style={[styles.controlIconContainer, { backgroundColor: '#EF4444' + '20' }]}>
//             <Trash2 size={20} color="#EF4444" />
//           </View>
//           <Text style={[styles.controlLabel, { color: '#EF4444' }]}>Delete</Text>
//         </Pressable>
//       </View>
//     </View>
//   );
// }
// 
// const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
//   StyleSheet.create({
//     container: {
//       marginBottom: 24,
//     },
//     sectionTitle: {
//       fontSize: getScaledFontSize(20, textSizeMultiplier),
//       fontWeight: '700',
//       color: colors.text,
//       marginBottom: 16,
//     },
//     controlsGrid: {
//       flexDirection: 'row',
//       flexWrap: 'wrap',
//       gap: 12,
//     },
//     controlButton: {
//       width: '30%',
//       alignItems: 'center',
//       padding: 16,
//       backgroundColor: colors.card,
//       borderRadius: 12,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     controlIconContainer: {
//       width: 48,
//       height: 48,
//       borderRadius: 24,
//       justifyContent: 'center',
//       alignItems: 'center',
//       marginBottom: 8,
//     },
//     controlLabel: {
//       fontSize: getScaledFontSize(13, textSizeMultiplier),
//       fontWeight: '500',
//       color: colors.text,
//       textAlign: 'center',
//     },
//   });
// 
