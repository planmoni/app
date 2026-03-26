import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { Platform } from 'react-native';

export default function SpendBalanceScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  
  const { expensePlans } = useExpensePlans();

  const plan = expensePlans.find(p => p.id === planId);
  const currentBalance = (plan as any)?.current_balance || 0;
  const totalBudget = plan?.total_budget || 0;
  const spendableBalance = currentBalance;

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const handleBack = () => {
    haptics.selection();
    router.back();
  };

  const handleSchedule = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/vault-schedule-payout/amount',
      params: { planId },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Budget Not Found</Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.closeButton}
            hitSlop={8}
          >
            <X size={20} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {plan.name}
        </Text>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.closeButton}
          hitSlop={8}
        >
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Spendable Balance</Text>
          <Text style={styles.balanceAmount}>{formatBalance(spendableBalance)}</Text>
          <Text style={styles.balanceSubtext}>
            From vault of {formatBalance(totalBudget)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={[styles.actionButton, styles.scheduleButton]}
            onPress={handleSchedule}
          >
            <Calendar size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, styles.scheduleButtonText]}>
              Schedule
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    balanceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 40 : 36, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    balanceSubtext: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    actionsContainer: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    scheduleButton: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
    },
    actionButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
    },
    scheduleButtonText: {
      color: colors.text,
    },
  });

