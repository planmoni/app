import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Calculator, Edit2, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { 
  calculateRequiredContribution, 
  PayoutSchedule,
  ContributionCalculation 
} from '@/lib/engines/contributionCalculator';

export default function ContributionCalculationScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const [targetAmount, setTargetAmount] = useState(parseFloat((params.targetAmount as string) || '0'));
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const dateTypeParam = params.dateType as 'range' | 'one_time' | 'ongoing';
  const dateType: 'range' | 'one_time' | 'ongoing' =
    dateTypeParam ||
    (startDateStr && endDateStr
      ? startDateStr === endDateStr
        ? 'one_time'
        : 'range'
      : 'range');
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;
  const parsedPlanTypes: string[] = planTypesParam ? (() => {
    try {
      return JSON.parse(planTypesParam);
    } catch {
      return [];
    }
  })() : [];
  const primaryPlanType = (parsedPlanTypes[0] as 'recurring' | 'one_time' | 'long_term' | undefined) || 'recurring';
  const isOneTime = primaryPlanType === 'one_time' || dateType === 'one_time';

  const [payoutSchedule, setPayoutSchedule] = useState<PayoutSchedule>(
    primaryPlanType === 'one_time' ? 'daily' : primaryPlanType === 'long_term' ? 'monthly' : 'weekly'
  );
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState(targetAmount.toString());
  const [isSaving, setIsSaving] = useState(false);

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const endDate = endDateStr ? new Date(endDateStr) : null;

  const calculation = useMemo<ContributionCalculation | null>(() => {
    if (!targetAmount || !startDate) return null;
    
    const amountToUse = isEditingAmount ? parseFloat(editedAmount.replace(/,/g, '')) || targetAmount : targetAmount;
    
    if (isOneTime) {
      const remainingAmount = amountToUse;
      return {
        requiredPerCycle: remainingAmount,
        requiredPerDay: 0,
        cyclesRemaining: 1,
        daysRemaining: 1,
        schedule: 'daily',
        message: 'One-time payout on your start date.',
      };
    }

    return calculateRequiredContribution(
      amountToUse,
      startDate,
      endDate,
      payoutSchedule,
      0 // Current balance - will be 0 for new plans
    );
  }, [targetAmount, startDate, endDate, payoutSchedule, isEditingAmount, editedAmount, isOneTime]);

  const allowancePerDay = calculation ? calculation.requiredPerDay : 0;
  const allowancePerWeek = calculation ? Math.ceil(calculation.requiredPerDay * 7) : 0;
  const displayRequiredPerCycle = calculation ? calculation.requiredPerCycle : 0;

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

  const handleAmountEdit = (value: string) => {
    const formatted = formatAmount(value);
    setEditedAmount(formatted);
  };

  const handleSaveAmount = () => {
    const numericAmount = parseFloat(editedAmount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount < 1000) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount (minimum ₦1,000)');
      haptics.notification();
      return;
    }
    setTargetAmount(numericAmount);
    setIsEditingAmount(false);
    haptics.mediumImpact();
  };

  const handleContinue = async () => {
    haptics.mediumImpact();
    setIsSaving(true);

    try {
      const finalAmount = isEditingAmount 
        ? parseFloat(editedAmount.replace(/,/g, '')) 
        : targetAmount;

      // Update draft plan with contribution info
      if (planId) {
        await saveDraftExpensePlan({
          planId,
          total_budget: finalAmount,
          // Store payout schedule and required contributions in metadata for now
          // Will be moved to proper fields after database migration
        });
      }

      // Navigate to funding source
      router.push({
        pathname: '/create-vault/funding-source',
        params: {
          planName,
          targetAmount: finalAmount.toString(),
          startDate: startDateStr,
          endDate: endDateStr || '',
          dateType,
          payoutSchedule,
          requiredPerCycle: calculation?.requiredPerCycle.toString() || '0',
          requiredPerDay: calculation?.requiredPerDay.toString() || '0',
          planId: planId || '',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
        },
      });
    } catch (error) {
      console.error('Error saving contribution calculation:', error);
      Alert.alert('Error', 'Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, textSizeMultiplier);

  if (!calculation) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Contribution</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to calculate contribution. Please check your plan details.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
        <Text style={styles.headerTitle}>Budget Amount</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/create-vault/contribution-calculation');
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
          {/* Target Amount - Editable */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Budget amount</Text>
              {!isEditingAmount ? (
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    setIsEditingAmount(true);
                  }}
                  style={styles.editButton}
                >
                  <Edit2 size={16} color={colors.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSaveAmount}
                  style={styles.saveButton}
                >
                  <Check size={16} color={colors.primary} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
              )}
            </View>
            {isEditingAmount ? (
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={editedAmount}
                  onChangeText={handleAmountEdit}
                  autoFocus
                />
              </View>
            ) : (
              <Text style={styles.amountDisplay}>
                ₦{targetAmount.toLocaleString('en-US')}
              </Text>
            )}
          </View>

          {/* Payout Schedule Selection */}
          <View style={styles.section}>
            {primaryPlanType === 'recurring' ? (
              <>
                <Pressable
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    haptics.selection();
                    setShowScheduleOptions(prev => !prev);
                  }}
                >
                  <Text style={styles.dropdownValue}>
                    {payoutSchedule === 'daily'
                      ? 'Daily'
                      : payoutSchedule === 'weekly'
                      ? 'Weekly'
                      : payoutSchedule === 'biweekly'
                      ? 'Biweekly'
                      : 'Monthly'}
                  </Text>
                  {showScheduleOptions ? (
                    <ChevronUp size={18} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={18} color={colors.textSecondary} />
                  )}
                </Pressable>
                {showScheduleOptions && (
                  <View style={styles.dropdownMenu}>
                    {(['daily', 'weekly', 'biweekly', 'monthly'] as PayoutSchedule[]).map(schedule => {
                      const label =
                        schedule === 'daily'
                          ? 'Daily'
                          : schedule === 'weekly'
                          ? 'Weekly'
                          : schedule === 'biweekly'
                          ? 'Biweekly'
                          : 'Monthly';
                      const selected = payoutSchedule === schedule;
                      return (
                        <Pressable
                          key={schedule}
                          style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                          onPress={() => {
                            haptics.selection();
                            setPayoutSchedule(schedule);
                            setShowScheduleOptions(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              selected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.infoNote}>
                <Text style={styles.infoNoteTitle}>
                  {primaryPlanType === 'one_time' ? 'One-time spend window' : 'Long-term budget pace'}
                </Text>
                <Text style={styles.infoNoteBody}>
                  {primaryPlanType === 'one_time'
                    ? 'Cadence locked to one-time release for this one-time spend window based on your dates.'
                    : 'Cadence locked to monthly for long-term budgets to keep pacing simple.'}
                </Text>
              </View>
            )}
          </View>

          {/* Calculation Results */}
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Planned spend</Text>
            
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {isOneTime ? 'On start date' : `Per ${payoutSchedule === 'daily' ? 'day' : payoutSchedule === 'weekly' ? 'week' : payoutSchedule === 'biweekly' ? '2 weeks' : 'month'}`}
              </Text>
              <Text style={styles.resultValue}>
                ₦{displayRequiredPerCycle.toLocaleString('en-US')}
              </Text>
            </View>

            {!isOneTime && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Per Day</Text>
                <Text style={styles.resultValue}>
                  ₦{calculation.requiredPerDay.toLocaleString('en-US')}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>
                {isOneTime
                  ? `You should receive ₦${displayRequiredPerCycle.toLocaleString('en-US')} on your start date to carry out this spend.`
                  : calculation.message}
              </Text>
            </View>

            {!isOneTime && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  {calculation.cyclesRemaining} {payoutSchedule === 'daily' ? 'days' : payoutSchedule === 'weekly' ? 'weeks' : payoutSchedule === 'biweekly' ? '2-week periods' : 'months'} remaining
                </Text>
              </View>
            )}
          </View>

          <View style={styles.allowanceCard}>
            <View style={styles.allowanceHeader}>
              <Text style={styles.allowanceTitle}>Allowance guidance</Text>
              <Text style={styles.allowanceSub}>
                {isOneTime
                  ? 'Single payout on your start date—ensure funds are ready then.'
                  : 'Stay within this pace to keep other categories safe.'}
              </Text>
            </View>
            {isOneTime ? (
              <Text style={styles.allowanceNote}>
                One payout only: ₦{displayRequiredPerCycle.toLocaleString('en-US')} on your start date.
              </Text>
            ) : (
              <>
                <View style={styles.allowanceRow}>
                  <Text style={styles.allowanceLabel}>Daily allowance</Text>
                  <Text style={styles.allowanceValue}>₦{allowancePerDay.toLocaleString('en-US')}</Text>
                </View>
                <View style={styles.allowanceRow}>
                  <Text style={styles.allowanceLabel}>Weekly allowance</Text>
                  <Text style={styles.allowanceValue}>₦{allowancePerWeek.toLocaleString('en-US')}</Text>
                </View>
                <Text style={styles.allowanceNote}>
                  If you overspend here, we’ll reduce what’s free to spend elsewhere or ask you to adjust this budget or timeline.
                </Text>
              </>
            )}
          </View>
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
      backgroundColor: colors.background,
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
    placeholder: {
      width: 40,
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
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    editButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '500',
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    saveButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
    amountDisplay: {
      fontSize: getScaledFontSize(32, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
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
      minHeight: 64,
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
    scheduleContainer: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    scheduleButton: {
      flex: 1,
      minWidth: '22%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    scheduleButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    scheduleText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    scheduleTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginTop: 8,
    },
    dropdownValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      fontWeight: '600',
    },
    dropdownMenu: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    dropdownItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemSelected: {
      backgroundColor: colors.primary + '10',
      borderBottomColor: colors.primary,
    },
    dropdownItemText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    dropdownItemTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    infoNote: {
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: 6,
    },
    infoNoteTitle: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    infoNoteBody: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
    },
    allowanceCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 16,
    },
    allowanceHeader: {
      marginBottom: 12,
      gap: 4,
    },
    allowanceTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    allowanceSub: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
    },
    allowanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    allowanceLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    allowanceValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    allowanceNote: {
      marginTop: 10,
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
    },
    resultsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    resultsTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 20,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    resultLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    resultValue: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    messageContainer: {
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    messageText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
      textAlign: 'center',
    },
    infoContainer: {
      alignItems: 'center',
    },
    infoText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
