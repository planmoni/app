import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { AlertTriangle, CheckCircle, XCircle, TrendingDown } from 'lucide-react-native';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface PlanHealthIndicatorProps {
  planId: string;
  healthStatus: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  percentageBehind?: number;
  recommendedAction?: string;
  requiredAdjustment?: {
    increase_by?: number;
    extend_by_days?: number;
  };
}

export default function PlanHealthIndicator({
  planId,
  healthStatus,
  percentageBehind = 0,
  recommendedAction,
  requiredAdjustment,
}: PlanHealthIndicatorProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();

  const getHealthConfig = () => {
    switch (healthStatus) {
      case 'on_track':
        return {
          icon: CheckCircle,
          color: '#22C55E',
          backgroundColor: '#22C55E' + '20',
          label: 'On Track',
          message: 'Your plan is progressing well. Keep it up!',
        };
      case 'slightly_behind':
        return {
          icon: AlertTriangle,
          color: '#F59E0B',
          backgroundColor: '#F59E0B' + '20',
          label: 'Slightly Behind',
          message: recommendedAction || `You are ${Math.round(percentageBehind)}% behind schedule.`,
        };
      case 'at_risk':
        return {
          icon: TrendingDown,
          color: '#F97316',
          backgroundColor: '#F97316' + '20',
          label: 'At Risk',
          message: recommendedAction || 'Your plan is at risk of not meeting its deadline.',
        };
      case 'unachievable':
        return {
          icon: XCircle,
          color: '#EF4444',
          backgroundColor: '#EF4444' + '20',
          label: 'Unachievable',
          message: recommendedAction || 'This plan cannot be completed with current income structure.',
        };
      default:
        return {
          icon: CheckCircle,
          color: colors.textSecondary,
          backgroundColor: colors.backgroundTertiary,
          label: 'Unknown',
          message: 'Status unknown',
        };
    }
  };

  const config = getHealthConfig();
  const Icon = config.icon;

  const handleEditPlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/edit',
      params: { id: planId },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Health Indicator</Text>
      <View style={[
        styles.healthCard,
        { backgroundColor: config.backgroundColor },
      ]}>
        <View style={styles.healthHeader}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '30' }]}>
            <Icon size={24} color={config.color} />
          </View>
          <View style={styles.healthInfo}>
            <Text style={[styles.healthLabel, { color: config.color }]}>
              {config.label}
            </Text>
            <Text style={styles.healthMessage}>{config.message}</Text>
          </View>
        </View>

        {requiredAdjustment && (requiredAdjustment.increase_by || requiredAdjustment.extend_by_days) && (
          <View style={styles.adjustmentContainer}>
            <Text style={styles.adjustmentTitle}>Recommended Adjustment:</Text>
            {requiredAdjustment.increase_by && (
              <Text style={styles.adjustmentText}>
                Increase weekly allocation by ₦{requiredAdjustment.increase_by.toLocaleString('en-US')}
              </Text>
            )}
            {requiredAdjustment.extend_by_days && (
              <Text style={styles.adjustmentText}>
                Or extend deadline by {requiredAdjustment.extend_by_days} days
              </Text>
            )}
          </View>
        )}

        {(healthStatus !== 'on_track') && (
          <Pressable
            onPress={handleEditPlan}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit Plan</Text>
          </Pressable>
        )}
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
    healthCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    healthHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    healthInfo: {
      flex: 1,
    },
    healthLabel: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      marginBottom: 4,
    },
    healthMessage: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      lineHeight: 20,
    },
    adjustmentContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    adjustmentTitle: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    adjustmentText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    editButton: {
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    editButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
  });
