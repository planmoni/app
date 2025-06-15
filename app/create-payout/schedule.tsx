import { View, Text, StyleSheet, Pressable, TextInput, Modal, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, ChevronRight, Clock, Info, Plus, ChevronLeft, ChevronDown, ArrowLeft } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { ScrollView } from 'react-native-gesture-handler';

type DatePickerProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDates: string[];
};

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
  const [selectedSchedule, setSelectedSchedule] = useState('monthly');
  const [totalAmount, setTotalAmount] = useState('0');
  const [payoutAmount, setPayoutAmount] = useState('0');
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [numberOfPayouts, setNumberOfPayouts] = useState(12);
  const [isYearlySplit, setIsYearlySplit] = useState(true);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const { width } = useWindowDimensions();

  // Responsive styles based on screen width
  const isSmallScreen = width < 380;

  useEffect(() => {
    if (params.totalAmount) {
      const amount = params.totalAmount as string;
      setTotalAmount(amount);
      if (isYearlySplit) {
        calculatePayoutAmount(amount, 12);
      }
    }
  }, [params.totalAmount]);

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
      setNumberOfPayouts(12);
      calculatePayoutAmount(totalAmount, 12);
      setCustomAmount('');
    }
  };

  const getPayoutLabel = () => {
    switch (selectedSchedule) {
      case 'monthly':
        return 'Amount per Month';
      case 'biweekly':
        return 'Amount per Two Weeks';
      case 'weekly':
        return 'Amount per Week';
      case 'custom':
        return `Amount per Payout (${customDates.length} dates)`;
      default:
        return 'Amount per Payout';
    }
  };

  const handleScheduleSelect = (schedule: string) => {
    setSelectedSchedule(schedule);
    let newNumberOfPayouts = numberOfPayouts;

    switch (schedule) {
      case 'monthly':
        newNumberOfPayouts = 12;
        break;
      case 'biweekly':
        newNumberOfPayouts = 24;
        break;
      case 'weekly':
        newNumberOfPayouts = 48;
        break;
      case 'custom':
        newNumberOfPayouts = customDates.length || 1;
        break;
    }

    setNumberOfPayouts(newNumberOfPayouts);
    if (isYearlySplit) {
      calculatePayoutAmount(totalAmount, newNumberOfPayouts);
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

  // Calculate the next payout date based on frequency
  const calculateNextPayoutDate = (frequency: string): string => {
    const today = new Date();
    let nextPayoutDate = new Date(today);
    
    switch (frequency) {
      case 'weekly':
        nextPayoutDate.setDate(today.getDate() + 7);
        break;
      case 'biweekly':
        nextPayoutDate.setDate(today.getDate() + 14);
        break;
      case 'monthly':
        nextPayoutDate.setMonth(today.getMonth() + 1);
        break;
      default:
        // For custom, use the first custom date or today
        if (customDates.length > 0) {
          return customDates[0];
        }
    }
    
    return formatDate(nextPayoutDate);
  };
  
  // Format date to YYYY-MM-DD for API and ISO string handling
  const formatDateForAPI = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };
  
  // Format date for display (Month Day, Year)
  const formatDate = (date: Date): string => {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };
  
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleContinue = () => {
    // Calculate the next payout date based on frequency
    const startDate = customDates.length > 0 
      ? formatDateForAPI(customDates[0]) 
      : formatDateForAPI(calculateNextPayoutDate(selectedSchedule));
    
    router.push({
      pathname: '/create-payout/destination',
      params: {
        totalAmount,
        frequency: selectedSchedule,
        payoutAmount,
        duration: numberOfPayouts.toString(),
        startDate,
        customDates: JSON.stringify(customDates)
      }
    });
  };

  const styles = createStyles(colors, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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

          <View style={styles.scheduleOptions}>
            <Pressable 
              style={[
                styles.scheduleOption,
                selectedSchedule === 'monthly' && styles.selectedOption
              ]}
              onPress={() => handleScheduleSelect('monthly')}
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
                selectedSchedule === 'biweekly' && styles.selectedOption
              ]}
              onPress={() => handleScheduleSelect('biweekly')}
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
                selectedSchedule === 'weekly' && styles.selectedOption
              ]}
              onPress={() => handleScheduleSelect('weekly')}
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
                selectedSchedule === 'custom' && styles.selectedOption
              ]}
              onPress={() => handleScheduleSelect('custom')}
            >
              <Calendar size={isSmallScreen ? 18 : 20} color={selectedSchedule === 'custom' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.optionText,
                selectedSchedule === 'custom' && styles.selectedOptionText
              ]}>Custom Dates</Text>
            </Pressable>
          </View>

          {selectedSchedule === 'custom' && (
            <View style={styles.customDatesSection}>
              <Text style={styles.customDatesTitle}>Selected Dates</Text>
              
              {customDates.map((date, index) => (
                <View key={index} style={styles.dateItem}>
                  <View style={styles.dateInfo}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text style={styles.dateText}>{date}</Text>
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
                  1 Year Split
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
        disabled={selectedSchedule === 'custom' && customDates.length === 0}
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
    fontSize: isSmallScreen ? 20 : 24,
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
    gap: 12,
    marginBottom: 24,
    flexDirection: isSmallScreen ? 'column' : 'row',
    flexWrap: isSmallScreen ? 'nowrap' : 'wrap',
  },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flex: isSmallScreen ? 0 : 1,
    minWidth: isSmallScreen ? '100%' : '48%',
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
    borderColor: '#1E3A8A',
  },
  optionText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#1E3A8A',
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