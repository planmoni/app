import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { AlertTriangle } from 'lucide-react-native';

interface BucketAllocationSummaryProps {
  totalAllocated: number;
  totalAmount: number;
}

export default function BucketAllocationSummary({
  totalAllocated,
  totalAmount,
}: BucketAllocationSummaryProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const remaining = totalAmount - totalAllocated;
  const isOverAmount = totalAllocated > totalAmount;
  const isAtAmountLimit = remaining === 0 && !isOverAmount;

  const styles = createStyles(colors, isDark, textSizeMultiplier, isOverAmount, isAtAmountLimit);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Total Allocated</Text>
        <Text style={[styles.amount, isOverAmount && styles.overAmountAmount]}>
          ₦{totalAllocated.toLocaleString()}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.label}>Remaining to Allocate</Text>
        <Text style={[styles.amount, isOverAmount && styles.overAmountAmount]}>
          {remaining >= 0 ? '₦' : '-₦'}{Math.abs(remaining).toLocaleString()}
        </Text>
      </View>
      {(isOverAmount || isAtAmountLimit) && (
        <View style={styles.warningContainer}>
          <AlertTriangle size={16} color={isOverAmount ? '#EF4444' : '#F97316'} />
          <View style={styles.warningContent}>
            <Text style={[styles.warningText, isOverAmount && styles.overAmountText]}>
              {isOverAmount
                ? `You've exceeded your spending plan by ₦${Math.abs(remaining).toLocaleString()}`
                : 'You\'ve hit the spending plan limit for this fixed spending plan'}
            </Text>
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
  isOverAmount: boolean,
  isAtAmountLimit: boolean
) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isOverAmount ? '#EF4444' : isAtAmountLimit ? '#F97316' : colors.border,
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
    overAmountAmount: {
      color: '#EF4444',
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 4,
      padding: 12,
      backgroundColor: isOverAmount ? 'rgba(239, 68, 68, 0.1)' : isAtAmountLimit ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.1)',
      borderRadius: 8,
    },
    warningContent: {
      flex: 1,
      gap: 8,
    },
    warningText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '500',
      color: isOverAmount ? '#EF4444' : '#F97316',
    },
    overAmountText: {
      color: '#EF4444',
    },
  });

