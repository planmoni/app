// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React, { useMemo } from 'react';
// import { View, Text, StyleSheet, Pressable } from 'react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { useTextSize } from '@/contexts/TextSizeContext';
// import { getScaledFontSize } from '@/lib/textSize';
// import { TrendingUp, AlertTriangle } from 'lucide-react-native';
// import { useExpensePlans } from '@/hooks/useExpensePlans';
// import { useBalance } from '@/contexts/BalanceContext';
// import { calculateDailyAllowance, recalculateConsequences } from '@/lib/pacing/calculateDailyAllowance';
// import { ExpensePlan } from '@/types/expense-planner';
// 
// interface DailySpendGuidanceProps {
//   currentSpending?: number;
// }
// 
// export default function DailySpendGuidance({ currentSpending = 0 }: DailySpendGuidanceProps) {
//   const { colors, isDark } = useTheme();
//   const { textSizeMultiplier } = useTextSize();
//   const { expensePlans } = useExpensePlans();
//   const { availableBalance } = useBalance();
// 
//   const guidance = useMemo(() => {
//     // Calculate remaining days in current month (or use a default period)
//     const today = new Date();
//     const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
//     const remainingDays = Math.max(1, Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
// 
//     // Use available balance as free to spend pool
//     const freeToSpendPool = availableBalance;
// 
//     // Get active plans
//     const activePlans = expensePlans.filter(plan => 
//       plan.status === 'active' &&
//       !(plan as any).is_paused
//     ) as ExpensePlan[];
// 
//     return calculateDailyAllowance(
//       freeToSpendPool,
//       remainingDays,
//       activePlans,
//       currentSpending
//     );
//   }, [expensePlans, availableBalance, currentSpending]);
// 
//   const styles = createStyles(colors, isDark, textSizeMultiplier);
// 
//   if (guidance.dailyAllowance <= 0 && !guidance.consequences) {
//     return null; // Don't show if no guidance needed
//   }
// 
//   return (
//     <View style={styles.container}>
//       <View style={styles.card}>
//         <View style={styles.header}>
//           {guidance.consequences?.overspent ? (
//             <AlertTriangle size={20} color="#EF4444" />
//           ) : (
//             <TrendingUp size={20} color={colors.primary} />
//           )}
//           <Text style={styles.title}>Daily Spend Guidance</Text>
//         </View>
//         
//         <Text style={styles.message}>{guidance.message}</Text>
// 
//         {guidance.consequences && guidance.consequences.overspent && (
//           <View style={styles.consequencesContainer}>
//             <Text style={styles.consequencesTitle}>Consequences:</Text>
//             {guidance.consequences.affectedPlans.map(plan => (
//               <Text key={plan.planId} style={styles.consequencesText}>
//                 {plan.planName} deadline will shift by {plan.deadlineShiftDays} day{plan.deadlineShiftDays !== 1 ? 's' : ''} unless you adjust.
//               </Text>
//             ))}
//           </View>
//         )}
// 
//         {guidance.dailyAllowance > 0 && (
//           <View style={styles.breakdown}>
//             <View style={styles.breakdownRow}>
//               <Text style={styles.breakdownLabel}>Free to spend pool</Text>
//               <Text style={styles.breakdownValue}>
//                 ₦{guidance.freeToSpendPool.toLocaleString('en-US')}
//               </Text>
//             </View>
//             {guidance.requiredFutureAllocations > 0 && (
//               <View style={styles.breakdownRow}>
//                 <Text style={styles.breakdownLabel}>Required future allocations</Text>
//                 <Text style={[styles.breakdownValue, styles.breakdownValueNegative]}>
//                   -₦{Math.ceil(guidance.requiredFutureAllocations).toLocaleString('en-US')}
//                 </Text>
//               </View>
//             )}
//             {guidance.flexiblePlanHeadroom > 0 && (
//               <View style={styles.breakdownRow}>
//                 <Text style={styles.breakdownLabel}>Flexible plan headroom</Text>
//                 <Text style={[styles.breakdownValue, styles.breakdownValuePositive]}>
//                   +₦{Math.ceil(guidance.flexiblePlanHeadroom).toLocaleString('en-US')}
//                 </Text>
//               </View>
//             )}
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }
// 
// const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
//   StyleSheet.create({
//     container: {
//       marginBottom: 16,
//     },
//     card: {
//       backgroundColor: colors.card,
//       borderRadius: 16,
//       padding: 20,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     header: {
//       flexDirection: 'row',
//       alignItems: 'center',
//       gap: 8,
//       marginBottom: 12,
//     },
//     title: {
//       fontSize: getScaledFontSize(18, textSizeMultiplier),
//       fontWeight: '600',
//       color: colors.text,
//     },
//     message: {
//       fontSize: getScaledFontSize(15, textSizeMultiplier),
//       color: colors.text,
//       lineHeight: 22,
//       marginBottom: 12,
//     },
//     consequencesContainer: {
//       marginTop: 12,
//       padding: 12,
//       backgroundColor: '#FEE2E2',
//       borderRadius: 8,
//       borderWidth: 1,
//       borderColor: '#EF4444',
//     },
//     consequencesTitle: {
//       fontSize: getScaledFontSize(14, textSizeMultiplier),
//       fontWeight: '600',
//       color: '#EF4444',
//       marginBottom: 8,
//     },
//     consequencesText: {
//       fontSize: getScaledFontSize(13, textSizeMultiplier),
//       color: '#991B1B',
//       lineHeight: 20,
//       marginBottom: 4,
//     },
//     breakdown: {
//       marginTop: 12,
//       paddingTop: 12,
//       borderTopWidth: 1,
//       borderTopColor: colors.border,
//     },
//     breakdownRow: {
//       flexDirection: 'row',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//       marginBottom: 8,
//     },
//     breakdownLabel: {
//       fontSize: getScaledFontSize(13, textSizeMultiplier),
//       color: colors.textSecondary,
//     },
//     breakdownValue: {
//       fontSize: getScaledFontSize(14, textSizeMultiplier),
//       fontWeight: '600',
//       color: colors.text,
//     },
//     breakdownValueNegative: {
//       color: '#EF4444',
//     },
//     breakdownValuePositive: {
//       color: '#22C55E',
//     },
//   });
// 
