import { View, Text, StyleSheet, Pressable, Platform, ScrollView, useColorScheme, Modal, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, ChevronRight, ChevronDown, ArrowLeft, X, CalendarDays, Clock, ChevronLeft, Plus } from 'lucide-react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import Button from '@/components/Button';
import { useHaptics } from '@/hooks/useHaptics';
import { useWindowDimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { PayoutFeeFrequency } from '@/types/payout-fees';

type FrequencyOption = {
  value: string;
  label: string;
};

type DurationOption = {
  value: number;
  label: string;
  description: string;
};

type DayOfWeekOption = {
  value: number;
  label: string;
};

type TimePickerProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (hour: number, minute: number) => void;
  selectedHour: number;
  selectedMinute: number;
};

type DatePickerProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDates: string[];
};

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly_specific', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly(Every 2 weeks)' },
  { value: 'end_of_month', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly(Every 3 months)' },
  { value: 'biannual', label: 'Bi-annually(Every 6 months)' },
  { value: 'annually', label: 'Annually' },
];

const DAYS_OF_WEEK: DayOfWeekOption[] = [
  { value: 0, label: 'Every Sunday' },
  { value: 1, label: 'Every Monday' },
  { value: 2, label: 'Every Tuesday' },
  { value: 3, label: 'Every Wednesday' },
  { value: 4, label: 'Every Thursday' },
  { value: 5, label: 'Every Friday' },
  { value: 6, label: 'Every Saturday' },
];

function TimePicker({ isVisible, onClose, onSelect, selectedHour, selectedMinute }: TimePickerProps) {
  const { colors } = useTheme();
  const [hour, setHour] = useState(selectedHour);
  const [minute, setMinute] = useState(selectedMinute);
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  
  const handleConfirm = () => {
    onSelect(hour, minute);
    onClose();
  };
  
  const styles = createTimePickerStyles(colors);
  
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Time</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.timeContainer}>
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Hour</Text>
              <ScrollView 
                style={styles.timeScroll} 
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={Platform.OS === 'android'}
                bounces={Platform.OS === 'ios'}
              >
                {hours.map((h) => (
                  <Pressable
                    key={h}
                    style={[styles.timeOption, hour === h && styles.selectedTimeOption]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      hour === h && styles.selectedTimeOptionText
                    ]}>
                      {h.toString().padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            
            <Text style={styles.timeSeparator}>:</Text>
            
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Minute</Text>
              <ScrollView 
                style={styles.timeScroll} 
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={Platform.OS === 'android'}
                bounces={Platform.OS === 'ios'}
              >
                {minutes.filter(m => m % 5 === 0).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.timeOption, minute === m && styles.selectedTimeOption]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      minute === m && styles.selectedTimeOptionText
                    ]}>
                      {m.toString().padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DatePicker({ isVisible, onClose, onSelect, selectedDates }: DatePickerProps) {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      return;
    }

    const dateString = formatDate(date);
    const isDateAlreadySelected = selectedDates.includes(dateString);
    
    if (isDateAlreadySelected) {
      onSelect(dateString);
      return;
    }
    
    if (selectedDates.length >= 7) {
      return;
    }
    
    onSelect(dateString);
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

  const isTodayOrPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate <= today;
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
            <Text style={styles.calendarTitle}>
              {selectedDates.length >= 7 
                ? `Maximum 7 dates selected (${selectedDates.length}/7)`
                : `Select dates (${selectedDates.length}/7)`}
            </Text>
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
                <View key={`empty-${index}`} style={styles.dayCell}>
                  <Text style={styles.dayText}></Text>
                </View>
              ))}
              
              {Array.from({ length: getDaysInMonth(currentDate) }).map((_, index) => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
                const isDisabled = isTodayOrPastDate(date);
                const isDateAlreadySelected = isDateSelected(date);
                const isTodayDate = isToday(date);
                const isMaxDatesReached = selectedDates.length >= 7 && !isDateAlreadySelected;

                return (
                  <Pressable
                    key={`day-${index}`}
                    style={[
                      styles.dayCell,
                      isDateAlreadySelected && styles.selectedDay,
                      isTodayDate && !isDateAlreadySelected && !isDisabled && !isMaxDatesReached && styles.todayDay,
                      (isDisabled || isMaxDatesReached) && styles.disabledDay,
                    ]}
                    onPress={() => !isDisabled && !isMaxDatesReached && handleDateSelect(date)}
                    disabled={isDisabled || isMaxDatesReached}
                  >
                    <Text style={[
                      styles.dayText,
                      isDateAlreadySelected && styles.selectedDayText,
                      isTodayDate && !isDateAlreadySelected && !isDisabled && !isMaxDatesReached && styles.todayDayText,
                      (isDisabled || isMaxDatesReached) && styles.disabledDayText,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedDates.length > 0 && (
            <View style={styles.selectedDatesContainer}>
              <Text style={styles.selectedDatesTitle}>Selected Dates:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedDatesList}>
                {selectedDates.sort().map((date, index) => (
                  <View key={index} style={styles.selectedDateChip}>
                    <Text style={styles.selectedDateText}>{formatDateForDisplay(date)}</Text>
                    <Pressable
                      onPress={() => onSelect(date)}
                      style={styles.removeDateButton}
                    >
                      <X size={14} color={colors.text} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalActions}>
            <Pressable 
              style={[styles.modalButton, styles.doneButton]}
              onPress={onClose}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FrequencySelectionScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isDark = useColorScheme() === 'dark';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const [selectedFrequency, setSelectedFrequency] = useState<string | null>('daily');
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'frequency' | 'custom'>('frequency');
  
  // Schedule-related state
  const [totalAmount, setTotalAmount] = useState(params.totalAmount as string || '0');
  const [payoutAmount, setPayoutAmount] = useState('0');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [showDayOfWeekPicker, setShowDayOfWeekPicker] = useState(false);
  const [numberOfPayouts, setNumberOfPayouts] = useState(0);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Individual amounts per date for custom dates
  const [dateAmounts, setDateAmounts] = useState<Record<string, string>>({});
  const [dateTimes, setDateTimes] = useState<Record<string, string>>({}); // date -> "HH:mm", default 12:00
  const [timePickerForDate, setTimePickerForDate] = useState<string | null>(null); // which date's time we're picking
  const [showBulkTimePicker, setShowBulkTimePicker] = useState(false); // set time for all payouts
  const [netAmount, setNetAmount] = useState<number>(0); // Total amount after fees
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [isEqualSplit, setIsEqualSplit] = useState(true);
  
  const isUpdatingDurationRef = useRef(false);
  const lastSelectedFrequencyRef = useRef<string>('');

  // Duration options based on frequency
  const getDurationOptions = (frequency: string, totalAmount?: string): DurationOption[] => {
    switch (frequency) {
      case 'daily':
        const numericAmount = totalAmount ? parseFloat(totalAmount.replace(/,/g, '')) : 0;
        const isAmountBelow50K = numericAmount > 0 && numericAmount < 50000;
        
        if (isAmountBelow50K) {
          return [{ value: 7, label: '1 Week', description: '7 daily payments' }];
        }
        
        return [
          { value: 7, label: '1 Week', description: '7 daily payments' },
          { value: 30, label: '1 Month', description: '30 daily payments' },
          { value: 90, label: '3 Months', description: '90 daily payments' }
        ];
      case 'weekly_specific':
        const numericAmountWeekly = totalAmount ? parseFloat(totalAmount.replace(/,/g, '')) : 0;
        const isAmountBelow50KWeekly = numericAmountWeekly > 0 && numericAmountWeekly < 50000;
        
        if (isAmountBelow50KWeekly) {
          return [
            { value: 4, label: '1 Month', description: '4 weekly payments' },
            { value: 12, label: '3 Months', description: '12 weekly payments' }
          ];
        }
        
        return [
          { value: 4, label: '1 Month', description: '4 weekly payments' },
          { value: 12, label: '3 Months', description: '12 weekly payments' },
          { value: 24, label: '6 Months', description: '24 weekly payments' },
          { value: 52, label: '1 Year', description: '52 weekly payments' }
        ];
      case 'biweekly':
        const numericAmountBiweekly = totalAmount ? parseFloat(totalAmount.replace(/,/g, '')) : 0;
        const isAmountBelow50KBiweekly = numericAmountBiweekly > 0 && numericAmountBiweekly < 50000;
        
        if (isAmountBelow50KBiweekly) {
          return [
            { value: 2, label: '1 Month', description: '2 bi-weekly payments' },
            { value: 6, label: '3 Months', description: '6 bi-weekly payments' }
          ];
        }
        
        return [
          { value: 2, label: '1 Month', description: '2 bi-weekly payments' },
          { value: 6, label: '3 Months', description: '6 bi-weekly payments' },
          { value: 12, label: '6 Months', description: '12 bi-weekly payments' },
          { value: 26, label: '1 Year', description: '26 bi-weekly payments' }
        ];
      case 'end_of_month':
        const numericAmountMonthly = totalAmount ? parseFloat(totalAmount.replace(/,/g, '')) : 0;
        const isAmountBelow50KMonthly = numericAmountMonthly > 0 && numericAmountMonthly < 50000;
        
        if (isAmountBelow50KMonthly) {
          return [
            { value: 1, label: '1 Month', description: '1 monthly payment' },
            { value: 3, label: '3 Months', description: '3 monthly payments' }
          ];
        }
        
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
      default:
        return [{ value: 12, label: '1 Year', description: '12 monthly payments' }];
    }
  };

  // Fetch fee percentage for a given frequency
  const fetchFeePercentage = useCallback(async (frequency: string): Promise<number> => {
    try {
      // Map frequency to database frequency type
      let dbFrequency: PayoutFeeFrequency;
      if (frequency === 'weekly_specific') {
        dbFrequency = 'weekly_specific';
      } else if (frequency === 'end_of_month') {
        dbFrequency = 'end_of_month';
      } else if (frequency === 'custom') {
        dbFrequency = 'custom';
      } else {
        dbFrequency = frequency as PayoutFeeFrequency;
      }
      
      const { data, error } = await supabase
        .from('payout_fees')
        .select('fee_percentage')
        .eq('frequency', dbFrequency)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.warn('Error fetching fee percentage for', frequency, error);
        return 0;
      }
      
      return data.fee_percentage || 0;
    } catch (error) {
      console.error('Error in fetchFeePercentage:', error);
      return 0;
    }
  }, []);

  const calculatePayoutAmount = useCallback(async (total: string, payouts: number, frequency?: string) => {
    const numericTotal = parseFloat(total.replace(/,/g, ''));
    if (!isNaN(numericTotal) && payouts > 0) {
      const freq = frequency || selectedFrequency || 'daily';
      const feePercentage = await fetchFeePercentage(freq);
      const feeAmount = numericTotal * (feePercentage / 100);
      const netAmount = numericTotal - feeAmount;
      const baseAmount = netAmount / payouts;
      const roundedDown = Math.floor(baseAmount * 100) / 100;
      const formattedAmount = roundedDown.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      
      if (formattedAmount !== payoutAmount) {
        setPayoutAmount(formattedAmount);
      }
    }
  }, [payoutAmount, selectedFrequency, fetchFeePercentage]);

  // Initialize dateTimes from params when we have customDates
  useEffect(() => {
    if (!params.customDates) return;
    try {
      const dates = JSON.parse(params.customDates as string);
      if (!Array.isArray(dates)) return;
      const initial: Record<string, string> = {};
      if (params.customDateTimes) {
        const times = JSON.parse(params.customDateTimes as string);
        if (times && typeof times === 'object') {
          dates.forEach((d: string) => { initial[d] = times[d] || '12:00'; });
        } else {
          dates.forEach((d: string) => { initial[d] = '12:00'; });
        }
      } else {
        dates.forEach((d: string) => { initial[d] = '12:00'; });
      }
      setDateTimes(initial);
    } catch (e) {
      console.error('Error parsing customDateTimes/customDates:', e);
    }
  }, [params.customDateTimes, params.customDates]);

  // Initialize from params
  useEffect(() => {
    if (params.totalAmount) {
      setTotalAmount(params.totalAmount as string);
    }
    
    // Initialize frequency and related fields when editing from review page
    if (params.frequency) {
      const freq = params.frequency as string;
      setSelectedFrequency(freq);
      lastSelectedFrequencyRef.current = freq;
      
      // Set active tab based on frequency
      if (freq === 'custom') {
        setActiveTab('custom');
      } else {
        setActiveTab('frequency');
      }
      
      // Initialize duration if provided
      if (params.duration) {
        const durationValue = parseInt(params.duration as string);
        setNumberOfPayouts(durationValue);
        
        // Find matching duration option
        const durationOptions = getDurationOptions(freq, params.totalAmount as string);
        const matchingDuration = durationOptions.find(opt => opt.value === durationValue);
        if (matchingDuration) {
          setSelectedDuration(matchingDuration);
        }
      }
      
      // Initialize time if provided
      if (params.payoutHour) {
        setSelectedHour(parseInt(params.payoutHour as string));
      }
      if (params.payoutMinute) {
        setSelectedMinute(parseInt(params.payoutMinute as string));
      }
      
      // Initialize day of week if provided
      if (params.dayOfWeek) {
        setSelectedDayOfWeek(parseInt(params.dayOfWeek as string));
      }
      
      // Initialize payout amount if provided
      if (params.payoutAmount) {
        setPayoutAmount(params.payoutAmount as string);
        
        // Initialize individual amounts for custom dates
        if (freq === 'custom' && params.customDates) {
          try {
            const dates = JSON.parse(params.customDates as string);
            if (Array.isArray(dates) && dates.length > 0) {
              // Check if we have individual amounts from params
              if (params.customDateAmounts) {
                try {
                  const amounts = JSON.parse(params.customDateAmounts as string);
                  if (amounts && typeof amounts === 'object') {
                    setDateAmounts(amounts);
                    setIsEqualSplit(false);
                  }
                } catch (e) {
                  console.error('Error parsing custom date amounts:', e);
                }
              } else {
                // Check if using custom amount (not equal split) based on average
                const numericPayoutAmt = parseFloat(params.payoutAmount.toString().replace(/,/g, ''));
                const numericTotal = parseFloat(params.totalAmount.toString().replace(/,/g, ''));
                const expectedPayoutAmt = numericTotal / dates.length;
                
                // If payout amount doesn't match expected (total/dates), it's a custom amount
                if (Math.abs(numericPayoutAmt - expectedPayoutAmt) > 0.01) {
                  setIsEqualSplit(false);
                  // We can't reconstruct individual amounts from average, so leave empty
                  // User will need to set them again
                } else {
                  setIsEqualSplit(true);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing custom dates in initialization:', e);
          }
        }
      }
    }
  }, [params.totalAmount, params.frequency, params.duration, params.payoutAmount, params.payoutHour, params.payoutMinute, params.dayOfWeek, params.customDates]);

  // Update duration when frequency changes
  useEffect(() => {
    if (isUpdatingDurationRef.current || !selectedFrequency) {
      return;
    }
    
    if (selectedFrequency === lastSelectedFrequencyRef.current) {
      return;
    }
    
    isUpdatingDurationRef.current = true;
    lastSelectedFrequencyRef.current = selectedFrequency;
    
    const durationOptions = getDurationOptions(selectedFrequency, totalAmount);
    
    let defaultDuration;
    if (selectedFrequency === 'daily') {
      const numericAmount = totalAmount ? parseFloat(totalAmount.replace(/,/g, '')) : 0;
      const isAmountBelow50K = numericAmount > 0 && numericAmount < 50000;
      
      if (isAmountBelow50K) {
        defaultDuration = durationOptions.find(opt => opt.value === 7) || durationOptions[0];
      } else {
        defaultDuration = durationOptions.find(opt => opt.value === 30) || durationOptions[0];
      }
    } else {
      defaultDuration = durationOptions[durationOptions.length - 1];
    }
    
    if (defaultDuration) {
      setSelectedDuration(defaultDuration);
      setNumberOfPayouts(defaultDuration.value);
      if (totalAmount && totalAmount !== '0') {
        calculatePayoutAmount(totalAmount, defaultDuration.value, selectedFrequency);
      }
    }
    
    // Show day of week picker if weekly_specific
    if (selectedFrequency === 'weekly_specific') {
      setTimeout(() => {
        setShowDayOfWeekPicker(true);
      }, 300);
    }
    
    setTimeout(() => {
      isUpdatingDurationRef.current = false;
    }, 100);
  }, [selectedFrequency, totalAmount, calculatePayoutAmount]);

  // Update amount when duration changes (only for frequency tab)
  useEffect(() => {
    if (activeTab === 'frequency' && selectedDuration && totalAmount && totalAmount !== '0' && selectedFrequency) {
      calculatePayoutAmount(totalAmount, selectedDuration.value, selectedFrequency);
    } else if (activeTab === 'frequency' && !selectedDuration) {
      setPayoutAmount('0');
    }
  }, [selectedDuration, totalAmount, selectedFrequency, activeTab, calculatePayoutAmount]);

  // Reset payout amount when switching tabs
  useEffect(() => {
    if (activeTab === 'custom') {
      // Clear frequency-related amount when switching to custom
      if (selectedFrequency) {
        setPayoutAmount('0');
      }
    } else if (activeTab === 'frequency') {
      // Clear custom dates amount when switching to frequency
      if (customDates.length > 0) {
        setPayoutAmount('0');
      }
    }
  }, [activeTab]);

  const handleFrequencySelect = (frequency: string) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectedFrequency(frequency);
    setShowFrequencyDropdown(false);
  };

  const handleDurationSelect = (duration: DurationOption) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    
    isUpdatingDurationRef.current = true;
    setSelectedDuration(duration);
    setNumberOfPayouts(duration.value);
    
    if (totalAmount && totalAmount !== '0') {
      calculatePayoutAmount(totalAmount, duration.value, selectedFrequency || undefined);
    }
    
    setShowDurationPicker(false);
    
    setTimeout(() => {
      isUpdatingDurationRef.current = false;
    }, 100);
  };

  const handleTimeSelect = (hour: number, minute: number) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };

  const handleDayOfWeekSelect = (dayValue: number) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectedDayOfWeek(dayValue);
    setShowDayOfWeekPicker(false);
  };

  const getTimeDisplay = () => {
    const hourStr = selectedHour.toString().padStart(2, '0');
    const minuteStr = selectedMinute.toString().padStart(2, '0');
    const period = selectedHour >= 12 ? 'PM' : 'AM';
    const displayHour = selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour;
    return `${displayHour.toString().padStart(2, '0')}:${minuteStr} ${period}`;
  };

  // Format "HH:mm" for custom date time display (e.g. "12:00" -> "12:00 PM")
  const formatTimeForDisplay = (timeStr: string) => {
    const [h, m] = (timeStr || '12:00').split(':').map(Number);
    const hour = isNaN(h) ? 12 : h % 24;
    const minute = isNaN(m) ? 0 : m % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Parse "HH:mm" to { hour, minute } for TimePicker
  const parseTimeToHourMinute = (timeStr: string) => {
    const [h, m] = (timeStr || '12:00').split(':').map(Number);
    return { hour: isNaN(h) ? 12 : h % 24, minute: isNaN(m) ? 0 : m % 60 };
  };

  const handleCustomDateTimeSelect = (hour: number, minute: number) => {
    if (timePickerForDate) {
      const h = hour.toString().padStart(2, '0');
      const min = minute.toString().padStart(2, '0');
      setDateTimes(prev => ({ ...prev, [timePickerForDate]: `${h}:${min}` }));
      setTimePickerForDate(null);
    }
  };

  const handleBulkTimeSelect = (hour: number, minute: number) => {
    const h = hour.toString().padStart(2, '0');
    const min = minute.toString().padStart(2, '0');
    const chosenTime = `${h}:${min}`;
    setDateTimes(prev => {
      const next = { ...prev };
      customDates.forEach(d => { next[d] = chosenTime; });
      return next;
    });
    setShowBulkTimePicker(false);
  };

  // Bulk time label: single time when all same, else "Mixed"
  const bulkTimeDisplay = (() => {
    if (customDates.length === 0) return { label: '12:00 PM', isMixed: false, initialTime: '12:00' as string };
    const times = customDates.map(d => dateTimes[d] || '12:00');
    const first = times[0];
    const allSame = times.every(t => t === first);
    return {
      label: allSame ? formatTimeForDisplay(first) : 'Mixed',
      isMixed: !allSame,
      initialTime: allSame ? first : '12:00',
    };
  })();

  const getDayOfWeekName = () => {
    if (selectedDayOfWeek === null) return 'Select Day';
    return DAYS_OF_WEEK.find(day => day.value === selectedDayOfWeek)?.label || 'Select Day';
  };

  const getSelectedFrequencyLabel = () => {
    if (selectedFrequency === 'custom') {
      return 'Select dates';
    }
    const option = FREQUENCY_OPTIONS.find(opt => opt.value === selectedFrequency);
    return option?.label || 'Select payment frequency';
  };

  // Initialize custom dates from params
  useEffect(() => {
    if (params.customDates) {
      try {
        const dates = JSON.parse(params.customDates as string);
        if (Array.isArray(dates)) {
          setCustomDates(dates);
        }
      } catch (e) {
        console.error('Error parsing custom dates:', e);
      }
    }
  }, [params.customDates]);

  // Calculate fees and net amount for custom dates
  useEffect(() => {
    if (activeTab === 'custom' && totalAmount && totalAmount !== '0') {
      const calculateFees = async () => {
        try {
          const feePercentage = await fetchFeePercentage('custom');
          const numericTotal = parseFloat(totalAmount.replace(/,/g, ''));
          const calculatedFee = numericTotal * (feePercentage / 100);
          const calculatedNet = numericTotal - calculatedFee;
          setFeeAmount(calculatedFee);
          setNetAmount(calculatedNet);
          
          // If equal split, distribute net amount equally
          if (isEqualSplit && customDates.length > 0) {
            const amountPerDate = calculatedNet / customDates.length;
            const roundedAmount = Math.floor(amountPerDate * 100) / 100;
            const newDateAmounts: Record<string, string> = {};
            customDates.forEach(date => {
              newDateAmounts[date] = roundedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            });
            setDateAmounts(newDateAmounts);
          }
        } catch (error) {
          console.error('Error calculating fees:', error);
        }
      };
      calculateFees();
    } else if (activeTab === 'custom' && (!totalAmount || totalAmount === '0')) {
      setDateAmounts({});
      setNetAmount(0);
      setFeeAmount(0);
    }
  }, [activeTab, totalAmount, customDates, isEqualSplit, fetchFeePercentage]);

  const handleSelectDates = () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: string) => {
    if (customDates.includes(date)) {
      // Remove date and its amount and time
      setCustomDates(customDates.filter(d => d !== date));
      setDateAmounts(prev => {
        const newAmounts = { ...prev };
        delete newAmounts[date];
        return newAmounts;
      });
      setDateTimes(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    } else {
      if (customDates.length < 7) {
        const newDates = [...customDates, date].sort((a, b) => {
          return new Date(a).getTime() - new Date(b).getTime();
        });
        setCustomDates(newDates);
        setDateTimes(prev => ({ ...prev, [date]: '12:00' }));
        // If equal split, add amount for new date
        if (isEqualSplit && netAmount > 0 && newDates.length > 0) {
          const amountPerDate = netAmount / newDates.length;
          const roundedAmount = Math.floor(amountPerDate * 100) / 100;
          setDateAmounts(prev => {
            const updated = { ...prev };
            newDates.forEach(d => {
              if (!updated[d]) {
                updated[d] = roundedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
              }
            });
            return updated;
          });
        }
      }
    }
  };

  const handleDateAmountChange = (date: string, amount: string) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setIsEqualSplit(false);
    
    // Only allow numbers and decimal point
    let filteredAmount = amount.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = filteredAmount.split('.');
    if (parts.length > 2) {
      filteredAmount = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (filteredAmount.includes('.')) {
      const [integerPart, decimalPart] = filteredAmount.split('.');
      if (decimalPart && decimalPart.length > 2) {
        filteredAmount = integerPart + '.' + decimalPart.substring(0, 2);
      }
    }
    
    setDateAmounts(prev => ({
      ...prev,
      [date]: filteredAmount
    }));
  };

  const handleEqualSplitToggle = () => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setIsEqualSplit(!isEqualSplit);
    if (!isEqualSplit && customDates.length > 0 && netAmount > 0) {
      // Recalculate equal split
      const amountPerDate = netAmount / customDates.length;
      const roundedAmount = Math.floor(amountPerDate * 100) / 100;
      const newDateAmounts: Record<string, string> = {};
      customDates.forEach(date => {
        newDateAmounts[date] = roundedAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      });
      setDateAmounts(newDateAmounts);
    }
  };

  const handleRemoveDateFromAmountRow = (date: string) => {
    if (Platform.OS !== 'web') haptics.selection();
    if (customDates.length <= 1) return;
    const remainingDates = customDates.filter(d => d !== date);
    setCustomDates(remainingDates);
    setDateAmounts(prev => {
      const next = { ...prev };
      delete next[date];
      if (isEqualSplit && remainingDates.length > 0 && netAmount > 0) {
        const amountPerDate = netAmount / remainingDates.length;
        const roundedAmount = Math.floor(amountPerDate * 100) / 100;
        remainingDates.forEach(d => {
          next[d] = roundedAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        });
      }
      return next;
    });
    setDateTimes(prev => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  // Calculate total allocated and remainder
  const calculateAllocatedAndRemainder = () => {
    let totalAllocated = 0;
    customDates.forEach(date => {
      const amountStr = dateAmounts[date] || '0';
      const numericAmount = parseFloat(amountStr.replace(/,/g, ''));
      if (!isNaN(numericAmount)) {
        totalAllocated += numericAmount;
      }
    });
    const remainder = netAmount - totalAllocated;
    return { totalAllocated, remainder };
  };

  const handleContinue = () => {
    // For custom tab, validate dates are selected
    if (activeTab === 'custom') {
      if (customDates.length === 0) {
        if (Platform.OS !== 'web') {
          haptics.error();
        }
        return;
      }
      
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      // Calculate average payout amount for display (used in review screen)
      const { totalAllocated } = calculateAllocatedAndRemainder();
      const averagePayoutAmount = customDates.length > 0 
        ? (totalAllocated / customDates.length).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : '0';
      
      router.push({
        pathname: '/create-payout/destination',
        params: {
          totalAmount: params.totalAmount || totalAmount || '',
          frequency: 'custom',
          payoutAmount: averagePayoutAmount,
          duration: customDates.length.toString(),
          startDate: customDates[0] || '',
          bankName: params.bankName || '',
          accountNumber: params.accountNumber || '',
          accountName: params.accountName || '',
          bankAccountId: params.bankAccountId || '',
          payoutAccountId: params.payoutAccountId || '',
          emergencyWithdrawal: 'true',
          customDates: JSON.stringify(customDates),
          customDateAmounts: JSON.stringify(dateAmounts), // Pass individual amounts
          customDateTimes: JSON.stringify(dateTimes),
          dayOfWeek: '',
          payoutHour: selectedHour.toString(),
          payoutMinute: selectedMinute.toString(),
          purpose: params.purpose || '',
          purposeOther: params.purposeOther || '',
        }
      });
      return;
    }

    // Validate frequency is selected
    if (!selectedFrequency) {
      return;
    }

    // Validate day of week for weekly_specific
    if (selectedFrequency === 'weekly_specific' && selectedDayOfWeek === null) {
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    // Validate duration is selected
    if (!selectedDuration) {
      return;
    }

    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    // Calculate start date
    let startDate: string;
    if (selectedFrequency === 'weekly_specific' && typeof selectedDayOfWeek === 'number') {
      const today = new Date();
      const currentDay = today.getDay();
      let daysToAdd = (selectedDayOfWeek - currentDay + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 0;
      const firstPayoutDate = new Date(today);
      firstPayoutDate.setDate(today.getDate() + daysToAdd);
      startDate = firstPayoutDate.toISOString().split('T')[0];
    } else if (selectedFrequency === 'daily') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(selectedHour, selectedMinute, 0, 0);
      startDate = tomorrow.toISOString().split('T')[0];
    } else {
      startDate = new Date().toISOString().split('T')[0];
    }

    router.push({
      pathname: '/create-payout/destination',
      params: {
        totalAmount: params.totalAmount || '',
        frequency: selectedFrequency,
        payoutAmount: payoutAmount,
        duration: numberOfPayouts.toString(),
        startDate: startDate,
        bankName: params.bankName || '',
        accountNumber: params.accountNumber || '',
        accountName: params.accountName || '',
        bankAccountId: params.bankAccountId || '',
        payoutAccountId: params.payoutAccountId || '',
        emergencyWithdrawal: 'true', // Always enabled by default
        customDates: '',
        customDateTimes: '',
        dayOfWeek: selectedDayOfWeek !== null ? selectedDayOfWeek.toString() : '',
        payoutHour: selectedHour.toString(),
        payoutMinute: selectedMinute.toString(),
        purpose: params.purpose || '',
        purposeOther: params.purposeOther || '',
      }
    });
  };

  const isContinueDisabled = () => {
    if (activeTab === 'custom') {
      if (customDates.length === 0) return true;
      // Check if all dates have amounts and total doesn't exceed net amount
      const { totalAllocated, remainder } = calculateAllocatedAndRemainder();
      const allDatesHaveAmounts = customDates.every(date => {
        const amount = dateAmounts[date];
        return amount && !isNaN(parseFloat(amount.replace(/,/g, ''))) && parseFloat(amount.replace(/,/g, '')) > 0;
      });
      return !allDatesHaveAmounts || remainder < 0;
    }
    if (!selectedFrequency || !selectedDuration) {
      return true;
    }
    if (selectedFrequency === 'weekly_specific' && selectedDayOfWeek === null) {
      return true;
    }
    return false;
  };

  const styles = createStyles(colors, isSmallScreen, isDark);
  const durationOptions = selectedFrequency ? getDurationOptions(selectedFrequency, totalAmount) : [];

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
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.push('/(tabs)');
          }} 
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Choose a disbursement schedule</Text>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <Pressable
              style={[
                styles.tab,
                activeTab === 'frequency' && styles.activeTab
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setActiveTab('frequency');
              }}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'frequency' && styles.activeTabText
              ]}>
                Frequency
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                activeTab === 'custom' && styles.activeTab
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setActiveTab('custom');
              }}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'custom' && styles.activeTabText
              ]}>
                Custom
              </Text>
            </Pressable>
          </View>

          {/* Frequency Tab Content */}
          {activeTab === 'frequency' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <Text style={styles.sectionDescription}>
                  Select how often you want to get paid
                </Text>
                <Pressable
                  style={[
                    styles.selectButton,
                    selectedFrequency && selectedFrequency !== 'custom' && styles.selectButtonSelected
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    setShowFrequencyDropdown(!showFrequencyDropdown);
                  }}
                >
                  <Text style={[
                    styles.selectButtonText,
                    selectedFrequency && selectedFrequency !== 'custom' && styles.selectButtonTextSelected
                  ]}>
                    {getSelectedFrequencyLabel()}
                  </Text>
                  <ChevronDown size={20} color={selectedFrequency && selectedFrequency !== 'custom' ? '#1E3A8A' : colors.textSecondary} />
                </Pressable>

                {/* Frequency dropdown */}
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
                          <View style={styles.checkmark}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Show schedule fields when frequency is selected */}
              {selectedFrequency && selectedFrequency !== 'custom' && (
                <>
                  {/* Time Selector */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>What time?</Text>
                    <Pressable 
                      style={styles.selectButton}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          haptics.selection();
                        }
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={20} color={colors.textSecondary} />
                      <Text style={styles.selectButtonText}>{getTimeDisplay()}</Text>
                      <ChevronDown size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Day of Week Selector for Weekly */}
                  {selectedFrequency === 'weekly_specific' && (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Select Day of Week</Text>
                      <Pressable 
                        style={styles.selectButton}
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            haptics.selection();
                          }
                          setShowDayOfWeekPicker(!showDayOfWeekPicker);
                        }}
                      >
                        <Text style={styles.selectButtonText}>
                          {selectedDayOfWeek !== null ? getDayOfWeekName() : 'Select a day'}
                        </Text>
                        <ChevronDown size={20} color={colors.textSecondary} />
                      </Pressable>
                      
                      {showDayOfWeekPicker && (
                        <View style={styles.dropdownContainer}>
                          {DAYS_OF_WEEK.map((day) => (
                            <Pressable
                              key={day.value}
                              style={[
                                styles.dropdownOption,
                                selectedDayOfWeek === day.value && styles.dropdownOptionSelected
                              ]}
                              onPress={() => handleDayOfWeekSelect(day.value)}
                            >
                              <Text style={[
                                styles.dropdownOptionText,
                                selectedDayOfWeek === day.value && styles.dropdownOptionTextSelected
                              ]}>
                                {day.label}
                              </Text>
                              {selectedDayOfWeek === day.value && (
                                <View style={styles.checkmark}>
                                  <Text style={styles.checkmarkText}>✓</Text>
                                </View>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Duration Selector */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>How long?</Text>
                    <Pressable 
                      style={styles.selectButton}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          haptics.selection();
                        }
                        setShowDurationPicker(!showDurationPicker);
                      }}
                    >
                      <Text style={styles.selectButtonText}>
                        {selectedDuration ? `${selectedDuration.label} - ${selectedDuration.description}` : 'Select duration'}
                      </Text>
                      <ChevronDown size={20} color={colors.textSecondary} />
                    </Pressable>
                    
                    {showDurationPicker && (
                      <View style={styles.dropdownContainer}>
                        {durationOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            style={[
                              styles.dropdownOption,
                              selectedDuration?.value === option.value && styles.dropdownOptionSelected
                            ]}
                            onPress={() => handleDurationSelect(option)}
                          >
                            <View style={styles.durationOptionContent}>
                              <Text style={[
                                styles.dropdownOptionText,
                                selectedDuration?.value === option.value && styles.dropdownOptionTextSelected
                              ]}>
                                {option.label}
                              </Text>
                              <Text style={styles.durationDescription}>{option.description}</Text>
                            </View>
                            {selectedDuration?.value === option.value && (
                              <View style={styles.checkmark}>
                                <Text style={styles.checkmarkText}>✓</Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Amount per Duration - Only show for frequency tab */}
                  {activeTab === 'frequency' && selectedDuration && payoutAmount !== '0' && (
                    <View style={styles.amountSection}>
                      <Text style={styles.amountLabel}>Amount per payout</Text>
                      <Text style={styles.amountValue}>₦{payoutAmount}</Text>
                      <Text style={styles.amountDescription}>
                        {numberOfPayouts} {selectedFrequency === 'daily' ? 'daily' : 
                         selectedFrequency === 'weekly_specific' ? 'weekly' :
                         selectedFrequency === 'biweekly' ? 'bi-weekly' :
                         selectedFrequency === 'end_of_month' ? 'monthly' :
                         selectedFrequency === 'quarterly' ? 'quarterly' :
                         selectedFrequency === 'biannual' ? 'bi-annual' :
                         'annual'} payment{numberOfPayouts !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Custom Dates Tab Content */}
          {activeTab === 'custom' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <Text style={styles.sectionDescription}>
                  Select up to 7 dates you want to get paid
                </Text>
                <Pressable
                  style={[styles.selectButton, styles.selectButtonSelected]}
                  onPress={handleSelectDates}
                >
                  <CalendarDays size={20} color={colors.text} />
                  <Text style={[styles.selectButtonText, styles.selectButtonTextSelected]}>
                    {customDates.length > 0 ? `${customDates.length} date${customDates.length !== 1 ? 's' : ''} selected` : 'Select dates'}
                  </Text>
                  <ChevronRight size={20} color={colors.text} />
                </Pressable>
                {/* {customDates.length > 0 && (
                  <View style={styles.selectedDatesPreview}>
                    {customDates.slice(0, 3).map((date, index) => {
                      const dateObj = new Date(date);
                      const formatted = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
                      return (
                        <View key={index} style={styles.dateChip}>
                          <Text style={styles.dateChipText}>{formatted}</Text>
                          <Pressable
                            onPress={() => handleDateSelect(date)}
                            style={styles.removeChipButton}
                          >
                            <X size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
                      );
                    })}
                    {customDates.length > 3 && (
                      <Text style={styles.moreDatesText}>+{customDates.length - 3} more</Text>
                    )}
                  </View>
                )} */}
              </View>

              {/* Amount Breakdown for Custom Dates - Only show for custom tab */}
              {activeTab === 'custom' && customDates.length > 0 && totalAmount && totalAmount !== '0' && (
                <View style={styles.amountSection}>
                  
                  
                  {/* Show fee and net amount info */}
                  {/* {feeAmount > 0 && (
                    <View style={styles.feeInfo}>
                      <Text style={styles.feeInfoText}>
                        Fee: ₦{feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.feeInfoText}>
                        Net amount: ₦{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )} */}

                  {/* Time for all payouts - bulk selector */}
                  <View style={styles.bulkTimeRow}>
                    <Text style={styles.bulkTimeLabel}>Time for all payouts</Text>
                    <Pressable
                      style={[styles.bulkTimeButton, bulkTimeDisplay.isMixed && styles.bulkTimeButtonMixed]}
                      onPress={() => {
                        if (Platform.OS !== 'web') haptics.selection();
                        setShowBulkTimePicker(true);
                      }}
                    >
                      <Clock size={16} color={bulkTimeDisplay.isMixed ? colors.textSecondary : colors.primary} />
                      <Text style={[styles.bulkTimeButtonText, { color: bulkTimeDisplay.isMixed ? colors.textSecondary : colors.primary }]}>
                        {bulkTimeDisplay.label}
                      </Text>
                      <ChevronDown size={16} color={bulkTimeDisplay.isMixed ? colors.textSecondary : colors.primary} />
                    </Pressable>
                  </View>
                  {bulkTimeDisplay.isMixed && (
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== 'web') haptics.selection();
                        setDateTimes(prev => {
                          const next = { ...prev };
                          customDates.forEach(d => { next[d] = '12:00'; });
                          return next;
                        });
                      }}
                      style={({ pressed }) => [styles.bulkTimeHint, pressed && styles.bulkTimeHintPressed]}
                    >
                      <Text style={styles.bulkTimeHintText}>Reset to default time</Text>
                    </Pressable>
                  )}
                  <View style={styles.amountHeader}>
                    <Text style={styles.amountLabel}>Customize amount & payout time</Text>
                  </View>

                  {/* Individual date amounts - left: date + time, right: amount + remaining */}
                  <View style={styles.datesAmountsContainer}>
                    {customDates.map((date, index) => {
                      const formattedDate = formatDateForDisplay(date);
                      const amountValue = dateAmounts[date] || '';
                      const allocatedUpToThis = customDates.slice(0, index + 1).reduce((sum, d) => {
                        const amt = parseFloat((dateAmounts[d] || '0').replace(/,/g, ''));
                        return sum + (isNaN(amt) ? 0 : amt);
                      }, 0);
                      const remainderUpToThis = netAmount - allocatedUpToThis;
                      const timeStr = dateTimes[date] || '12:00';
                      return (
                        <View key={date} style={styles.dateAmountRowWrapper}>
                          {customDates.length > 1 && (
                            <Pressable
                              style={styles.dateAmountRowRemove}
                              onPress={() => handleRemoveDateFromAmountRow(date)}
                              hitSlop={8}
                            >
                              <X size={18} color={colors.textSecondary} />
                            </Pressable>
                          )}
                          <View style={styles.dateAmountRow}>
                            <View style={styles.amountColumn}>
                              <View style={styles.dateAmountInputContainer}>
                                <Text style={styles.currencySymbolSmall}>₦</Text>
                                <TextInput
                                  style={styles.dateAmountInput}
                                  keyboardType="numeric"
                                  value={amountValue}
                                  onChangeText={(text) => handleDateAmountChange(date, text)}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.textTertiary}
                                />
                              </View>
                              {/* {remainderUpToThis < 0 ? (
                                <Text style={styles.dateAmountWarning}>Exceeds available</Text>
                              ) : remainderUpToThis >= 0 && remainderUpToThis < netAmount ? (
                                <Text style={styles.dateRemainderText}>
                                  Remaining: ₦{remainderUpToThis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                              ) : null} */}
                            </View>
                            <View style={styles.dateTimeColumn}>
                              <Text style={styles.dateAmountLabel}>{formattedDate}</Text>
                              <Pressable
                                style={styles.dateTimeChip}
                                onPress={() => {
                                  if (Platform.OS !== 'web') haptics.selection();
                                  setTimePickerForDate(date);
                                }}
                              >
                                <Clock size={14} color={colors.primary} />
                                <Text style={[styles.dateTimeChipText, { color: colors.primary }]}>
                                  {formatTimeForDisplay(timeStr)}
                                </Text>
                                <ChevronDown size={14} color={colors.primary} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Total summary */}
                  {(() => {
                    const { totalAllocated, remainder } = calculateAllocatedAndRemainder();
                    return (
                      <View style={styles.totalSummary}>
                        <View style={styles.totalSummaryRow}>
                          <Text style={styles.totalSummaryLabel}>Total allocated:</Text>
                          <Text style={styles.totalSummaryValue}>
                            ₦{totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        {remainder !== 0 && (
                          <View style={styles.totalSummaryRow}>
                            <Text style={styles.totalSummaryLabel}>Remainder:</Text>
                            <Text style={[styles.totalSummaryValue, remainder > 0 ? styles.remainderPositive : styles.remainderNegative]}>
                              ₦{Math.abs(remainder).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        )}
                        {remainder > 0 && (
                          <Text style={styles.remainderNote}>
                            Any remainder will be returned to your available balance.
                          </Text>
                        )}
                        {remainder < 0 && (
                          <Pressable
                            onPress={() => {
                              haptics.selection();
                              router.push({
                                pathname: '/create-payout/amount',
                                params: {
                                  totalAmount: totalAmount,
                                  frequency: params.frequency || '',
                                  payoutAmount: params.payoutAmount || '',
                                  duration: params.duration || '',
                                  startDate: params.startDate || '',
                                  bankName: params.bankName || '',
                                  accountNumber: params.accountNumber || '',
                                  accountName: params.accountName || '',
                                  bankAccountId: params.bankAccountId || '',
                                  payoutAccountId: params.payoutAccountId || '',
                                  emergencyWithdrawal: params.emergencyWithdrawal || 'false',
                                  customDates: params.customDates || '',
                                  customDateAmounts: params.customDateAmounts || '',
                                  customDateTimes: params.customDateTimes || '',
                                  dayOfWeek: params.dayOfWeek || '',
                                  payoutHour: params.payoutHour || '',
                                  payoutMinute: params.payoutMinute || '',
                                  purpose: params.purpose || '',
                                  purposeOther: params.purposeOther || '',
                                }
                              });
                            }}
                          >
                            <Text style={styles.remainderWarning}>
                              Total allocated exceeds available amount. Please adjust amounts here.
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })()}

                  {/* Split equally - only when amount per date has been changed */}
                  {!isEqualSplit && (
                    <Pressable
                      style={styles.splitToggleBelowTotal}
                      onPress={handleEqualSplitToggle}
                    >
                      <Text style={styles.splitToggleText}>Split equally</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={isContinueDisabled()}
        hapticType="medium"
      />

      <TimePicker
        isVisible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onSelect={handleTimeSelect}
        selectedHour={selectedHour}
        selectedMinute={selectedMinute}
      />

      {timePickerForDate !== null && (
        <TimePicker
          isVisible={true}
          onClose={() => setTimePickerForDate(null)}
          onSelect={handleCustomDateTimeSelect}
          selectedHour={parseTimeToHourMinute(dateTimes[timePickerForDate] || '12:00').hour}
          selectedMinute={parseTimeToHourMinute(dateTimes[timePickerForDate] || '12:00').minute}
        />
      )}

      {showBulkTimePicker && (
        <TimePicker
          isVisible={true}
          onClose={() => setShowBulkTimePicker(false)}
          onSelect={handleBulkTimeSelect}
          selectedHour={parseTimeToHourMinute(bulkTimeDisplay.initialTime ?? '12:00').hour}
          selectedMinute={parseTimeToHourMinute(bulkTimeDisplay.initialTime ?? '12:00').minute}
        />
      )}

      <DatePicker
        isVisible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        selectedDates={customDates}
      />

    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean, isDark: boolean) => StyleSheet.create({
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
    fontSize: 18,
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
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 2,
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
    paddingBottom: 100,
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  selectButtonSelected: {
    backgroundColor: colors.accentBackground,
    borderColor: colors.primary,
  },
  selectButtonText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  selectButtonTextSelected: {
    color: colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600',
  },
  tabContent: {
    marginTop: 0,
  },
  dropdownContainer: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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
    backgroundColor: colors.backgroundTertiary,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: '#1E3A8A',
  },
  durationOptionContent: {
    flex: 1,
  },
  durationDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  amountSection: {
    backgroundColor: colors.accentBackground,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  amountDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  splitToggle: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitToggleBelowTotal: {
    marginTop: 12,
    alignSelf: 'flex-start',
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
    color: colors.text,
    fontWeight: '600',
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
  modalCalculationInfo: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  modalCalculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCalculationLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modalCalculationValue: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    fontWeight: '600',
  },
  modalRemainderNote: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalWarningNote: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.error || '#EF4444',
    fontWeight: '500',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 20,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
  },
  feeInfo: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  feeInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bulkTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bulkTimeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  bulkTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  bulkTimeButtonMixed: {
    borderColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  bulkTimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkTimeHint: {
    marginBottom: 12,
    alignSelf: 'flex-end',
  },
  bulkTimeHintPressed: {
    opacity: 0.7,
  },
  bulkTimeHintText: {
    fontSize: 12,
    textDecorationLine: 'underline',
    color: colors.primary,
    fontWeight: '500',
  },
  datesAmountsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  dateAmountRowWrapper: {
    position: 'relative',
  },
  dateAmountRowRemove: {
    position: 'absolute',
    top: -5,
    right: -10,
    zIndex: 1,
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
  },
  dateAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  dateTimeColumn: {
    flex: 0,
    minWidth: 100,
    gap: 6,
    alignItems: 'flex-end',
  },
  dateAmountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  dateTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  dateTimeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountColumn: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-start',
  },
  dateAmountWarning: {
    fontSize: 12,
    color: colors.error || '#EF4444',
    fontWeight: '500',
  },
  dateAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 160,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbolSmall: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 8,
  },
  dateAmountInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  dateRemainderText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  totalSummary: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  totalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalSummaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  totalSummaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  remainderPositive: {
    color: '#22C55E',
  },
  remainderNegative: {
    color: colors.error || '#EF4444',
  },
  remainderNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  remainderWarning: {
    fontSize: 12,
    color: colors.error || '#EF4444',
    fontWeight: '500',
    marginTop: 4,
  },
  selectedDatesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  removeChipButton: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreDatesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    alignSelf: 'center',
  },
});

const createTimePickerStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 20,
  },
  timeSection: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  timeScroll: {
    maxHeight: 200,
    width: '100%',
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedTimeOption: {
    backgroundColor: colors.accentBackground,
  },
  timeOptionText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '500',
  },
  selectedTimeOptionText: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const createDatePickerStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  calendarHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  calendar: {
    padding: 20,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
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
    backgroundColor: '#1E3A8A',
  },
  todayDay: {
    backgroundColor: colors.accentBackground,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayDayText: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  disabledDayText: {
    color: colors.textTertiary,
  },
  selectedDatesContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 150,
  },
  selectedDatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  selectedDatesList: {
    flexDirection: 'row',
  },
  selectedDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 8,
  },
  selectedDateText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  removeDateButton: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#1E3A8A',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedDatesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  removeChipButton: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreDatesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    alignSelf: 'center',
  },
});
