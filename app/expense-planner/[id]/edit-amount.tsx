import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { calculateRequiredContribution, PayoutSchedule } from '@/lib/engines/contributionCalculator';

export default function EditAmountScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { expensePlans, updateExpensePlan, fetchExpensePlans } = useExpensePlans();
  
  const plan = expensePlans.find(p => p.id === planId);
  const [targetAmount, setTargetAmount] = useState(plan?.total_budget?.toString() || '');
  const originalTotalBudget = plan?.total_budget ?? 0;
  const currentBalance = (plan as any)?.current_balance ?? 0;
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (plan?.total_budget) {
      setTargetAmount(plan.total_budget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    }
  }, [plan]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const formatAmount = (value: string) => {
    let cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return cleanValue;
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatAmount(value);
    setTargetAmount(formatted);
    setError(null);
  };

  const handleDone = async () => {
    if (!targetAmount) {
      setError('Please enter a target amount');
      haptics.notification();
      return;
    }

    const numericAmount = parseFloat(targetAmount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      haptics.notification();
      return;
    }

    if (numericAmount < 1000) {
      setError('Minimum target is ₦1,000');
      haptics.notification();
      return;
    }

    // Once funding has started, users should only be able to increase the vault amount.
    // This prevents reducing `total_budget` below the initially set value.
    if (currentBalance > 0 && originalTotalBudget > 0 && numericAmount < originalTotalBudget) {
      setError(
        `You can only increase the vault amount after funding starts. Minimum is ₦${originalTotalBudget.toLocaleString('en-US')}.`,
      );
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Recalculate required_per_cycle and required_per_day if dates exist
      let updates: any = {
        total_budget: numericAmount,
      };

      if (plan?.start_date && plan?.end_date) {
        const startDate = new Date(plan.start_date);
        const endDate = new Date(plan.end_date);
        const payoutSchedule = ((plan as any)?.payout_schedule || 'weekly') as PayoutSchedule;
        const currentBalance = (plan as any)?.current_balance || 0;

        const calculation = calculateRequiredContribution(
          numericAmount,
          startDate,
          endDate,
          payoutSchedule,
          currentBalance
        );

        updates.required_per_cycle = calculation.requiredPerCycle;
        updates.required_per_day = calculation.requiredPerDay;
      }

      await updateExpensePlan(planId, updates);
      await fetchExpensePlans();
      haptics.notification();
      router.back();
    } catch (error: any) {
      console.error('Error updating amount:', error);
      setError(error.message || 'Failed to update amount');
      haptics.notification();
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Vault Amount</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Vault Amount</Text>
          <Text style={styles.description}>
            Enter the total amount you want to save for this vault
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={[
            styles.amountContainer,
            targetAmount.trim() !== '' && styles.amountContainerFilled,
            error && styles.amountContainerError,
          ]}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={targetAmount}
              onChangeText={handleAmountChange}
            />
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Done"
        onPress={handleDone}
        disabled={isSaving}
        hapticType="medium"
      />
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
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: 100,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    errorContainer: {
      backgroundColor: colors.errorLight || '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error || '#DC2626',
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      borderWidth: 2,
      borderColor: colors.border,
      minHeight: 64,
    },
    amountContainerFilled: {
      borderColor: colors.accent || colors.primary,
      backgroundColor: colors.accentBackground || colors.background,
    },
    amountContainerError: {
      borderColor: colors.error || '#DC2626',
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
  });

