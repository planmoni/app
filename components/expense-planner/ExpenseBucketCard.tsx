import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpenseBucket } from '@/types/expense-planner';
import BudgetProgressBar from './BudgetProgressBar';

interface ExpenseBucketCardProps {
  bucket: ExpenseBucket;
  onPress?: () => void;
}

export default function ExpenseBucketCard({ bucket, onPress }: ExpenseBucketCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const percentage = bucket.target_amount > 0 ? (bucket.amount_spent / bucket.target_amount) * 100 : 0;

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  const content = (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{bucket.name}</Text>
        <Text style={[styles.remainingAmount, bucket.remaining_amount < 0 && styles.overBudgetAmount]}>
          {bucket.remaining_amount >= 0 ? '₦' : '-₦'}{Math.abs(bucket.remaining_amount).toLocaleString()} left
        </Text>
      </View>
      <BudgetProgressBar
        percentage={percentage}
        amountSpent={bucket.amount_spent}
        targetAmount={bucket.target_amount}
        showLabels={true}
      />
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    remainingAmount: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
  });

