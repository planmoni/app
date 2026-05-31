import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Calendar, Target, Flag } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type Priority = 'high' | 'medium' | 'low';
type DateType = 'range' | 'one_time' | 'ongoing';

export default function BasicSetupScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [planName, setPlanName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [budgetStructure, setBudgetStructure] = useState<'fixed' | 'estimated' | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [dateType, setDateType] = useState<DateType>('range');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [oneTimeDate, setOneTimeDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | 'one_time' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const amountInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      nameInputRef.current?.focus();
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

  const getMinimumMaturityDate = () => {
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() + 14);
    return minDate;
  };

  const isBeforeMinimumMaturityDate = (date: Date) => {
    const normalizedDate = normalizeDate(date);
    return normalizedDate < getMinimumMaturityDate();
  };

  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const handleDateSelect = (date: Date) => {
    if (isBeforeMinimumMaturityDate(date)) return;
    
    haptics.selection();
    const normalizedDate = normalizeDate(date);

    if (datePickerType === 'one_time') {
      setOneTimeDate(normalizedDate);
      setShowDatePicker(false);
      setDatePickerType(null);
      return;
    }

    if (datePickerType === 'start') {
      setStartDate(normalizedDate);
      if (endDate && normalizedDate > normalizeDate(endDate)) {
        setEndDate(null);
      }
      setShowDatePicker(false);
      setDatePickerType(null);
      return;
    }

    if (datePickerType === 'end') {
      if (startDate && normalizedDate < normalizeDate(startDate)) {
        Alert.alert('Invalid Date', 'End date must be after start date');
        haptics.notification();
        return;
      }
      setEndDate(normalizedDate);
      setShowDatePicker(false);
      setDatePickerType(null);
      return;
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateSelected = (date: Date) => {
    const normalizedDate = normalizeDate(date);
    if (datePickerType === 'one_time' && oneTimeDate) {
      return normalizedDate.getTime() === normalizeDate(oneTimeDate).getTime();
    }
    if (datePickerType === 'start' && startDate) {
      return normalizedDate.getTime() === normalizeDate(startDate).getTime();
    }
    if (datePickerType === 'end' && endDate) {
      return normalizedDate.getTime() === normalizeDate(endDate).getTime();
    }
    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const handleContinue = async () => {
    // Validation
    if (!planName.trim()) {
      setError('Please enter a plan name');
      haptics.notification();
      return;
    }

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

    if (!budgetStructure) {
      setError('Please select a budget structure');
      haptics.notification();
      return;
    }

    if (!priority) {
      setError('Please select a priority level');
      haptics.notification();
      return;
    }

    // Date validation
    let finalStartDate: string | null = null;
    let finalEndDate: string | null = null;

    if (dateType === 'one_time') {
      if (!oneTimeDate) {
        setError('Please select a date');
        haptics.notification();
        return;
      }
      finalStartDate = formatDateForStorage(oneTimeDate);
      finalEndDate = null;
    } else if (dateType === 'range') {
      if (!startDate) {
        setError('Please select a start date');
        haptics.notification();
        return;
      }
      finalStartDate = formatDateForStorage(startDate);
      finalEndDate = null;
    } else if (dateType === 'ongoing') {
      if (!startDate) {
        setError('Please select a start date');
        haptics.notification();
        return;
      }
      finalStartDate = formatDateForStorage(startDate);
      finalEndDate = null; // Ongoing plans have no end date
    }

    if (!finalStartDate || isBeforeMinimumMaturityDate(new Date(finalStartDate))) {
      setError('Maturity date must be at least 2 weeks from today');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);
    setError(null);

    try {
      let activePlanId = planId;
      let draftPlan;

      if (activePlanId) {
        draftPlan = await saveDraftExpensePlan({
          planId: activePlanId,
          name: planName.trim(),
          total_budget: numericAmount,
          start_date: finalStartDate,
          end_date: finalEndDate,
        });
      } else {
        draftPlan = await saveDraftExpensePlan({
          name: planName.trim(),
          total_budget: numericAmount,
          start_date: finalStartDate,
          end_date: finalEndDate,
        });
      }

      if (!draftPlan || !draftPlan.id) {
        throw new Error('Failed to create draft plan: No plan ID returned');
      }

      // Navigate to funding source (skipping contribution-calculation)
      router.push({
        pathname: '/expense-planner/create/funding-source',
        params: {
          planName: planName.trim(),
          targetAmount: targetAmount.replace(/,/g, ''),
          budgetStructure,
          priority,
          maturityDate: finalStartDate,
          dateType,
          planId: draftPlan.id,
          ...(subCategories && { subCategories }),
          ...(planTypesParam && { planTypes: planTypesParam }),
          // Default to daily payout schedule for one_time plans
          payoutSchedule: 'daily',
          requiredPerCycle: '0',
        },
      });
    } catch (error) {
      console.error('Error saving basic setup:', error);
      setError('Failed to save plan. Please try again.');
      Alert.alert('Error', 'Failed to create expense plan. Please try again.');
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
        <Text style={styles.headerTitle}>Basic Setup</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/basic-setup');
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
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Plan Name */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Flag size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Plan Name</Text>
            </View>
            <TextInput
              ref={nameInputRef}
              style={styles.textInput}
              placeholder="e.g., Vacation Fund, New Phone"
              placeholderTextColor={colors.textTertiary}
              value={planName}
              onChangeText={(text) => {
                setPlanName(text);
                setError(null);
              }}
            />
          </View>

          {/* Target Amount */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Target size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Target Amount</Text>
            </View>
            <View
              style={[
                styles.amountContainer,
                targetAmount.trim() !== '' && styles.amountContainerFilled,
                error && targetAmount === '' && styles.amountContainerError,
              ]}
            >
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

          {/* Budget Structure */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Structure</Text>
            <View style={styles.checkboxContainer}>
              <Pressable
                style={[
                  styles.checkbox,
                  budgetStructure === 'fixed' && styles.checkboxSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setBudgetStructure('fixed');
                  setError(null);
                }}
              >
                <View
                  style={[
                    styles.checkboxInner,
                    budgetStructure === 'fixed' && styles.checkboxInnerSelected,
                  ]}
                >
                  {budgetStructure === 'fixed' && (
                    <View style={styles.checkboxCheckmark} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Fixed</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.checkbox,
                  budgetStructure === 'estimated' && styles.checkboxSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setBudgetStructure('estimated');
                  setError(null);
                }}
              >
                <View
                  style={[
                    styles.checkboxInner,
                    budgetStructure === 'estimated' && styles.checkboxInnerSelected,
                  ]}
                >
                  {budgetStructure === 'estimated' && (
                    <View style={styles.checkboxCheckmark} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Estimated</Text>
              </Pressable>
            </View>
          </View>

          {/* Priority Level */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Priority Level</Text>
            <View style={styles.checkboxContainer}>
              {(['high', 'medium', 'low'] as Priority[]).map((pri) => (
                <Pressable
                  key={pri}
                  style={[
                    styles.checkbox,
                    priority === pri && styles.checkboxSelected,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setPriority(pri);
                    setError(null);
                  }}
                >
                  <View
                    style={[
                      styles.checkboxInner,
                      priority === pri && styles.checkboxInnerSelected,
                    ]}
                  >
                    {priority === pri && (
                      <View style={styles.checkboxCheckmark} />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {pri.charAt(0).toUpperCase() + pri.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Dates</Text>
            </View>

            {/* Date Type Selection */}
            <View style={styles.dateTypeContainer}>
              <Pressable
                style={[
                  styles.dateTypeButton,
                  dateType === 'range' && styles.dateTypeButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setDateType('range');
                }}
              >
                <Text style={[
                  styles.dateTypeText,
                  dateType === 'range' && styles.dateTypeTextSelected,
                ]}>
                  Date Range
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dateTypeButton,
                  dateType === 'one_time' && styles.dateTypeButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setDateType('one_time');
                }}
              >
                <Text style={[
                  styles.dateTypeText,
                  dateType === 'one_time' && styles.dateTypeTextSelected,
                ]}>
                  One Time
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dateTypeButton,
                  dateType === 'ongoing' && styles.dateTypeButtonSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setDateType('ongoing');
                }}
              >
                <Text style={[
                  styles.dateTypeText,
                  dateType === 'ongoing' && styles.dateTypeTextSelected,
                ]}>
                  Ongoing
                </Text>
              </Pressable>
            </View>

            {/* Date Inputs */}
            {dateType === 'one_time' && (
              <Pressable
                style={styles.dateInput}
                onPress={() => {
                  setDatePickerType('one_time');
                  setShowDatePicker(true);
                }}
              >
                <Text style={[
                  styles.dateInputText,
                  !oneTimeDate && styles.dateInputPlaceholder,
                ]}>
                  {formatDateForDisplay(oneTimeDate)}
                </Text>
              </Pressable>
            )}

            {dateType === 'range' && (
              <>
                <Pressable
                  style={styles.dateInput}
                  onPress={() => {
                    setDatePickerType('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.dateInputLabel}>Start Date</Text>
                  <Text style={[
                    styles.dateInputText,
                    !startDate && styles.dateInputPlaceholder,
                  ]}>
                    {formatDateForDisplay(startDate)}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.dateInput, { marginTop: 12 }]}
                  onPress={() => {
                    if (!startDate) {
                      Alert.alert('Select Start Date', 'Please select a start date first');
                      haptics.notification();
                      return;
                    }
                    setDatePickerType('end');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.dateInputLabel}>End Date</Text>
                  <Text style={[
                    styles.dateInputText,
                    !endDate && styles.dateInputPlaceholder,
                  ]}>
                    {formatDateForDisplay(endDate)}
                  </Text>
                </Pressable>
              </>
            )}

            {dateType === 'ongoing' && (
              <Pressable
                style={styles.dateInput}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateInputLabel}>Start Date</Text>
                <Text style={[
                  styles.dateInputText,
                  !startDate && styles.dateInputPlaceholder,
                ]}>
                  {formatDateForDisplay(startDate)}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>
                    {datePickerType === 'one_time' ? 'Select Date' :
                     datePickerType === 'start' ? 'Select Start Date' :
                     'Select End Date'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowDatePicker(false);
                      setDatePickerType(null);
                    }}
                    style={styles.datePickerClose}
                  >
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>
                <View style={styles.calendarContainer}>
                  <View style={styles.calendarHeader}>
                    <Pressable
                      onPress={() => {
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
                        haptics.lightImpact();
                      }}
                      style={styles.navigationButton}
                    >
                      <ArrowLeft size={20} color={colors.text} />
                    </Pressable>
                    <Text style={styles.monthYearText}>
                      {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
                        haptics.lightImpact();
                      }}
                      style={styles.navigationButton}
                    >
                      <ArrowLeft size={20} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                    </Pressable>
                  </View>
                  <View style={styles.daysGrid}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <View key={day} style={styles.weekDay}>
                        <Text style={styles.weekDayText}>{day}</Text>
                      </View>
                    ))}
                    {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                      <View key={`empty-${index}`} style={styles.dayCell} />
                    ))}
                    {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                      const isDisabled = isBeforeMinimumMaturityDate(date);
                      const isSelected = isDateSelected(date);
                      const isTodayDate = isToday(date);

                      return (
                        <Pressable
                          key={`day-${index}`}
                          style={[
                            styles.dayCell,
                            isTodayDate && !isSelected && styles.todayDay,
                            isSelected && styles.selectedDay,
                            isDisabled && styles.disabledDay,
                          ]}
                          onPress={() => !isDisabled && handleDateSelect(date)}
                          disabled={isDisabled}
                        >
                          <Text style={[
                            styles.dayText,
                            isTodayDate && !isSelected && styles.todayDayText,
                            isSelected && styles.selectedDayText,
                            isDisabled && styles.disabledDayText,
                          ]}>
                            {index + 1}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!planName || !targetAmount || !budgetStructure || !priority || isSaving}
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
    section: {
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      borderWidth: 2,
      borderColor: colors.border,
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
      borderColor: colors.primary,
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
    checkboxContainer: {
      gap: 12,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    checkboxInner: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    checkboxInnerSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxCheckmark: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    checkboxLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    dateTypeContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    dateTypeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
    },
    dateTypeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    dateTypeText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    dateTypeTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    dateInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    dateInputLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    dateInputText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    dateInputPlaceholder: {
      color: colors.textTertiary,
      fontWeight: '400',
    },
    datePickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    datePickerContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    datePickerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    datePickerClose: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarContainer: {
      marginTop: 8,
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
    monthYearText: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    weekDay: {
      width: '14.28%',
      alignItems: 'center',
      paddingVertical: 8,
    },
    weekDayText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.textSecondary,
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
  });
