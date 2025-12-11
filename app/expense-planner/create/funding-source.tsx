import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Zap, Hand, Settings, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { PayoutSchedule } from '@/lib/engines/contributionCalculator';

type FundingMethod = 'auto' | 'manual' | 'hybrid';

export default function FundingSourceScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const budgetStructure = params.budgetStructure as 'fixed' | 'estimated';
  const priority = params.priority as string;
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const dateType = params.dateType as 'range' | 'one_time' | 'ongoing';
  const payoutSchedule = (params.payoutSchedule as PayoutSchedule) || 'weekly';
  const requiredPerCycle = parseFloat((params.requiredPerCycle as string) || '0');
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypesParam as string | undefined;

  // Default to manual since budgets are considered funded upfront
  const [fundingMethod, setFundingMethod] = useState<FundingMethod>('manual');
  const [autoFundMinimum, setAutoFundMinimum] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleAutoFundMinimumChange = (value: string) => {
    const formatted = formatAmount(value);
    setAutoFundMinimum(formatted);
  };

  // Allocation preview derived from budget window
  const allocationPreview = useMemo(() => {
    if (fundingMethod !== 'auto' && fundingMethod !== 'hybrid') return null;

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
    if (fundingMethod === 'hybrid') {
      const minAmount = parseFloat(autoFundMinimum.replace(/,/g, ''));
      if (isNaN(minAmount) || minAmount < 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid minimum auto-fund amount');
        haptics.notification();
        return;
      }
      if (minAmount > requiredPerCycle) {
        Alert.alert('Invalid Amount', 'Minimum auto-fund cannot exceed required per cycle');
        haptics.notification();
        return;
      }
    }

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

      // Navigate to wallet rules
      router.push({
        pathname: '/expense-planner/create/review',
        params: {
          planName,
          targetAmount: targetAmount.toString(),
          budgetStructure,
          priority,
          startDate: startDateStr,
          endDate: endDateStr || '',
          dateType,
          payoutSchedule,
          requiredPerCycle: requiredPerCycle.toString(),
          fundingMethod,
          autoFundMinimum: fundingMethod === 'hybrid' ? autoFundMinimum : '',
          planId: planId || '',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
        },
      });
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
          <Text style={styles.title}>How should this budget refresh?</Text>
          <Text style={styles.subtitle}>
            Budget is funded upfront. You can still set a light auto refresh or keep it manual. Extra top-ups become extra to spend without changing the budget.
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
                <Text style={styles.optionTitle}>Auto refresh (optional)</Text>
                <Text style={styles.optionSubtitle}>Automatic top-up on your cadence. Extra stays as spendable buffer.</Text>
              </View>
              <View style={[
                styles.radio,
                fundingMethod === 'auto' && styles.radioSelected,
              ]}>
                {fundingMethod === 'auto' && <View style={styles.radioInner} />}
              </View>
            </View>
            {fundingMethod === 'auto' && allocationPreview && (
              <View style={styles.previewContainer}>
                <View style={styles.previewHeader}>
                  <TrendingUp size={16} color={colors.primary} />
                  <Text style={styles.previewTitle}>Allocation Preview</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total allocation</Text>
                  <Text style={styles.previewValue}>
                    ₦{allocationPreview.totalAllocation.toLocaleString('en-US')}
                  </Text>
                </View>
                {allocationPreview.days <= 7 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Per day</Text>
                    <Text style={styles.previewValue}>
                      ₦{Number(allocationPreview.perDay.toFixed(2)).toLocaleString('en-US')}
                    </Text>
                  </View>
                )}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Per week</Text>
                  <Text style={styles.previewValue}>
                    ₦{Number(allocationPreview.perWeek.toFixed(2)).toLocaleString('en-US')}
                  </Text>
                </View>
                {allocationPreview.days > 30 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Per month</Text>
                    <Text style={styles.previewValue}>
                      ₦{Number(allocationPreview.perMonth.toFixed(2)).toLocaleString('en-US')}
                    </Text>
                  </View>
                )}
                <Text style={styles.previewNote}>
                  Budget is already funded. Auto refresh just keeps it topped up; any extra you add stays as spendable buffer.
                </Text>
              </View>
            )}
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
                <Text style={styles.optionTitle}>Manual only</Text>
                <Text style={styles.optionSubtitle}>Keep it as-is; top up anytime. Extra is just extra to spend.</Text>
              </View>
              <View style={[
                styles.radio,
                fundingMethod === 'manual' && styles.radioSelected,
              ]}>
                {fundingMethod === 'manual' && <View style={styles.radioInner} />}
              </View>
            </View>
            {fundingMethod === 'manual' && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewNote}>
                  You'll manually add money to this plan whenever you want. No automatic allocations will be made.
                </Text>
              </View>
            )}
          </Pressable>

          {/* Hybrid Fund */}
          <Pressable
            style={[
              styles.optionCard,
              fundingMethod === 'hybrid' && styles.optionCardSelected,
            ]}
            onPress={() => {
              haptics.selection();
              setFundingMethod('hybrid');
            }}
          >
            <View style={styles.optionHeader}>
              <View style={[
                styles.optionIconContainer,
                fundingMethod === 'hybrid' && styles.optionIconContainerSelected,
              ]}>
                <Settings size={24} color={fundingMethod === 'hybrid' ? colors.primary : colors.text} />
              </View>
              <View style={styles.optionHeaderText}>
                <Text style={styles.optionTitle}>Auto + manual</Text>
                <Text style={styles.optionSubtitle}>Small auto refresh plus your manual top-ups. Extra stays available to spend.</Text>
              </View>
              <View style={[
                styles.radio,
                fundingMethod === 'hybrid' && styles.radioSelected,
              ]}>
                {fundingMethod === 'hybrid' && <View style={styles.radioInner} />}
              </View>
            </View>
            {fundingMethod === 'hybrid' && (
              <View style={styles.previewContainer}>
                {allocationPreview && (
                  <>
                    <View style={styles.previewHeader}>
                      <TrendingUp size={16} color={colors.primary} />
                      <Text style={styles.previewTitle}>Allocation Preview</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Total allocation</Text>
                      <Text style={styles.previewValue}>
                        ₦{allocationPreview.totalAllocation.toLocaleString('en-US')}
                      </Text>
                    </View>
                    {allocationPreview.days <= 7 && (
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Per day</Text>
                        <Text style={styles.previewValue}>
                          ₦{Number(allocationPreview.perDay.toFixed(2)).toLocaleString('en-US')}
                        </Text>
                      </View>
                    )}
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Per week</Text>
                      <Text style={styles.previewValue}>
                        ₦{Number(allocationPreview.perWeek.toFixed(2)).toLocaleString('en-US')}
                      </Text>
                    </View>
                    {allocationPreview.days > 30 && (
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Per month</Text>
                        <Text style={styles.previewValue}>
                          ₦{Number(allocationPreview.perMonth.toFixed(2)).toLocaleString('en-US')}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                <Text style={styles.previewNote}>
                  Budget is funded upfront. Auto refresh is optional; manual top-ups remain as extra to spend.
                </Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!fundingMethod || (fundingMethod === 'hybrid' && !autoFundMinimum) || isSaving}
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
