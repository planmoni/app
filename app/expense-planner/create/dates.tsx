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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DatesScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  const planName = params.planName as string;
  const targetAmount = params.targetAmount as string;
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDate = normalizeDate(date);
    // Treat today as unavailable; start date must be from the next day
    return normalizedDate <= today;
  };

  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = normalizeDate(endDate);
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
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

  const handleDateSelect = (date: Date) => {
    if (isPastDate(date)) return;
    
    haptics.selection();
    const normalizedDate = normalizeDate(date);

    // If both dates are selected, start a new selection
    if (startDate && endDate) {
      setStartDate(normalizedDate);
      setEndDate(null);
      return;
    }

    // If no start date, set it
    if (!startDate) {
      setStartDate(normalizedDate);
      return;
    }

    // If only start date is set
    const normalizedStart = normalizeDate(startDate);
    
    // Prevent same-day start/end selection
    if (normalizedDate.getTime() === normalizedStart.getTime()) {
      Alert.alert('Invalid selection', 'End date must be after start date.');
      haptics.notification();
      return;
    }

    // If date is before start date, set it as new start and clear end
    if (normalizedDate < normalizedStart) {
      setStartDate(normalizedDate);
      setEndDate(null);
      return;
    }

    // If date is after start date, set it as end date
    setEndDate(normalizedDate);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    haptics.lightImpact();
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
    haptics.lightImpact();
  };

  const getAvailableYears = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const maxYear = currentYear + 10; // 10 years into the future
    const years = [];
    for (let year = currentYear; year <= maxYear; year++) {
      years.push(year);
    }
    return years;
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(newDate);
    setShowYearPicker(false);
    haptics.selection();
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(currentMonth.getFullYear(), month, 1);
    setCurrentMonth(newDate);
    setShowMonthPicker(false);
    haptics.selection();
  };

  const handleContinue = async () => {
    const finalStartDate = startDate;
    const finalEndDate = endDate;

    if (!finalStartDate || !finalEndDate) {
      Alert.alert('Missing Dates', 'Please select a start date and an end date.');
      haptics.notification();
      return;
    }

    if (finalEndDate <= finalStartDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date.');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Save dates to draft plan if planId exists
      let activePlanId = planId;
      if (activePlanId) {
        await saveDraftExpensePlan({
          planId: activePlanId,
          name: planName,
          total_budget: parseFloat(targetAmount),
          start_date: formatDateForStorage(finalStartDate),
          end_date: formatDateForStorage(finalEndDate),
        });
      }

      // Navigate to funding source (skipping contribution-calculation)
      router.push({
        pathname: '/expense-planner/create/funding-source',
        params: {
          planName,
          targetAmount,
          startDate: formatDateForStorage(finalStartDate),
          endDate: formatDateForStorage(finalEndDate),
          planId: activePlanId || '',
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
          // Default to daily payout schedule for one_time plans
          payoutSchedule: 'daily',
          requiredPerCycle: '0',
        },
      });
    } catch (error: any) {
      console.error('Error saving dates:', error);
      Alert.alert('Error', 'Failed to save dates. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Choose Dates</Text>
        <Pressable 
          onPress={async () => {
            haptics.selection();
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/dates');
            }
            router.replace('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>When is the plan valid for?</Text>
        <Text style={styles.description}>
          Pick the start and end dates for this spending budget (or keep it to a single day).
        </Text>

        {/* Selected Dates Display */}
        {(startDate || endDate) && (
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
        )}

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            {!showYearPicker && !showMonthPicker ? (
              <>
                <Pressable 
                  onPress={handlePrevMonth} 
                  style={styles.navigationButton}
                >
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
                <View style={styles.monthYearContainer}>
                  <Pressable 
                    onPress={() => {
                      setShowMonthPicker(true);
                      haptics.selection();
                    }}
                    style={styles.monthYearPressable}
                  >
                    <Text style={styles.monthYearText}>
                      {MONTHS[currentMonth.getMonth()]}
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      setShowYearPicker(true);
                      haptics.selection();
                    }}
                    style={styles.monthYearPressable}
                  >
                    <Text style={styles.monthYearText}>
                      {currentMonth.getFullYear()}
                    </Text>
                  </Pressable>
                </View>
                <Pressable 
                  onPress={handleNextMonth} 
                  style={styles.navigationButton}
                >
                  <ChevronRight 
                    size={20} 
                    color={colors.text} 
                  />
                </Pressable>
              </>
            ) : showMonthPicker ? (
              <>
                <Pressable 
                  onPress={() => {
                    setShowMonthPicker(false);
                    haptics.selection();
                  }}
                  style={styles.navigationButton}
                >
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
                <View style={styles.monthYearContainer}>
                  <Text style={styles.monthYearText}>Select Month</Text>
                </View>
                <View style={styles.navigationButton} />
              </>
            ) : (
              <>
                <View style={styles.navigationButton} />
                <View style={styles.monthYearContainer}>
                  <Pressable 
                    onPress={() => {
                      setShowYearPicker(false);
                      haptics.selection();
                    }}
                    style={styles.monthYearPressable}
                  >
                    <Text style={styles.monthYearText}>
                      {currentMonth.getFullYear()}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.navigationButton} />
              </>
            )}
          </View>

          {showMonthPicker ? (
            <ScrollView 
              style={styles.pickerContainer} 
              contentContainerStyle={styles.pickerContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.monthPickerGrid}>
                {MONTHS.map((month, index) => {
                  const isSelected = index === currentMonth.getMonth();
                  const isCurrentMonth = index === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();
                  return (
                    <Pressable
                      key={month}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemSelected,
                      ]}
                      onPress={() => handleMonthSelect(index)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected,
                        isCurrentMonth && !isSelected && styles.pickerItemTextCurrent,
                      ]}>
                        {month}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : showYearPicker ? (
            <ScrollView 
              style={styles.pickerContainer} 
              contentContainerStyle={styles.pickerContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.yearPickerGrid}>
                {getAvailableYears().map((year) => {
                  const isSelected = year === currentMonth.getFullYear();
                  const isCurrentYear = year === new Date().getFullYear();
                  return (
                    <Pressable
                      key={year}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemSelected,
                      ]}
                      onPress={() => handleYearSelect(year)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected,
                        isCurrentYear && !isSelected && styles.pickerItemTextCurrent,
                      ]}>
                        {year}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.calendar}>
              <View style={styles.weekDays}>
                {DAYS.map(day => (
                  <View key={day} style={styles.weekDay}>
                    <Text style={styles.weekDayText}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                  <View key={`empty-${index}`} style={styles.dayCell} />
                ))}
                
                {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                  const normalizedDate = normalizeDate(date);
                  const isDisabled = isPastDate(date);
                  const isSelected = isDateSelected(date);
                  const isTodayDate = isToday(date);
                  const inRange = isDateInRange(date);

                  return (
                    <Pressable
                      key={`day-${index}`}
                      style={[
                        styles.dayCell,
                        isTodayDate && !isSelected && styles.todayDay,
                        isSelected && styles.selectedDay,
                        inRange && !isSelected && styles.rangeDay,
                        isDisabled && styles.disabledDay,
                      ]}
                      onPress={() => !isDisabled && handleDateSelect(date)}
                      disabled={isDisabled}
                    >
                      <Text style={[
                        styles.dayText,
                        isTodayDate && !isSelected && styles.todayDayText,
                        isSelected && styles.selectedDayText,
                        inRange && !isSelected && styles.rangeDayText,
                        isDisabled && styles.disabledDayText,
                      ]}>
                        {index + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {startDate && endDate && (
          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>Budget Duration</Text>
            <Text style={styles.durationValue}>
              {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days
            </Text>
          </View>
        )}
      </ScrollView>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!startDate || !endDate || isSaving}
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
      fontSize: getScaledFontSize(24, textSizeMultiplier),
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
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
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
      fontWeight: '500',
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
      fontWeight: '500',
    },
    calendarCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
    },
    durationCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 8,
    },
    durationValue: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    navigationButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 20,
    },
    navigationButtonDisabled: {
      opacity: 0.4,
    },
    monthYearContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthYearPressable: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    monthYearText: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    pickerContainer: {
      maxHeight: 300,
    },
    pickerContent: {
      paddingVertical: 8,
    },
    monthPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    yearPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    pickerItem: {
      flex: 1,
      minWidth: '30%',
      aspectRatio: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerItemSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pickerItemText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    pickerItemTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    pickerItemTextCurrent: {
      color: colors.primary,
      fontWeight: '600',
    },
    calendar: {
      // Calendar styles
    },
    weekDays: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
    },
    weekDayText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.textSecondary,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      marginVertical: 2,
    },
    selectedDay: {
      backgroundColor: colors.primary,
    },
    todayDay: {
      backgroundColor: colors.backgroundTertiary,
    },
    disabledDay: {
      opacity: 0.3,
    },
    rangeDay: {
      backgroundColor: colors.primary + '20',
    },
    dayText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    selectedDayText: {
      color: '#fff',
      fontWeight: '700',
    },
    todayDayText: {
      color: colors.primary,
      fontWeight: '700',
    },
    disabledDayText: {
      color: colors.textTertiary,
    },
    rangeDayText: {
      color: colors.primary,
    },
  });

