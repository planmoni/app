import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { AlertTriangle } from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';

interface BucketAllocationSummaryProps {
  totalAllocated: number;
  totalBudget: number;
  budgetStructure?: 'fixed' | 'estimated';
  onSwitchToEstimated?: () => void;
}

export default function BucketAllocationSummary({
  totalAllocated,
  totalBudget,
  budgetStructure = 'fixed',
  onSwitchToEstimated,
}: BucketAllocationSummaryProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();

  const remaining = totalBudget - totalAllocated;
  const percentage = totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0;
  // Only show over-budget warnings for fixed budgets
  const isOverBudget = budgetStructure === 'fixed' && totalAllocated > totalBudget;
  // Show "hit the limit" message only when remaining is exactly ₦0
  const isAtBudgetLimit = budgetStructure === 'fixed' && remaining === 0 && !isOverBudget;

  const handleSwitchToEstimated = () => {
    haptics.selection();
    onSwitchToEstimated?.();
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier, isOverBudget, isAtBudgetLimit);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Total Allocated</Text>
        <Text style={[styles.amount, isOverBudget && styles.overBudgetAmount]}>
          ₦{totalAllocated.toLocaleString()}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Remaining to Allocate</Text>
        <Text style={[styles.amount, isOverBudget && styles.overBudgetAmount]}>
          {remaining >= 0 ? '₦' : '-₦'}{Math.abs(remaining).toLocaleString()}
        </Text>
      </View>
      {(isOverBudget || isAtBudgetLimit) && (
        <View style={styles.warningContainer}>
          <AlertTriangle size={16} color={isOverBudget ? '#EF4444' : '#F97316'} />
          <View style={styles.warningContent}>
            <Text style={[styles.warningText, isOverBudget && styles.overBudgetText]}>
              {isOverBudget
                ? `You've exceeded your budget by ₦${Math.abs(remaining).toLocaleString()}`
                : 'You\'ve hit the budget limit for this fixed budget'}
            </Text>
            {isAtBudgetLimit && (
              <Pressable onPress={handleSwitchToEstimated}>
                <Text style={styles.switchLink}>Switch to estimated budget</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (
  colors: any,
  isDark: boolean,
  textSizeMultiplier: number,
  isOverBudget: boolean,
  isAtBudgetLimit: boolean
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isOverBudget ? '#EF4444' : isAtBudgetLimit ? '#F97316' : colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
    },
    amount: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 4,
      padding: 12,
      backgroundColor: isOverBudget ? 'rgba(239, 68, 68, 0.1)' : isAtBudgetLimit ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.1)',
      borderRadius: 8,
    },
    warningContent: {
      flex: 1,
      gap: 8,
    },
    warningText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '500',
      color: isOverBudget ? '#EF4444' : '#F97316',
    },
    overBudgetText: {
      color: '#EF4444',
    },
    switchLink: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });

