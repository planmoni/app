import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan } from '@/types/expense-planner';
import { ChevronRight } from 'lucide-react-native';

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
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{plan.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusLabel()}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.budgetContainer}>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Total Budget</Text>
          <Text style={styles.budgetAmount}>₦{plan.total_budget.toLocaleString()}</Text>
        </View>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Remaining</Text>
          <Text
            style={[
              styles.budgetAmount,
              plan.remaining_budget < 0 && styles.overBudgetAmount,
            ]}
          >
            ₦{Math.abs(plan.remaining_budget).toLocaleString()}
          </Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
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
                    : '#22C55E',
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(percentageUsed)}% used</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
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
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    title: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: getScaledFontSize(11, textSizeMultiplier),
      fontWeight: '600',
    },
    budgetContainer: {
      marginBottom: 12,
    },
    budgetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    budgetLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    budgetAmount: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'right',
    },
  });

