import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { AlertTriangle } from 'lucide-react-native';

interface BucketAllocationSummaryProps {
  totalAllocated: number;
  totalBudget: number;
}

export default function BucketAllocationSummary({
  totalAllocated,
  totalBudget,
}: BucketAllocationSummaryProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const remaining = totalBudget - totalAllocated;
  const percentage = totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0;
  const isOverBudget = totalAllocated > totalBudget;
  const isNearBudget = percentage >= 90 && !isOverBudget;

  const styles = createStyles(colors, isDark, textSizeMultiplier, isOverBudget, isNearBudget);

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
      {(isOverBudget || isNearBudget) && (
        <View style={styles.warningContainer}>
          <AlertTriangle size={16} color={isOverBudget ? '#EF4444' : '#F97316'} />
          <Text style={[styles.warningText, isOverBudget && styles.overBudgetText]}>
            {isOverBudget
              ? `You've exceeded your budget by ₦${Math.abs(remaining).toLocaleString()}`
              : 'You\'re approaching your budget limit'}
          </Text>
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
  isNearBudget: boolean
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isOverBudget ? '#EF4444' : isNearBudget ? '#F97316' : colors.border,
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
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      padding: 12,
      backgroundColor: isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
      borderRadius: 8,
    },
    warningText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '500',
      color: isOverBudget ? '#EF4444' : '#F97316',
      flex: 1,
    },
    overBudgetText: {
      color: '#EF4444',
    },
  });

