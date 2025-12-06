import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { BucketProgressStatus } from '@/types/expense-planner';

interface BudgetProgressBarProps {
  percentage: number;
  amountSpent: number;
  targetAmount: number;
  showLabels?: boolean;
}

export default function BudgetProgressBar({
  percentage,
  amountSpent,
  targetAmount,
  showLabels = true,
}: BudgetProgressBarProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const getProgressStatus = (): BucketProgressStatus => {
    if (percentage < 75) {
      return { percentage, color: 'green', status: 'under' };
    } else if (percentage <= 100) {
      return { percentage, color: percentage < 90 ? 'yellow' : 'orange', status: 'warning' };
    } else {
      return { percentage, color: 'red', status: 'over' };
    }
  };

  const progressStatus = getProgressStatus();

  const getProgressColor = () => {
    switch (progressStatus.color) {
      case 'green':
        return '#22C55E';
      case 'yellow':
        return '#EAB308';
      case 'orange':
        return '#F97316';
      case 'red':
        return '#EF4444';
      default:
        return colors.primary;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
    return {
      width: withTiming(`${clampedPercentage}%`, {
        duration: 500,
        easing: Easing.out(Easing.quad),
      }),
    };
  });

  const styles = createStyles(colors, isDark, textSizeMultiplier, getProgressColor());

  return (
    <View style={styles.container}>
      {showLabels && (
        <View style={styles.labelsContainer}>
          <Text style={styles.amountLabel}>
            ₦{amountSpent.toLocaleString()} / ₦{targetAmount.toLocaleString()}
          </Text>
          <Text style={[styles.percentageLabel, { color: getProgressColor() }]}>
            {Math.round(percentage)}%
          </Text>
        </View>
      )}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, { backgroundColor: getProgressColor() }, animatedStyle]} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number, progressColor: string) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    labelsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    amountLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
    },
    percentageLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: progressColor,
    },
    progressBarContainer: {
      width: '100%',
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
  });

