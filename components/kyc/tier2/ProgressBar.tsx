import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

interface ProgressBarProps {
  percentage: number;
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ percentage, currentStep, totalSteps }: ProgressBarProps) {
  const { colors, isDark } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${percentage}%`, {
        duration: 500,
        easing: Easing.out(Easing.quad), // ease-out
      }),
    };
  });

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepText}>Step {currentStep} of {totalSteps}</Text>
        <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, animatedStyle]} />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    stepText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    percentageText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    progressBarContainer: {
      width: '100%',
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
  });
}


