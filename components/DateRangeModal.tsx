import { Modal, View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

interface DateRangeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (startDate: Date | null, endDate: Date | null) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Quick select presets
const QUICK_SELECTS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 6 months', days: 180 },
];

export default function DateRangeModal({ 
  isVisible, 
  onClose, 
  onSelect,
  initialStartDate,
  initialEndDate,
}: DateRangeModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(initialStartDate || null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(initialEndDate || null);

  // Sync state with props when modal opens
  useEffect(() => {
    if (isVisible) {
      if (initialStartDate) {
        setSelectedStartDate(initialStartDate);
        setCurrentMonth(new Date(initialStartDate.getFullYear(), initialStartDate.getMonth(), 1));
      } else {
        setSelectedStartDate(null);
        setCurrentMonth(new Date());
      }
      if (initialEndDate) {
        setSelectedEndDate(initialEndDate);
      } else {
        setSelectedEndDate(null);
      }
    }
  }, [isVisible, initialStartDate, initialEndDate]);

  // Get today's date (normalized to start of day)
  const getToday = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Normalize date to start of day for comparison
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Check if date is in the future
  const isFutureDate = (date: Date): boolean => {
    return normalizeDate(date) > getToday();
  };

  // Check if date is disabled (future date)
  const isDateDisabled = (date: Date): boolean => {
    return isFutureDate(date);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    setCurrentMonth(prevMonth);
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    // Don't allow navigating to future months
    const today = getToday();
    const nextMonthStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    if (normalizeDate(nextMonthStart) <= normalizeDate(today)) {
      setCurrentMonth(nextMonth);
      if (Platform.OS !== 'web') {
        haptics.lightImpact();
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }

    const normalizedDate = normalizeDate(date);

    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(normalizedDate);
      setSelectedEndDate(null);
    } else {
      const normalizedStart = normalizeDate(selectedStartDate);
      if (normalizedDate < normalizedStart) {
        setSelectedStartDate(normalizedDate);
        setSelectedEndDate(null);
      } else {
        setSelectedEndDate(normalizedDate);
      }
    }
  };

  const handleQuickSelect = (days: number) => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    const today = getToday();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    setSelectedStartDate(startDate);
    setSelectedEndDate(today);
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate || !selectedEndDate) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedStart = normalizeDate(selectedStartDate);
    const normalizedEnd = normalizeDate(selectedEndDate);
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedStartDate) return false;
    const normalizedDate = normalizeDate(date);
    const normalizedStart = normalizeDate(selectedStartDate);
    if (!selectedEndDate) {
      return normalizedDate.getTime() === normalizedStart.getTime();
    }
    const normalizedEnd = normalizeDate(selectedEndDate);
    return normalizedDate.getTime() === normalizedStart.getTime() || normalizedDate.getTime() === normalizedEnd.getTime();
  };

  const handleApply = () => {
    if (selectedStartDate && selectedEndDate) {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      onSelect(selectedStartDate, selectedEndDate);
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    // Reset the date range filter in parent component
    onSelect(null, null);
    onClose();
  };

  const handleClose = () => {
    // Reset to initial dates when closing
    setSelectedStartDate(initialStartDate || null);
    setSelectedEndDate(initialEndDate || null);
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if next month button should be disabled
  const isNextMonthDisabled = () => {
    const today = getToday();
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    return normalizeDate(nextMonth) > normalizeDate(today);
  };
  
  const styles = createStyles(colors, isDark, isSmallScreen);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.modal}>
          {/* Drag Indicator */}
          <View style={styles.dragIndicator} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>Select Date Range</Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            
            {/* Selected Range Display */}
            <View style={styles.selectedRangeContainer}>
              <View style={styles.dateDisplay}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <Text style={[styles.dateValue, !selectedStartDate && styles.datePlaceholder]}>
                  {selectedStartDate ? formatDate(selectedStartDate) : 'Not selected'}
                </Text>
              </View>
              <View style={styles.dateSeparator}>
                <Text style={styles.separatorText}>→</Text>
              </View>
              <View style={styles.dateDisplay}>
                <Text style={styles.dateLabel}>End Date</Text>
                <Text style={[styles.dateValue, !selectedEndDate && styles.datePlaceholder]}>
                  {selectedEndDate ? formatDate(selectedEndDate) : 'Not selected'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Quick Select Presets */}
            <View style={styles.quickSelectSection}>
              <Text style={styles.sectionTitle}>Quick Select</Text>
              <View style={styles.quickSelectGrid}>
                {QUICK_SELECTS.map((preset, index) => (
                  <Pressable
                    key={index}
                    style={styles.quickSelectButton}
                    onPress={() => handleQuickSelect(preset.days)}
                  >
                    <Text style={styles.quickSelectText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Calendar */}
            <View style={styles.calendarSection}>
              <View style={styles.calendarHeader}>
                <Pressable 
                  onPress={handlePrevMonth} 
                  style={styles.navigationButton}
                >
                  <ChevronLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
                </Pressable>
                <Text style={styles.monthYear}>
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </Text>
                <Pressable 
                  onPress={handleNextMonth} 
                  style={[styles.navigationButton, isNextMonthDisabled() && styles.navigationButtonDisabled]}
                  disabled={isNextMonthDisabled()}
                >
                  <ChevronRight 
                    size={isSmallScreen ? 20 : 24} 
                    color={isNextMonthDisabled() ? colors.textTertiary : colors.text} 
                  />
                </Pressable>
              </View>

              {/* Week Days Header */}
              <View style={styles.weekDays}>
                {DAYS.map(day => (
                  <Text key={day} style={styles.weekDay}>{day}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.daysGrid}>
                {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                  <View key={`empty-${index}`} style={styles.emptyCell} />
                ))}
                
                {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                  const normalizedDate = normalizeDate(date);
                  const today = getToday();
                  const isToday = normalizedDate.getTime() === today.getTime();
                  const isSelected = isDateSelected(date);
                  const inRange = isDateInRange(date);
                  const isDisabled = isDateDisabled(date);

                  return (
                    <Pressable
                      key={index}
                      style={[
                        styles.dayCell,
                        isToday && styles.todayCell,
                        isSelected && styles.selectedDay,
                        inRange && !isSelected && styles.inRangeDay,
                        isDisabled && styles.disabledDay,
                      ]}
                      onPress={() => handleDateSelect(date)}
                      disabled={isDisabled}
                    >
                      <Text style={[
                        styles.dayText,
                        isToday && !isSelected && styles.todayText,
                        (isSelected || inRange) && styles.selectedDayText,
                        isDisabled && styles.disabledDayText,
                      ]}>
                        {index + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title="Clear"
              onPress={handleClear}
              variant="outline"
              style={styles.clearButton}
              disabled={!selectedStartDate && !selectedEndDate}
            />
            <Button
              title="Apply"
              onPress={handleApply}
              style={styles.applyButton}
              disabled={!selectedStartDate || !selectedEndDate}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
      },
    }),
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 8,
    paddingBottom: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: isSmallScreen ? 18 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: isSmallScreen ? 12 : 16,
  },
  dateDisplay: {
    flex: 1,
  },
  dateLabel: {
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
  },
  datePlaceholder: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  dateSeparator: {
    paddingHorizontal: isSmallScreen ? 8 : 12,
  },
  separatorText: {
    fontSize: isSmallScreen ? 16 : 18,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    maxHeight: '60%',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
    paddingBottom: 16,
  },
  quickSelectSection: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: isSmallScreen ? 12 : 16,
  },
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectButton: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 8 : 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickSelectText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '500',
    color: colors.text,
  },
  calendarSection: {
    marginBottom: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 16 : 20,
  },
  navigationButton: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: isSmallScreen ? 18 : 20,
  },
  navigationButtonDisabled: {
    opacity: 0.4,
  },
  monthYear: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 8 : 12,
    paddingHorizontal: 4,
  },
  weekDay: {
    width: isSmallScreen ? 36 : 44,
    textAlign: 'center',
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyCell: {
    width: isSmallScreen ? 36 : 44,
    height: isSmallScreen ? 36 : 44,
  },
  dayCell: {
    width: isSmallScreen ? 36 : 44,
    height: isSmallScreen ? 36 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: isSmallScreen ? 18 : 22,
    marginVertical: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedDay: {
    backgroundColor: colors.primary,
  },
  inRangeDay: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '500',
    color: colors.text,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabledDayText: {
    color: colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: isSmallScreen ? 16 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearButton: {
    flex: 1,
  },
  applyButton: {
    flex: 1,
  },
});
