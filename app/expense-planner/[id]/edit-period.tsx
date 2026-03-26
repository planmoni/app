import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { calculateRequiredContribution, PayoutSchedule } from '@/lib/engines/contributionCalculator';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function EditPeriodScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { expensePlans, updateExpensePlan, fetchExpensePlans } = useExpensePlans();
  
  const plan = expensePlans.find(p => p.id === planId);
  const currentBalance = (plan as any)?.current_balance || 0;
  const planTotalBudget = plan?.total_budget ?? 0;
  const isPartiallyFunded = currentBalance > 0 && planTotalBudget > 0 && currentBalance < planTotalBudget;
  const [startDate, setStartDate] = useState<Date | null>(
    plan?.start_date ? new Date(plan.start_date) : null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    plan?.end_date ? new Date(plan.end_date) : null
  );
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());
  const [isSaving, setIsSaving] = useState(false);

  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return normalizeDate(date) <= today;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateSelected = (date: Date) => {
    const normalizedDate = normalizeDate(date);
    if (startDate) {
      const normalizedStart = normalizeDate(startDate);
      if (normalizedDate.getTime() === normalizedStart.getTime()) return true;
    }
    if (endDate) {
      const normalizedEnd = normalizeDate(endDate);
      if (normalizedDate.getTime() === normalizedEnd.getTime()) return true;
    }
    return false;
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = normalizeDate(endDate);
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
  };

  const handleDateSelect = (date: Date) => {
    if (isPartiallyFunded) return;
    if (isPastDate(date)) return;
    
    haptics.selection();
    const normalizedDate = normalizeDate(date);

    if (!startDate) {
      setStartDate(normalizedDate);
      return;
    }

    if (startDate && !endDate) {
      if (normalizedDate <= normalizeDate(startDate)) {
        Alert.alert('Invalid Date', 'End date must be after start date');
        haptics.notification();
        return;
      }
      setEndDate(normalizedDate);
      return;
    }

    // If both dates are selected, start a new selection
    setStartDate(normalizedDate);
    setEndDate(null);
  };

  const handlePrevMonth = () => {
    if (isPartiallyFunded) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    haptics.lightImpact();
  };

  const handleNextMonth = () => {
    if (isPartiallyFunded) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    haptics.lightImpact();
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return 'Select date';
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateForStorage = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDone = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Missing Dates', 'Please select both start and end dates');
      haptics.notification();
      return;
    }

    if (isPartiallyFunded) {
      Alert.alert('Not Editable', 'Vault Period can’t be edited once the vault is partially funded.');
      haptics.notification();
      return;
    }

    if (endDate <= startDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Recalculate required_per_cycle and required_per_day
      let updates: any = {
        start_date: formatDateForStorage(startDate),
        end_date: formatDateForStorage(endDate),
      };

      if (plan?.total_budget) {
        const payoutSchedule = ((plan as any)?.payout_schedule || 'weekly') as PayoutSchedule;
        const currentBalance = (plan as any)?.current_balance || 0;

        const calculation = calculateRequiredContribution(
          plan.total_budget,
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
      console.error('Error updating period:', error);
      Alert.alert('Error', error.message || 'Failed to update period');
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
        <Text style={styles.headerTitle}>Edit Vault Period</Text>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Vault Period</Text>
        <Text style={styles.description}>
          Select the start and end dates for this vault
        </Text>

        {/* Selected Dates Display */}
        <View style={styles.selectedDatesCard}>
          <View style={styles.dateDisplayRow}>
            <View style={styles.dateDisplayItem}>
              <Text style={styles.dateDisplayLabel}>Start Date</Text>
              <Text style={styles.dateDisplayValue}>
                {startDate ? formatDateForDisplay(startDate) : 'Not selected'}
              </Text>
            </View>
            {endDate && (
              <>
                <View style={styles.dateSeparator}>
                  <Text style={styles.separatorText}>→</Text>
                </View>
                <View style={styles.dateDisplayItem}>
                  <Text style={styles.dateDisplayLabel}>End Date</Text>
                  <Text style={styles.dateDisplayValue}>
                    {formatDateForDisplay(endDate)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={handlePrevMonth} style={styles.navigationButton}>
              <ChevronLeft size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.calendarMonth}>
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
              <ChevronRight size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.calendarGrid}>
            {DAYS.map(day => (
              <View key={day} style={styles.calendarDayHeader}>
                <Text style={styles.calendarDayHeaderText}>{day}</Text>
              </View>
            ))}
            {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.calendarDay} />
            ))}
            {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
              const day = i + 1;
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const isSelected = isDateSelected(date);
              const isInRange = isDateInRange(date);
              const isPast = isPastDate(date);
              
              return (
                <Pressable
                  key={day}
                  style={[
                    styles.calendarDay,
                    isInRange && styles.calendarDayInRange,
                    isSelected && styles.calendarDaySelected,
                    isPast && styles.calendarDayPast,
                  ]}
                  onPress={() => !isPast && !isPartiallyFunded && handleDateSelect(date)}
                  disabled={isPast || isPartiallyFunded}
                >
                  <Text style={[
                    styles.calendarDayText,
                    isSelected && styles.calendarDayTextSelected,
                    isInRange && styles.calendarDayTextInRange,
                    isPast && styles.calendarDayTextPast,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <FloatingButton
        title="Done"
        onPress={handleDone}
        disabled={isSaving || isPartiallyFunded || !startDate || !endDate}
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
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
    selectedDatesCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateDisplayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateDisplayItem: {
      flex: 1,
    },
    dateDisplayLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    dateDisplayValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    dateSeparator: {
      paddingHorizontal: 12,
    },
    separatorText: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      color: colors.textSecondary,
    },
    calendarCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    navigationButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarMonth: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    calendarDayHeader: {
      width: '14.28%',
      paddingVertical: 8,
      alignItems: 'center',
    },
    calendarDayHeaderText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.textSecondary,
    },
    calendarDay: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    calendarDayInRange: {
      backgroundColor: colors.primary + '20',
    },
    calendarDaySelected: {
      backgroundColor: colors.primary,
    },
    calendarDayPast: {
      opacity: 0.3,
    },
    calendarDayText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
    },
    calendarDayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    calendarDayTextInRange: {
      color: colors.primary,
      fontWeight: '500',
    },
    calendarDayTextPast: {
      color: colors.textTertiary,
    },
  });

