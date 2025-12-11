import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { Target, TrendingUp, Calendar } from 'lucide-react-native';
import { ExpensePlan } from '@/types/expense-planner';

interface PlanProgressProps {
  plan: ExpensePlan;
}

export default function PlanProgress({ plan }: PlanProgressProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const currentBalance = (plan as any).current_balance || 0;
  const requiredPerCycle = (plan as any).required_per_cycle || 0;
  const payoutSchedule = (plan as any).payout_schedule || 'weekly';
  
  const percentageFunded = plan.total_budget > 0 ? (currentBalance / plan.total_budget) * 100 : 0;
  
  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!plan.end_date) return 'Ongoing';
    const endDate = new Date(plan.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    return `${Math.floor(diffDays / 30)} months`;
  };

  const scheduleLabel = payoutSchedule === 'daily' ? 'day' :
                       payoutSchedule === 'weekly' ? 'week' :
                       payoutSchedule === 'biweekly' ? '2 weeks' :
                       'month';

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Spending pace</Text>
      
      <View style={styles.progressCard}>
        <View style={styles.targetRow}>
          <Target size={20} color={colors.primary} />
          <View style={styles.targetInfo}>
            <Text style={styles.targetLabel}>Budget cap</Text>
            <Text style={styles.targetAmount}>₦{plan.total_budget.toLocaleString('en-US')}</Text>
          </View>
        </View>

        <View style={styles.balanceRow}>
          <TrendingUp size={20} color={colors.primary} />
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Available now</Text>
            <Text style={styles.balanceAmount}>₦{currentBalance.toLocaleString('en-US')}</Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <Text style={styles.progressLabel}>Budget used</Text>
          <Text style={styles.progressPercentage}>{Math.round(percentageFunded)}% of budget cap</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Time Left</Text>
            <Text style={styles.infoValue}>{getTimeRemaining()}</Text>
          </View>
          {requiredPerCycle > 0 && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Required per {scheduleLabel}</Text>
              <Text style={styles.infoValue}>₦{requiredPerCycle.toLocaleString('en-US')}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    progressCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    targetInfo: {
      flex: 1,
    },
    targetLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    targetAmount: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    balanceInfo: {
      flex: 1,
    },
    balanceLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    progressBarContainer: {
      marginBottom: 20,
    },
    progressBar: {
      height: 12,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 6,
    },
    progressPercentage: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    infoGrid: {
      flexDirection: 'row',
      gap: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    infoItem: {
      flex: 1,
    },
    infoLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    infoValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
  });
