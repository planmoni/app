import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Calendar, TrendingUp, Repeat, ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

type TopUpFrequency = 'daily' | 'weekly' | 'monthly';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const FREQUENCY_OPTIONS: { value: TopUpFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function AutoTopUpConfigScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep, updateExpensePlan, fetchExpensePlans } = useExpensePlans();

  const planId = params.planId as string | undefined;
  const mode = (params.mode as string | undefined) || undefined;
  const isEdit = mode === 'edit';
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const maturityDateStr = (params.maturityDate as string) || (params.startDate as string);
  const dateType = params.dateType as string | undefined;
  const payoutSchedule = params.payoutSchedule as string | undefined;
  const requiredPerCycle = params.requiredPerCycle as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = (params.planTypesParam || params.planTypes) as string | undefined;

  // Calculate days until maturity and auto-select frequency
  const { daysUntilStart, defaultFrequency } = useMemo(() => {
    if (!maturityDateStr) return { daysUntilStart: 0, defaultFrequency: 'weekly' as TopUpFrequency };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maturityDate = new Date(maturityDateStr);
    maturityDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Auto-select frequency based on days until start
    let frequency: TopUpFrequency;
    if (daysUntil < 7) {
      frequency = 'daily';
    } else if (daysUntil < 14) {
      frequency = 'daily'; // User said: if more than 1 week but not up to 2 weeks, Daily
    } else if (daysUntil < 30) {
      frequency = 'weekly';
    } else {
      frequency = 'monthly';
    }

    return { daysUntilStart: daysUntil, defaultFrequency: frequency };
  }, [maturityDateStr]);

  // State for selected frequency
  const [selectedFrequency, setSelectedFrequency] = useState<TopUpFrequency>(defaultFrequency);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  // Calculate top-up configuration based on selected frequency
  const topUpConfig = useMemo(() => {
    if (!maturityDateStr || !targetAmount) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maturityDate = new Date(maturityDateStr);
    maturityDate.setHours(0, 0, 0, 0);

    // Calculate top-up start date (tomorrow)
    const topUpStartDate = new Date(today);
    topUpStartDate.setDate(today.getDate() + 1);
    topUpStartDate.setHours(0, 0, 0, 0);

    // Calculate top-up end date (day before maturity)
    const topUpEndDate = new Date(maturityDate);
    topUpEndDate.setDate(maturityDate.getDate() - 1);
    topUpEndDate.setHours(0, 0, 0, 0);

    // Calculate number of cycles based on frequency
    const daysForTopups = Math.max(0, daysUntilStart - 1); // Days from tomorrow to day before start
    
    let cycles = 1;
    let cycleDays = 1;
    
    if (selectedFrequency === 'daily') {
      cycles = Math.max(1, daysForTopups);
      cycleDays = 1;
    } else if (selectedFrequency === 'weekly') {
      cycles = Math.max(1, Math.ceil(daysForTopups / 7));
      cycleDays = 7;
    } else if (selectedFrequency === 'monthly') {
      cycles = Math.max(1, Math.ceil(daysForTopups / 30));
      cycleDays = 30;
    }

    // Calculate amount per cycle
    const amountPerCycle = targetAmount / cycles;

    // Calculate all funding dates
    const fundingDates: Date[] = [];
    let currentDate = new Date(topUpStartDate);
    
    while (currentDate <= topUpEndDate && fundingDates.length < cycles) {
      fundingDates.push(new Date(currentDate));
      
      // Move to next cycle date
      if (selectedFrequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (selectedFrequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (selectedFrequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Next top-up date (first date in the list)
    const nextTopUpDate = fundingDates.length > 0 ? fundingDates[0] : topUpStartDate;

    return {
      frequency: selectedFrequency,
      amountPerCycle,
      cycles,
      topUpStartDate,
      topUpEndDate,
      nextTopUpDate,
      daysUntilStart,
      fundingDates,
    };
  }, [maturityDateStr, targetAmount, selectedFrequency, daysUntilStart]);

  const formatDateForDisplay = (date: Date) => {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateForStorage = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateShort = (date: Date) => {
    return `${MONTHS[date.getMonth()].substring(0, 3)} ${date.getDate()}`;
  };

  const getFrequencyLabel = (frequency: TopUpFrequency) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
    }
  };

  const getFrequencyPeriod = (frequency: TopUpFrequency) => {
    switch (frequency) {
      case 'daily': return 'day';
      case 'weekly': return 'week';
      case 'monthly': return 'month';
    }
  };

  const handleFrequencySelect = (frequency: TopUpFrequency) => {
    haptics.selection();
    setSelectedFrequency(frequency);
    setShowFrequencyDropdown(false);
  };

  const handleContinue = async () => {
    if (!topUpConfig) {
      Alert.alert('Error', 'Unable to calculate top-up configuration.');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();

    try {
      if (isEdit) {
        if (!planId) {
          Alert.alert('Error', 'Missing plan id.');
          return;
        }

        // Persist auto top-up settings directly to the existing plan.
        await updateExpensePlan(planId, {
          funding_method: 'auto',
          auto_topup_enabled: true,
          auto_topup_frequency: topUpConfig.frequency,
          auto_topup_amount: topUpConfig.amountPerCycle,
          auto_topup_start_date: formatDateForStorage(topUpConfig.topUpStartDate),
          auto_topup_end_date: formatDateForStorage(topUpConfig.topUpEndDate),
          auto_topup_next_date: formatDateForStorage(topUpConfig.nextTopUpDate),
          auto_topup_total_cycles: topUpConfig.cycles,
        });

        await fetchExpensePlans();
        router.replace({
          pathname: '/expense-planner/[id]/details',
          params: { id: planId },
        });
        return;
      }

      // Create flow: Save auto top-up configuration to draft plan
      if (planId) {
        await saveDraftExpensePlan({
          planId,
        });
      }

      // Navigate to start action with auto top-up config
      router.push({
        pathname: '/create-vault/review',
        params: {
          planName,
          targetAmount: targetAmount.toString(),
          maturityDate: maturityDateStr,
          planId: planId || '',
          dateType,
          payoutSchedule,
          requiredPerCycle: requiredPerCycle || '0',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
          fundingMethod: 'auto',
          startAction: 'wallet',
          // Auto top-up configuration
          autoTopupEnabled: 'true',
          autoTopupFrequency: topUpConfig.frequency,
          autoTopupAmount: topUpConfig.amountPerCycle.toFixed(2),
          autoTopupStartDate: formatDateForStorage(topUpConfig.topUpStartDate),
          autoTopupEndDate: formatDateForStorage(topUpConfig.topUpEndDate),
          autoTopupNextDate: formatDateForStorage(topUpConfig.nextTopUpDate),
          autoTopupTotalCycles: topUpConfig.cycles.toString(),
        },
      });
    } catch (error) {
      console.error('Error saving auto top-up config:', error);
      Alert.alert('Error', 'Failed to save configuration. Please try again.');
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!topUpConfig) {
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
          <Text style={styles.headerTitle}>Auto Top-Up</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to calculate top-up configuration. Please check your plan details.</Text>
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
        <Text style={styles.headerTitle}>Auto Top-Up</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (isEdit) {
              if (planId) {
                router.replace({
                  pathname: '/expense-planner/[id]/details',
                  params: { id: planId },
                });
              } else {
                router.replace('/(tabs)');
              }
              return;
            }

            if (planId) {
              await saveLastStep(planId, '/create-vault/auto-topup-config');
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
          <View style={styles.section}>
            <Text style={styles.sectionDescription}>
              We'll automatically transfer money from your available balance to this plan based on the schedule below.
            </Text>
          </View>

          {/* Frequency Dropdown */}
          <View style={styles.configCard}>
            <Text style={styles.configSectionTitle}>Funding Frequency</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => {
                haptics.selection();
                setShowFrequencyDropdown(!showFrequencyDropdown);
              }}
            >
              <View style={styles.dropdownButtonContent}>
                <Repeat size={20} color={colors.primary} />
                <Text style={styles.dropdownButtonText}>
                  {getFrequencyLabel(selectedFrequency)}
                </Text>
              </View>
              <ChevronDown 
                size={20} 
                color={colors.textSecondary}
                style={[
                  styles.dropdownChevron,
                  showFrequencyDropdown && styles.dropdownChevronOpen
                ]}
              />
            </Pressable>

            {/* Dropdown Options */}
            {showFrequencyDropdown && (
              <View style={styles.dropdownContainer}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.dropdownOption,
                      selectedFrequency === option.value && styles.dropdownOptionSelected
                    ]}
                    onPress={() => handleFrequencySelect(option.value)}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      selectedFrequency === option.value && styles.dropdownOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {selectedFrequency === option.value && (
                      <Check size={18} color={colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Amount Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>
                ₦{Math.ceil(topUpConfig.amountPerCycle).toLocaleString('en-US')} {getFrequencyLabel(selectedFrequency)} top-up
              </Text>
              <Text style={styles.breakdownSubtext}>
                {topUpConfig.cycles} {getFrequencyPeriod(selectedFrequency)}{topUpConfig.cycles !== 1 ? 's' : ''} × ₦{Math.ceil(topUpConfig.amountPerCycle).toLocaleString('en-US')} = ₦{targetAmount.toLocaleString('en-US')}
              </Text>
            </View>
            </View>

          {/* Funding Dates */}
          {topUpConfig.fundingDates.length > 0 && (
            <View style={styles.datesCard}>
              <Text style={styles.datesTitle}>Auto Funding Dates</Text>
              <View style={styles.datesList}>
                {(showAllDates ? topUpConfig.fundingDates : topUpConfig.fundingDates.slice(0, 5)).map((date, index) => (
                  <View key={index} style={styles.dateItem}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text style={styles.dateText}>
                      {formatDateForDisplay(date)}
                    </Text>
                    <Text style={styles.dateAmount}>
                      ₦{Math.ceil(topUpConfig.amountPerCycle).toLocaleString('en-US')}
                    </Text>
                  </View>
                ))}
              </View>
              {topUpConfig.fundingDates.length > 5 && (
                <Pressable
                  style={styles.seeAllButton}
                  onPress={() => {
                    haptics.selection();
                    setShowAllDates(!showAllDates);
                  }}
                >
                  <Text style={styles.seeAllButtonText}>
                    {showAllDates ? 'Show Less' : `See All (${topUpConfig.fundingDates.length} dates)`}
                  </Text>
                  <ChevronDown 
                    size={16} 
                    color={colors.primary}
                    style={[
                      styles.seeAllChevron,
                      showAllDates && styles.seeAllChevronOpen
                    ]}
                  />
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryText}>
              Starting {formatDateForDisplay(topUpConfig.topUpStartDate)} until {formatDateForDisplay(topUpConfig.topUpEndDate)}
            </Text>
            <Text style={styles.summaryText}>
              Total: ₦{targetAmount.toLocaleString('en-US')} over {topUpConfig.cycles} {getFrequencyPeriod(selectedFrequency)}{topUpConfig.cycles !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.summaryNote}>
              Top-ups will automatically transfer from your available balance to this plan.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
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
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
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
    section: {
      marginBottom: 24,
      alignItems: 'center',
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    configCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    configSectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    dropdownButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    dropdownButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    dropdownChevron: {
      transform: [{ rotate: '0deg' }],
    },
    dropdownChevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
    dropdownContainer: {
      marginTop: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownOptionSelected: {
      backgroundColor: colors.accentBackground,
    },
    dropdownOptionText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
    },
    dropdownOptionTextSelected: {
      fontWeight: '600',
      color: colors.primary,
    },
    breakdownCard: {
      backgroundColor: colors.accentBackground,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    breakdownTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    breakdownSubtext: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    datesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    datesTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    datesList: {
      gap: 12,
    },
    dateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateText: {
      flex: 1,
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
    },
    dateAmount: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    seeAllButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    seeAllChevron: {
      transform: [{ rotate: '0deg' }],
    },
    seeAllChevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
    summaryCard: {
      backgroundColor: colors.accentBackground,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    summaryText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      color: colors.text,
      marginBottom: 8,
      lineHeight: 22,
    },
    summaryNote: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 12,
      fontStyle: 'italic',
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
