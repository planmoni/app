import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan } from '@/types/expense-planner';

interface ExpensePlanCardProps {
  plan: ExpensePlan;
  onPress: () => void;
}

export default function ExpensePlanCard({ plan, onPress }: ExpensePlanCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const getStatusColor = () => {
    switch (plan.status) {
      case 'active':
        return '#22C55E';
      case 'completed':
        return colors.textSecondary;
      case 'archived':
        return colors.textTertiary;
      default:
        return colors.primary;
    }
  };

  const getStatusLabel = () => {
    switch (plan.status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'archived':
        return 'Archived';
      default:
        return plan.status;
    }
  };

  const percentageUsed = plan.total_budget > 0 ? (plan.total_spent / plan.total_budget) * 100 : 0;

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.planHeader}>
        <Text style={styles.planType}>{plan.name}</Text>
        <View style={styles.activeTag}>
          <Text style={[styles.activeTagText, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
        </View>
      </View>
      <Text style={styles.planAmount}>₦{plan.total_budget.toLocaleString()}</Text>
      <View style={styles.planDetails}>
        <Text style={styles.planFrequency}>Remaining</Text>
        <Text style={styles.planDot}>•</Text>
        <Text style={[
          styles.planValue,
          plan.remaining_budget < 0 && styles.overBudgetAmount,
        ]}>
          ₦{Math.abs(plan.remaining_budget).toLocaleString()}
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(Math.max(percentageUsed, 0), 100)}%`,
              backgroundColor:
                percentageUsed > 100
                  ? '#EF4444'
                  : percentageUsed > 75
                  ? '#F97316'
                  : colors.primary,
            },
          ]}
        />
      </View>
      <View style={styles.planProgress}>
        <Text style={styles.progressText}>
          ₦{plan.total_spent.toLocaleString()}/₦{plan.total_budget.toLocaleString()}
        </Text>
        <Text style={styles.progressCount}>
          {Math.round(percentageUsed)}%
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: Platform.OS === 'ios' ? 15 : 10,
      marginBottom: Platform.OS === 'ios' ? 10 : 5,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Platform.OS === 'ios' ? 10 : 5,
    },
    planType: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.textSecondary,
      maxWidth: '75%',
    },
    activeTag: {
      backgroundColor: isDark ? colors.accent : colors.accent,
      paddingHorizontal: Platform.OS === 'ios' ? 10 : 8,
      paddingVertical: Platform.OS === 'ios' ? 6 : 4,
      borderRadius: Platform.OS === 'ios' ? 20 : 16,
    },
    activeTagText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
      fontWeight: '600',
    },
    planAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 22 : 20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: Platform.OS === 'ios' ? 10 : 5,
    },
    planDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: Platform.OS === 'ios' ? 10 : 5,
    },
    planFrequency: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    planDot: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    planValue: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
    progressBar: {
      height: Platform.OS === 'ios' ? 6 : 4,
      backgroundColor: colors.border,
      borderRadius: 3,
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    planProgress: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    progressText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    progressCount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });

