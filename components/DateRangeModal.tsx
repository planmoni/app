import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import Button from '@/components/Button';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface DateRangeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DateRangeModal({ 
  isVisible, 
  onClose, 
  onSelect,
  initialStartDate,
  initialEndDate,
}: DateRangeModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(initialStartDate || null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(initialEndDate || null);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateSelect = (date: Date) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    } else {
      if (date < selectedStartDate) {
        setSelectedStartDate(date);
        setSelectedEndDate(null);
      } else {
        setSelectedEndDate(date);
      }
    }
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate || !selectedEndDate) return false;
    return date >= selectedStartDate && date <= selectedEndDate;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedStartDate) return false;
    if (!selectedEndDate) return date.getTime() === selectedStartDate.getTime();
    return date.getTime() === selectedStartDate.getTime() || date.getTime() === selectedEndDate.getTime();
  };

  const handleApply = () => {
    if (selectedStartDate && selectedEndDate) {
      onSelect(selectedStartDate, selectedEndDate);
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  const handleClose = () => {
    handleClear(); // Reset dates when closing
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>Select Date Range</Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.selectedRange}>
              <Text style={styles.rangeText}>
                {selectedStartDate ? formatDate(selectedStartDate) : 'Start date'} 
                {' - '} 
                {selectedEndDate ? formatDate(selectedEndDate) : 'End date'}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={handlePrevMonth} style={styles.navigationButton}>
                <ChevronLeft size={isSmallScreen ? 20 : 24} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.monthYear}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
                <ChevronRight size={isSmallScreen ? 20 : 24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.weekDays}>
              {DAYS.map(day => (
                <Text key={day} style={styles.weekDay}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                <View key={`empty-${index}`} style={styles.emptyCell} />
              ))}
              
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                const isSelected = isDateSelected(date);
                const inRange = isDateInRange(date);

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDay,
                      inRange && styles.inRangeDay,
                    ]}
                    onPress={() => handleDateSelect(date)}
                  >
                    <Text style={[
                      styles.dayText,
                      (isSelected || inRange) && styles.selectedDayText,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Clear"
              onPress={handleClear}
              variant="outline"
              style={styles.clearButton}
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 12 : 16,
  },
  title: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRange: {
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    maxHeight: '60%',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
    paddingBottom: 16,
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
  monthYear: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekDay: {
    width: isSmallScreen ? 32 : 40,
    textAlign: 'center',
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyCell: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
  },
  dayCell: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: isSmallScreen ? 16 : 20,
    margin: 2,
  },
  selectedDay: {
    backgroundColor: colors.primary,
  },
  inRangeDay: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
  },
  dayText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: isSmallScreen ? 16 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearButton: {
    flex: 1,
    borderColor: colors.border,
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});