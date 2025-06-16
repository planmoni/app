import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import Button from '@/components/Button';

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

  return (
    <Modal
      visible={isVisible}
      transparent
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
                <X size={24} color="#64748B" />
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
                <ChevronLeft size={24} color="#64748B" />
              </Pressable>
              <Text style={styles.monthYear}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
                <ChevronRight size={24} color="#64748B" />
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    maxHeight: '90%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  selectedRange: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  navigationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekDay: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  emptyCell: {
    width: 40,
    height: 40,
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  selectedDay: {
    backgroundColor: '#1E3A8A',
  },
  inRangeDay: {
    backgroundColor: '#BFDBFE',
  },
  dayText: {
    fontSize: 14,
    color: '#1E293B',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  clearButton: {
    flex: 1,
    borderColor: '#E2E8F0',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
});