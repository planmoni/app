import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Calendar, TrendingUp, Repeat } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

type TopUpFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AutoTopUpConfigScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();

  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = (params.planTypesParam || params.planTypes) as string | undefined;

  // Calculate top-up configuration
  const topUpConfig = useMemo(() => {
    if (!startDateStr || !targetAmount) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    // Calculate days until start (including start date)
    // Example: Budget starts Dec 19, today is Dec 13
    // Days until start: 6 (Dec 13->14, 14->15, 15->16, 16->17, 17->18, 18->19)
    // Top-ups should be: Dec 14, 15, 16, 17, 18 (5 days before start, but we use daysUntilStart for calculation)
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine frequency based on days until start
    let frequency: TopUpFrequency;
    if (daysUntilStart < 7) {
      frequency = 'daily';
    } else if (daysUntilStart < 14) {
      frequency = 'weekly';
    } else if (daysUntilStart < 31) {
      frequency = 'biweekly';
    } else if (daysUntilStart < 91) {
      frequency = 'monthly';
    } else if (daysUntilStart < 365) {
      frequency = 'quarterly';
    } else {
      frequency = 'yearly';
    }

    // Calculate top-up start date (tomorrow)
    const topUpStartDate = new Date(today);
    topUpStartDate.setDate(today.getDate() + 1);
    topUpStartDate.setHours(0, 0, 0, 0);

    // Calculate top-up end date (day before budget starts)
    const topUpEndDate = new Date(startDate);
    topUpEndDate.setDate(startDate.getDate() - 1);
    topUpEndDate.setHours(0, 0, 0, 0);

    // Calculate number of cycles
    // For daily: count days from tomorrow to day before start (inclusive)
    // Example: Budget starts Dec 19, today is Dec 13
    // Top-ups: Dec 14, 15, 16, 17, 18 (5 days)
    // But to reach 100%, we need enough cycles - use daysUntilStart for calculation
    const daysForTopups = daysUntilStart; // Days from today to start date
    
    let cycles = 1;
    if (frequency === 'daily') {
      // For daily, use the number of days until start
      // This ensures we have enough cycles to reach 100% before start
      cycles = daysForTopups;
    } else if (frequency === 'weekly') {
      cycles = Math.ceil(daysForTopups / 7);
    } else if (frequency === 'biweekly') {
      cycles = Math.ceil(daysForTopups / 14);
    } else if (frequency === 'monthly') {
      cycles = Math.ceil(daysForTopups / 30);
    } else if (frequency === 'quarterly') {
      cycles = Math.ceil(daysForTopups / 90);
    } else if (frequency === 'yearly') {
      cycles = Math.ceil(daysForTopups / 365);
    }

    // Ensure at least 1 cycle
    cycles = Math.max(1, cycles);

    // Calculate amount per cycle
    const amountPerCycle = targetAmount / cycles;

    // Next top-up date (tomorrow)
    const nextTopUpDate = new Date(topUpStartDate);

    return {
      frequency,
      amountPerCycle,
      cycles,
      topUpStartDate,
      topUpEndDate,
      nextTopUpDate,
      daysUntilStart,
    };
  }, [startDateStr, targetAmount]);

  const formatDateForDisplay = (date: Date) => {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateForStorage = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFrequencyLabel = (frequency: TopUpFrequency) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
    }
  };

  const handleContinue = async () => {
    if (!topUpConfig) {
      Alert.alert('Error', 'Unable to calculate top-up configuration.');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();

    try {
      // Save auto top-up configuration to draft plan
      if (planId) {
        await saveDraftExpensePlan({
          planId,
          // Store auto top-up config in metadata for now
          // Will be moved to proper fields after database migration
        });
      }

      // Navigate to start action with auto top-up config
      router.push({
        pathname: '/expense-planner/create/start-action',
        params: {
          planName,
          targetAmount: targetAmount.toString(),
          startDate: startDateStr,
          endDate: endDateStr || '',
          planId: planId || '',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
          fundingMethod: 'auto',
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
        <Text style={styles.headerTitle}>Auto Top-Up</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/auto-topup-config');
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
              We'll automatically transfer money from your main balance to this plan based on the schedule below.
            </Text>
          </View>

          <View style={styles.configCard}>
            <View style={styles.configRow}>
              <View style={styles.configLabelContainer}>
                <Repeat size={20} color={colors.textSecondary} />
                <Text style={styles.configLabel}>Frequency</Text>
              </View>
              <Text style={styles.configValue}>{getFrequencyLabel(topUpConfig.frequency)}</Text>
            </View>

            <View style={styles.configRow}>
              <View style={styles.configLabelContainer}>
                <TrendingUp size={20} color={colors.textSecondary} />
                <Text style={styles.configLabel}>Amount per {topUpConfig.frequency === 'daily' ? 'day' : topUpConfig.frequency === 'weekly' ? 'week' : topUpConfig.frequency === 'biweekly' ? '2 weeks' : topUpConfig.frequency === 'monthly' ? 'month' : topUpConfig.frequency === 'quarterly' ? 'quarter' : 'year'}</Text>
              </View>
              <Text style={styles.configValue}>₦{topUpConfig.amountPerCycle.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            <View style={styles.configRow}>
              <View style={styles.configLabelContainer}>
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={styles.configLabel}>Total cycles</Text>
              </View>
              <Text style={styles.configValue}>{topUpConfig.cycles}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryText}>
              ₦{topUpConfig.amountPerCycle.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {topUpConfig.frequency === 'daily' ? 'day' : topUpConfig.frequency === 'weekly' ? 'week' : topUpConfig.frequency === 'biweekly' ? '2 weeks' : topUpConfig.frequency === 'monthly' ? 'month' : topUpConfig.frequency === 'quarterly' ? 'quarter' : 'year'}
            </Text>
            <Text style={styles.summaryText}>
              Starting {formatDateForDisplay(topUpConfig.topUpStartDate)} until {formatDateForDisplay(topUpConfig.topUpEndDate)}
            </Text>
            <Text style={styles.summaryNote}>
              Top-ups will automatically transfer from your main available balance to this plan.
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
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
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
    configRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    configLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    configLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      flex: 1,
    },
    configValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
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

