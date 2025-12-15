import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Zap, Hand, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { PayoutSchedule } from '@/lib/engines/contributionCalculator';

type FundingMethod = 'auto' | 'manual';

export default function FundingSourceScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const dateType = params.dateType as 'range' | 'one_time' | 'ongoing';
  const payoutSchedule = (params.payoutSchedule as PayoutSchedule) || 'weekly';
  const requiredPerCycle = parseFloat((params.requiredPerCycle as string) || '0');
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = (params.planTypesParam || params.planTypes) as string | undefined;

  // Default to manual since budgets are considered funded upfront
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>('manual');
  const [isSaving, setIsSaving] = useState(false);
  // Hybrid option removed; budgets are either auto or manual

  // Allocation preview derived from budget window
  const allocationPreview = useMemo(() => {
    if (fundingMethod !== 'auto') return null;

    const start = startDateStr ? new Date(startDateStr) : new Date();
    const end = endDateStr ? new Date(endDateStr) : start;
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    const oneDay = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / oneDay) + 1);
    const weeks = Math.max(1, Math.ceil(days / 7));
    const months = Math.max(1, Math.ceil(days / 30));

    const totalAllocation = targetAmount;
    const perDay = totalAllocation / days;
    const perWeek = totalAllocation / weeks;
    const perMonth = totalAllocation / months;

    return {
      days,
      weeks,
      months,
      totalAllocation,
      perDay,
      perWeek,
      perMonth,
    };
  }, [fundingMethod, startDateStr, endDateStr, targetAmount]);

  const handleContinue = async () => {
    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Update draft plan with funding method
      if (planId) {
        await saveDraftExpensePlan({
          planId,
          // Store funding method in metadata for now
          // Will be moved to proper fields after database migration
        });
      }

      // Navigate based on funding method
      if (fundingMethod === 'auto') {
        // Navigate to auto top-up configuration
        router.push({
          pathname: '/expense-planner/create/auto-topup-config',
          params: {
            planName,
            targetAmount: targetAmount.toString(),
            startDate: startDateStr,
            endDate: endDateStr || '',
            planId: planId || '',
            ...(subCategories && { subCategories }),
            ...(planTypesParam && { planTypes: planTypesParam }),
          },
        });
      } else {
        // Navigate directly to start action for manual funding
        router.push({
          pathname: '/expense-planner/create/start-action',
          params: {
            planName,
            targetAmount: targetAmount.toString(),
            startDate: startDateStr,
            endDate: endDateStr || '',
            dateType,
            payoutSchedule,
            requiredPerCycle: requiredPerCycle.toString(),
            fundingMethod,
            planId: planId || '',
            ...(subCategories && { subCategories }),
            ...(planTypesParam && { planTypes: planTypesParam }),
          },
        });
      }
    } catch (error) {
      console.error('Error saving funding source:', error);
      Alert.alert('Error', 'Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, textSizeMultiplier);

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
        <Text style={styles.headerTitle}>Budget refresh</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/funding-source');
            }
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>How should this plan be funded?</Text>
          <Text style={styles.subtitle}>
            Budget is funded upfront. Choose how you want to add funds to your plan. Extra top-ups become extra to spend without changing the budget.
          </Text>

          {/* Auto Fund */}
          <Pressable
            style={[
              styles.optionCard,
              fundingMethod === 'auto' && styles.optionCardSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setFundingMethod('auto');
            }}
          >
            <View style={styles.optionHeader}>
              <View style={[
                styles.optionIconContainer,
                fundingMethod === 'auto' && styles.optionIconContainerSelected,
              ]}>
                <Zap size={24} color={fundingMethod === 'auto' ? colors.primary : colors.text} />
              </View>
              <View style={styles.optionHeaderText}>
                <Text style={styles.optionTitle}>Auto top-up</Text>
                <Text style={styles.optionSubtitle}>Automatically top-up your budget plan from your available balance little by little.</Text>
              </View>
              <View style={[
                styles.radio,
                fundingMethod === 'auto' && styles.radioSelected,
              ]}>
                {fundingMethod === 'auto' && <View style={styles.radioInner} />}
              </View>
            </View>
            
          </Pressable>

          {/* Manual Fund */}
          <Pressable
            style={[
              styles.optionCard,
              fundingMethod === 'manual' && styles.optionCardSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setFundingMethod('manual');
            }}
          >
            <View style={styles.optionHeader}>
              <View style={[
                styles.optionIconContainer,
                fundingMethod === 'manual' && styles.optionIconContainerSelected,
              ]}>
                <Hand size={24} color={fundingMethod === 'manual' ? colors.primary : colors.text} />
              </View>
              <View style={styles.optionHeaderText}>
                <Text style={styles.optionTitle}>Manual top-up</Text>
                <Text style={styles.optionSubtitle}>Top up manually anytime. Extra is just extra to spend.</Text>
              </View>
              <View style={[
                styles.radio,
                fundingMethod === 'manual' && styles.radioSelected,
              ]}>
                {fundingMethod === 'manual' && <View style={styles.radioInner} />}
              </View>
            </View>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={isSaving}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
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
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      marginBottom: 16,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    optionIconContainerSelected: {
      backgroundColor: colors.primary + '20',
    },
    optionHeaderText: {
      flex: 1,
    },
    optionTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    optionSubtitle: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    previewContainer: {
      marginTop: 12,
      padding: 16,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    previewTitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    previewLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    previewValue: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    previewNote: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      borderWidth: 2,
      borderColor: colors.primary,
      minHeight: 56,
      marginTop: 8,
      marginBottom: 8,
    },
    currencySymbol: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
  });
