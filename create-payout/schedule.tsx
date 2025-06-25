import { View, Text, StyleSheet, Pressable, TextInput, Modal, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, ChevronRight, Clock, Info, Plus, ChevronLeft, ChevronDown, ArrowLeft, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { ScrollView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';

type DatePickerProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDates: string[];
};

type DayOfWeekOption = {
  value: number;
  label: string;
};

type DurationOption = {
  value: number;
  label: string;
  description: string;
};

const DAYS_OF_WEEK: DayOfWeekOption[] = [
  { value: 0, label: 'Every Sunday' },
  { value: 1, label: 'Every Monday' },
  { value: 2, label: 'Every Tuesday' },
  { value: 3, label: 'Every Wednesday' },
  { value: 4, label: 'Every Thursday' },
  { value: 5, label: 'Every Friday' },
  { value: 6, label: 'Every Saturday' },
];

function DatePicker({ isVisible, onClose, onSelect, selectedDates }: DatePickerProps) {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onSelect(formatDate(selectedDate));
    }
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.includes(formatDate(date));
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
    return date < today;
  };

  const styles = createDatePickerStyles(colors, isSmallScreen);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Select Date</Text>
            <View style={styles.monthNavigation}>
              <Pressable style={styles.navigationButton} onPress={handlePrevMonth}>
                <ChevronLeft size={isSmallScreen ? 18 : 20} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.monthYearText}>
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </Text>
              <Pressable style={styles.navigationButton} onPress={handleNextMonth}>
                <ChevronRight size={isSmallScreen ? 18 : 20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.calendar}>
            <View style={styles.weekDays}>
              {DAYS.map(day => (
                <View key={day} style={styles.weekDay}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, index) => (
                <View key={`empty-${index}`} style={styles.dayCell} />
              ))}
              
              {Array.from({ length: getDaysInMonth(currentDate) }).map((_, index) => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
                const isDisabled = isPastDate(date);
                const isDateAlreadySelected = isDateSelected(date);
                const isTodayDate = isToday(date);
                const isCurrentlySelected = selectedDate && 
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.dayCell,
                      isCurrentlySelected && styles.selectedDay,
                      isTodayDate && styles.todayDay,
                      isDateAlreadySelected && styles.alreadySelectedDay,
                      isDisabled && styles.disabledDay,
                    ]}
                    onPress={() => !isDisabled && !isDateAlreadySelected && handleDateSelect(date)}
                    disabled={isDisabled || isDateAlreadySelected}
                  >
                    <Text style={[
                      styles.dayText,
                      isCurrentlySelected && styles.selectedDayText,
                      isTodayDate && styles.todayDayText,
                      isDateAlreadySelected && styles.alreadySelectedDayText,
                      isDisabled && styles.disabledDayText,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.modalActions}>
            <Pressable 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={!selectedDate}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [payoutAmount, setPayoutAmount] = useState('0');
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [numberOfPayouts, setNumberOfPayouts] = useState(12);
  const [isYearlySplit, setIsYearlySplit] = useState(true);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const { width } = useWindowDimensions();
  const haptics = useHaptics();
  
  // New state for day of week selection
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [showDayOfWeekPicker, setShowDayOfWeekPicker] = useState(false);
  
  // New state for duration selection
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>({
    value: 12,
    label: '1 Year',
    description: '12 monthly payments'
  });
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  // Responsive styles based on screen width
  const isSmallScreen = width < 380;

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Duration options based on frequency
  const getDurationOptions = (frequency: string): DurationOption[] => {
    switch (frequency) {
      case 'weekly':
      case 'weekly_specific':
        return [
          { value: 4, label: '1 Month', description: '4 weekly payments' },
          { value: 12, label: '3 Months', description: '12 weekly payments' },
          { value: 24, label: '6 Months', description: '24 weekly payments' },
          { value: 52, label: '1 Year', description: '52 weekly payments' }
        ];
      case 'biweekly':
        return [
          { value: 2, label: '1 Month', description: '2 bi-weekly payments' },
          { value: 6, label: '3 Months', description: '6 bi-weekly payments' },
          { value: 12, label: '6 Months', description: '12 bi-weekly payments' },
          { value: 26, label: '1 Year', description: '26 bi-weekly payments' }
        ];
      case 'monthly':
      case 'end_of_month':
        return [
          { value: 1, label: '1 Month', description: '1 monthly payment' },
          { value: 3, label: '3 Months', description: '3 monthly payments' },
          { value: 6, label: '6 Months', description: '6 monthly payments' },
          { value: 12, label: '1 Year', description: '12 monthly payments' }
        ];
      case 'quarterly':
        return [
          { value: 1, label: '3 Months', description: '1 quarterly payment' },
          { value: 2, label: '6 Months', description: '2 quarterly payments' },
          { value: 4, label: '1 Year', description: '4 quarterly payments' },
          { value: 8, label: '2 Years', description: '8 quarterly payments' }
        ];
      case 'biannual':
        return [
          { value: 1, label: '6 Months', description: '1 bi-annual payment' },
          { value: 2, label: '1 Year', description: '2 bi-annual payments' },
          { value: 4, label: '2 Years', description: '4 bi-annual payments' },
          { value: 6, label: '3 Years', description: '6 bi-annual payments' }
        ];
      case 'annually':
        return [
          { value: 1, label: '1 Year', description: '1 annual payment' },
          { value: 2, label: '2 Years', description: '2 annual payments' },
          { value: 3, label: '3 Years', description: '3 annual payments' },
          { value: 5, label: '5 Years', description: '5 annual payments' }
        ];
      case 'custom':
        return [
          { value: customDates.length || 1, label: 'Custom', description: `${customDates.length || 1} custom payments` }
        ];
      default:
        return [
          { value: 12, label: '1 Year', description: '12 monthly payments' }
        ];
    }
  };

  useEffect(() => {
    if (params.totalAmount) {
      const amount = params.totalAmount as string;
      setTotalAmount(amount);
      if (isYearlySplit) {
        calculatePayoutAmount(amount, 12);
      }
    }
  }, [params.totalAmount]);
  
  // Update duration options when frequency changes
  useEffect(() => {
    const durationOptions = getDurationOptions(selectedSchedule || '');
    setSelectedDuration(durationOptions[durationOptions.length - 1]); // Default to the longest duration
    setNumberOfPayouts(durationOptions[durationOptions.length - 1].value);
    
    if (isYearlySplit && totalAmount) {
      calculatePayoutAmount(totalAmount, durationOptions[durationOptions.length - 1].value);
    }
  }, [selectedSchedule]);

  const calculatePayoutAmount = (total: string, payouts: number) => {
    const numericTotal = parseFloat(total.replace(/,/g, ''));
    if (!isNaN(numericTotal) && payouts > 0) {
      const amount = numericTotal / payouts;
      setPayoutAmount(amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));
    }
  };

  const handleCustomAmountChange = (amount: string) => {
    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    const numericTotal = parseFloat(totalAmount.replace(/,/g, ''));
    
    if (!isNaN(numericAmount)) {
      const possiblePayouts = Math.floor(numericTotal / numericAmount);
      const remainingAmount = numericTotal - (numericAmount * possiblePayouts);
      
      setCustomAmount(amount);
      setPayoutAmount(numericAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));
      setNumberOfPayouts(possiblePayouts);
    }
  };

  const handleYearlySplitToggle = () => {
    setIsYearlySplit(!isYearlySplit);
    if (!isYearlySplit) {
      setNumberOfPayouts(selectedDuration.value);
      calculatePayoutAmount(totalAmount, selectedDuration.value);
      setCustomAmount('');
    }
  };

  const getPayoutLabel = () => {
    switch (selectedSchedule || '') {
      case 'monthly':
        return 'Amount per Month';
      case 'biweekly':
        return 'Amount per Two Weeks';
      case 'weekly':
        return 'Amount per Week';
      case 'weekly_specific':
        return `Amount per Week (${getDayOfWeekName()})`;
      case 'end_of_month':
        return 'Amount per Month End';
      case 'quarterly':
        return 'Amount per Quarter';
      case 'biannual':
        return 'Amount per 6 Months';
      case 'annually':
        return 'Amount per Year';
      case 'custom':
        return `Amount per Payout (${customDates.length} dates)`;
      default:
        return 'Amount per Payout';
    }
  };

  const getDayOfWeekName = () => {
    if (selectedDayOfWeek === null) return 'Select Day';
    return DAYS_OF_WEEK.find(day => day.value === selectedDayOfWeek)?.label || 'Select Day';
  };

  const handleScheduleSelect = (schedule: string) => {
    setSelectedSchedule(schedule);
    
    // Reset duration options based on new frequency
    const durationOptions = getDurationOptions(schedule || '');
    setSelectedDuration(durationOptions[durationOptions.length - 1]);
    setNumberOfPayouts(durationOptions[durationOptions.length - 1].value);
    
    if (isYearlySplit && totalAmount) {
      calculatePayoutAmount(totalAmount, durationOptions[durationOptions.length - 1].value);
    }
    
    // Show day of week picker if weekly_specific is selected
    if ((schedule || '') === 'weekly_specific') {
      if (Platform.OS !== 'web') {
        haptics.selection();
      }
      setShowDayOfWeekPicker(true);
    } else {
      setShowDayOfWeekPicker(false);
    }
  };

  const handleAddDate = () => {
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: string) => {
    const newDates = [...customDates, date].sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    setCustomDates(newDates);
    setNumberOfPayouts(newDates.length);
    calculatePayoutAmount(totalAmount, newDates.length);
    setShowDatePicker(false);
  };

  const handleRemoveDate = (index: number) => {
    const newDates = customDates.filter((_, i) => i !== index);
    setCustomDates(newDates);
    const newNumberOfPayouts = newDates.length || 1;
    setNumberOfPayouts(newNumberOfPayouts);
    calculatePayoutAmount(totalAmount, newNumberOfPayouts);
  };

  const handleDayOfWeekSelect = (dayValue: number) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectedDayOfWeek(dayValue);
    setShowDayOfWeekPicker(false);
  };
  
  const handleDurationSelect = (duration: DurationOption) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectedDuration(duration);
    setNumberOfPayouts(duration.value);
    
    if (isYearlySplit && totalAmount) {
      calculatePayoutAmount(totalAmount, duration.value);
    }
    
    setShowDurationPicker(false);
  };

  const handleContinue = () => {
    // Validate day of week is selected for weekly_specific
    if ((selectedSchedule || '') === 'weekly_specific' && selectedDayOfWeek === null) {
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }
    
    // For custom dates, use the first custom date as startDate
    // For weekly_specific, calculate the first occurrence of the selected day
    let startDate: string;
    if ((selectedSchedule || '') === 'custom' && customDates.length > 0) {
      startDate = customDates[0];
    } else if ((selectedSchedule || '') === 'weekly_specific' && typeof selectedDayOfWeek === 'number') {
      const today = new Date();
      const currentDay = today.getDay();
      let daysToAdd = (selectedDayOfWeek - currentDay + 7) % 7;
      // If today is the selected day, use today
      if (daysToAdd === 0) daysToAdd = 0;
      const firstPayoutDate = new Date(today);
      firstPayoutDate.setDate(today.getDate() + daysToAdd);
      startDate = firstPayoutDate.toISOString().split('T')[0];
    } else {
      startDate = new Date().toISOString().split('T')[0];
    }
    
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    
    router.push({
      pathname: '/create-payout/destination',
      params: {
        totalAmount,
        frequency: selectedSchedule,
        payoutAmount,
        duration: numberOfPayouts.toString(),
        startDate,
        customDates: JSON.stringify(customDates),
        dayOfWeek: selectedDayOfWeek !== null ? selectedDayOfWeek.toString() : undefined
      }
    });
  };

  const styles = createStyles(colors, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '40%' }]} />
        </View>
        <Text style={styles.stepText}>Step 2 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>How frequent do you want us to send this money?</Text>
          <Text style={styles.description}>Choose your payout schedule</Text>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scheduleOptions}
          >
            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'weekly' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('weekly');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'weekly' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'weekly' && styles.selectedOptionText
              ]}>Weekly</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'weekly_specific' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('weekly_specific');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'weekly_specific' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'weekly_specific' && styles.selectedOptionText
              ]}>Specific Day</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'biweekly' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('biweekly');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'biweekly' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'biweekly' && styles.selectedOptionText
              ]}>Bi-weekly</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'monthly' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('monthly');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'monthly' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'monthly' && styles.selectedOptionText
              ]}>Monthly</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'end_of_month' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('end_of_month');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'end_of_month' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'end_of_month' && styles.selectedOptionText
              ]}>Every Month End</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'quarterly' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('quarterly');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'quarterly' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'quarterly' && styles.selectedOptionText
              ]}>Quarterly</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'biannual' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('biannual');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'biannual' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'biannual' && styles.selectedOptionText
              ]}>Bi-annual</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'annually' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('annually');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'annually' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'annually' && styles.selectedOptionText
              ]}>Annually</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'custom' && styles.selectedOption
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                handleScheduleSelect('custom');
              }}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'custom' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'custom' && styles.selectedOptionText
              ]}>Custom Dates</Text>
            </Pressable>
          </ScrollView>

          {selectedSchedule === 'weekly_specific' && (
            <View style={styles.dayOfWeekSection}>
              <Text style={styles.dayOfWeekTitle}>Select Day of Week</Text>
              <Pressable 
                style={styles.dayOfWeekSelector}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    haptics.selection();
                  }
                  setShowDayOfWeekPicker(!showDayOfWeekPicker);
                }}
              >
                <Text style={styles.dayOfWeekText}>
                  {selectedDayOfWeek !== null ? getDayOfWeekName() : 'Select a day'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </Pressable>
              
              {showDayOfWeekPicker && (
                <View style={styles.dayOfWeekOptions}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Pressable
                      key={day.value}
                      style={[
                        styles.dayOfWeekOption,
                        selectedDayOfWeek === day.value && styles.selectedDayOfWeek
                      ]}
                      onPress={() => handleDayOfWeekSelect(day.value)}
                    >
                      <Text style={[
                        styles.dayOfWeekOptionText,
                        selectedDayOfWeek === day.value && styles.selectedDayOfWeekText
                      ]}>
                        {day.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {selectedSchedule === 'custom' && (
            <View style={styles.customDatesSection}>
              <Text style={styles.customDatesTitle}>Selected Dates</Text>
              
              {customDates.map((date, index) => (
                <View key={index} style={styles.dateItem}>
                  <View style={styles.dateInfo}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text style={styles.dateText}>{formatDateForDisplay(date)}</Text>
                  </View>
                  <Pressable 
                    style={styles.removeDateButton}
                    onPress={() => handleRemoveDate(index)}
                  >
                    <Text style={styles.removeDateText}>Remove</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable 
                style={styles.addDateButton}
                onPress={handleAddDate}
              >
                <Plus size={20} color="#1E3A8A" />
                <Text style={styles.addDateText}>Add Date</Text>
              </Pressable>
            </View>
          )}
          
          {/* Duration Selector */}
          {selectedSchedule !== 'custom' && (
            <View style={styles.durationSection}>
              <Text style={styles.durationTitle}>Select Duration</Text>
              <Pressable 
                style={styles.durationSelector}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    haptics.selection();
                  }
                  setShowDurationPicker(!showDurationPicker);
                }}
              >
                <View style={styles.durationSelectorContent}>
                  <Text style={styles.durationText}>{selectedDuration.label}</Text>
                  <Text style={styles.durationDescription}>{selectedDuration.description}</Text>
                </View>
                <ChevronDown size={20} color={colors.textSecondary} />
              </Pressable>
              
              {showDurationPicker && (
                <View style={styles.durationOptions}>
                  {getDurationOptions(selectedSchedule || '').map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.durationOption,
                        selectedDuration.value === option.value && styles.selectedDurationOption
                      ]}
                      onPress={() => handleDurationSelect(option)}
                    >
                      <View>
                        <Text style={[
                          styles.durationOptionText,
                          selectedDuration.value === option.value && styles.selectedDurationOptionText
                        ]}>
                          {option.label}
                        </Text>
                        <Text style={[
                          styles.durationOptionDescription,
                          selectedDuration.value === option.value && styles.selectedDurationOptionDescription
                        ]}>
                          {option.description}
                        </Text>
                      </View>
                      {selectedDuration.value === option.value && (
                        <View style={styles.durationCheckmark}>
                          <Check size={16} color="#1E3A8A" />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.amountContainer}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>{getPayoutLabel()}</Text>
              <Pressable
                style={styles.splitToggle}
                onPress={handleYearlySplitToggle}
              >
                <Text style={[
                  styles.splitToggleText,
                  isYearlySplit && styles.splitToggleTextActive
                ]}>
                  {selectedDuration.label} Split
                </Text>
              </Pressable>
            </View>
            
            <Pressable 
              style={styles.amountRow}
              onPress={() => setIsEditingAmount(true)}
            >
              <Text style={styles.amount}>₦{payoutAmount}</Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </Pressable>
            
            <Text style={styles.payoutCount}>
              {numberOfPayouts} payout{numberOfPayouts !== 1 ? 's' : ''} of ₦{payoutAmount}
            </Text>
          </View>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.noticeText}>
              Your funds will be automatically deposited to your bank account on the dates you've selected
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={
          (selectedSchedule === 'custom' && customDates.length === 0) || 
          (selectedSchedule === 'weekly_specific' && selectedDayOfWeek === null)
        }
        hapticType="medium"
      />

      <Modal
        visible={isEditingAmount}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditingAmount(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Amount per {selectedSchedule}</Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                placeholder="Enter amount"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setIsEditingAmount(false)}
                variant="outline"
                style={styles.modalCancelButton}
              />
              <Button
                title="Confirm"
                onPress={() => {
                  setIsYearlySplit(false);
                  setIsEditingAmount(false);
                }}
                style={styles.modalConfirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <DatePicker
        isVisible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        selectedDates={customDates}
      />
    </SafeAreaView>
  );
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 15 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  scheduleOptions: {
    paddingRight: 20,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: isSmallScreen ? 10 : 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 120,
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
    borderColor: '#1E3A8A',
  },
  optionText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#1E3A8A',
  },
  dayOfWeekSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  dayOfWeekTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  dayOfWeekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  dayOfWeekText: {
    fontSize: 16,
    color: colors.text,
  },
  dayOfWeekOptions: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayOfWeekOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedDayOfWeek: {
    backgroundColor: colors.backgroundTertiary,
  },
  dayOfWeekOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  selectedDayOfWeekText: {
    color: colors.primary,
    fontWeight: '500',
  },
  durationSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  durationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  durationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  durationSelectorContent: {
    flex: 1,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  durationDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  durationOptions: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  durationOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDurationOption: {
    backgroundColor: colors.backgroundTertiary,
  },
  durationOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  selectedDurationOptionText: {
    color: colors.primary,
  },
  durationOptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedDurationOptionDescription: {
    color: colors.primary,
  },
  durationCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customDatesSection: {
    marginBottom: 24,
  },
  customDatesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
  },
  removeDateButton: {
    padding: 8,
  },
  removeDateText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  addDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  addDateText: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  amountContainer: {
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amount: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '600',
    color: colors.text,
  },
  splitTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  splitText: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  payoutCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    borderRadius: 12,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: {
    fontSize: isSmallScreen ? 18 : 20,
    color: colors.textSecondary,
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: isSmallScreen ? 18 : 20,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitToggle: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitToggleText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  splitToggleTextActive: {
    color: '#1E3A8A',
  },
});

const createDatePickerStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  calendarHeader: {
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationButton: {
    padding: 8,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
  },
  monthYearText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  calendar: {
    marginBottom: 24,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100/7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.text,
  },
  selectedDay: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  todayDay: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  todayDayText: {
    color: '#1E3A8A',
    fontWeight: '500',
  },
  alreadySelectedDay: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
  },
  alreadySelectedDayText: {
    color: colors.textSecondary,
  },
  disabledDay: {
    opacity: 0.5,
  },
  disabledDayText: {
    color: colors.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.backgroundTertiary,
  },
  confirmButton: {
    backgroundColor: '#1E3A8A',
  },
  cancelButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  confirmButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});