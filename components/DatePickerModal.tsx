// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import React, { useState } from 'react';
// import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
// import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
// import { useTheme } from '@/contexts/ThemeContext';
// import { useWindowDimensions } from 'react-native';
// 
// const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// const MONTHS = [
//   'January', 'February', 'March', 'April', 'May', 'June',
//   'July', 'August', 'September', 'October', 'November', 'December'
// ];
// 
// interface DatePickerModalProps {
//   visible: boolean;
//   selectedDate: Date | null;
//   currentMonth: Date;
//   showYearPicker: boolean;
//   showMonthPicker: boolean;
//   onClose: () => void;
//   onDateSelect: (date: Date) => void;
//   onDateConfirm: () => void;
//   onPrevMonth: () => void;
//   onNextMonth: () => void;
//   onPrevYear: () => void;
//   onNextYear: () => void;
//   onYearSelect: (year: number) => void;
//   onMonthSelect: (month: number) => void;
//   onShowYearPicker: (show: boolean) => void;
//   onShowMonthPicker: (show: boolean) => void;
// }
// 
// export default function DatePickerModal({
//   visible,
//   selectedDate,
//   currentMonth,
//   showYearPicker,
//   showMonthPicker,
//   onClose,
//   onDateSelect,
//   onDateConfirm,
//   onPrevMonth,
//   onNextMonth,
//   onPrevYear,
//   onNextYear,
//   onYearSelect,
//   onMonthSelect,
//   onShowYearPicker,
//   onShowMonthPicker,
// }: DatePickerModalProps) {
//   const { colors, isDark } = useTheme();
//   const { width, height } = useWindowDimensions();
//   const isSmallScreen = width < 380 || height < 700;
// 
//   const getDaysInMonth = (date: Date) => {
//     return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
//   };
// 
//   const getFirstDayOfMonth = (date: Date) => {
//     return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
//   };
// 
//   const isDateSelectable = (date: Date) => {
//     const today = new Date();
//     const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
//     const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
//     return date >= minDate && date <= maxDate;
//   };
// 
//   const getAvailableYears = () => {
//     const today = new Date();
//     const minYear = today.getFullYear() - 100;
//     const maxYear = today.getFullYear() - 18;
//     const years = [];
//     for (let year = maxYear; year >= minYear; year--) {
//       years.push(year);
//     }
//     return years;
//   };
// 
//   const daysInMonth = getDaysInMonth(currentMonth);
//   const firstDayOffset = getFirstDayOfMonth(currentMonth);
// 
//   const styles = StyleSheet.create({
//     modalOverlay: {
//       flex: 1,
//       backgroundColor: 'rgba(0, 0, 0, 0.5)',
//       justifyContent: 'center',
//       alignItems: 'center',
//       padding: 16,
//     },
//     datePickerModal: {
//       backgroundColor: colors.surface,
//       borderRadius: 16,
//       padding: isSmallScreen ? 16 : 24,
//       width: '100%',
//       maxWidth: 400,
//       maxHeight: '90%',
//       alignSelf: 'center',
//     },
//     datePickerHeader: {
//       flexDirection: 'row',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//       marginBottom: 16,
//     },
//     datePickerTitle: {
//       fontSize: isSmallScreen ? 18 : 20,
//       fontWeight: '600',
//       color: colors.text,
//     },
//     datePickerCloseButton: {
//       width: 32,
//       height: 32,
//       borderRadius: 16,
//       backgroundColor: colors.backgroundTertiary,
//       justifyContent: 'center',
//       alignItems: 'center',
//     },
//     calendarHeader: {
//       flexDirection: 'row',
//       alignItems: 'center',
//       justifyContent: 'space-between',
//       marginBottom: 16,
//       position: 'relative',
//     },
//     navigationButton: {
//       width: 40,
//       height: 40,
//       padding: 8,
//       backgroundColor: colors.backgroundTertiary,
//       borderRadius: 8,
//       justifyContent: 'center',
//       alignItems: 'center',
//       zIndex: 1,
//     },
//     monthYearContainer: {
//       position: 'absolute',
//       left: 0,
//       right: 0,
//       alignItems: 'center',
//       justifyContent: 'center',
//       zIndex: 0,
//       pointerEvents: 'box-none',
//     },
//     monthYearPressable: {
//       paddingVertical: 8,
//       paddingHorizontal: 16,
//       borderRadius: 8,
//     },
//     monthYearText: {
//       fontSize: isSmallScreen ? 14 : 16,
//       fontWeight: '500',
//       color: colors.text,
//     },
//     yearPickerContainer: {
//       maxHeight: 400,
//       marginBottom: 24,
//     },
//     yearPickerContent: {
//       paddingBottom: 8,
//     },
//     yearPickerGrid: {
//       flexDirection: 'row',
//       flexWrap: 'wrap',
//       justifyContent: 'flex-start',
//     },
//     yearItem: {
//       width: `${90/4}%`,
//       aspectRatio: 1.5,
//       justifyContent: 'center',
//       alignItems: 'center',
//       marginBottom: 8,
//       borderRadius: 20,
//       gap: 8,
//       marginRight: 8,
//       backgroundColor: colors.backgroundTertiary,
//     },
//     yearItemSelected: {
//       backgroundColor: colors.primary,
//     },
//     yearItemText: {
//       fontSize: isSmallScreen ? 13 : 14,
//       color: colors.text,
//       fontWeight: '500',
//     },
//     yearItemTextSelected: {
//       color: '#FFFFFF',
//       fontWeight: '600',
//     },
//     yearItemTextCurrent: {
//       color: colors.primary,
//     },
//     monthPickerContainer: {
//       maxHeight: 400,
//       marginBottom: 24,
//     },
//     monthPickerContent: {
//       paddingBottom: 8,
//     },
//     monthPickerGrid: {
//       flexDirection: 'row',
//       flexWrap: 'wrap',
//       justifyContent: 'flex-start',
//     },
//     monthItem: {
//       width: `${93/3}%`,
//       aspectRatio: 1.5,
//       justifyContent: 'center',
//       alignItems: 'center',
//       marginBottom: 12,
//       borderRadius: 20,
//       gap: 8,
//       marginRight: 8,
//       backgroundColor: colors.backgroundTertiary,
//     },
//     monthItemSelected: {
//       backgroundColor: colors.primary,
//     },
//     monthItemText: {
//       fontSize: isSmallScreen ? 13 : 14,
//       color: colors.text,
//       fontWeight: '500',
//     },
//     monthItemTextSelected: {
//       color: '#FFFFFF',
//       fontWeight: '600',
//     },
//     monthItemTextCurrent: {
//       color: colors.primary,
//     },
//     calendarContainer: {
//       width: '100%',
//       alignSelf: 'center',
//     },
//     weekDays: {
//       flexDirection: 'row',
//       marginBottom: 8,
//       width: '100%',
//     },
//     weekDay: {
//       flex: 1,
//       alignItems: 'center',
//       justifyContent: 'center',
//       paddingVertical: 8,
//       minHeight: 32,
//     },
//     weekDayText: {
//       fontSize: isSmallScreen ? 11 : 13,
//       color: colors.textSecondary,
//       fontWeight: '500',
//     },
//     daysGridContainer: {
//       width: '100%',
//       marginBottom: 24,
//     },
//     weekRow: {
//       flexDirection: 'row',
//       width: '100%',
//       marginBottom: 4,
//     },
//     dayCell: {
//       flex: 1,
//       aspectRatio: 1,
//       justifyContent: 'center',
//       alignItems: 'center',
//       padding: 2,
//       minHeight: 40,
//     },
//     dayText: {
//       fontSize: isSmallScreen ? 12 : 14,
//       color: colors.text,
//     },
//     selectedDay: {
//       backgroundColor: colors.primary,
//       borderRadius: 8,
//     },
//     selectedDayText: {
//       color: '#FFFFFF',
//       fontWeight: '500',
//     },
//     disabledDay: {
//       opacity: 0.3,
//     },
//     disabledDayText: {
//       color: colors.textTertiary,
//     },
//     datePickerActions: {
//       flexDirection: 'row',
//       gap: 12,
//     },
//     datePickerButton: {
//       flex: 1,
//       paddingVertical: 12,
//       borderRadius: 8,
//       alignItems: 'center',
//     },
//     cancelButton: {
//       backgroundColor: colors.backgroundTertiary,
//       borderWidth: 1,
//       borderColor: colors.border,
//       height: 55,
//       justifyContent: 'center',
//       alignItems: 'center',
//       borderRadius: 20,
//     },
//     confirmButton: {
//       backgroundColor: colors.primary,
//       height: 55,
//       justifyContent: 'center',
//       alignItems: 'center',
//       borderRadius: 20,
//     },
//     cancelButtonText: {
//       fontSize: 14,
//       fontWeight: '500',
//       color: colors.text,
//     },
//     confirmButtonText: {
//       fontSize: 14,
//       fontWeight: '500',
//       color: '#FFFFFF',
//     },
//   });
// 
//   return (
//     <Modal
//       visible={visible}
//       transparent={true}
//       animationType="slide"
//       onRequestClose={onClose}
//     >
//       <View style={styles.modalOverlay}>
//         <View style={styles.datePickerModal}>
//           <View style={styles.datePickerHeader}>
//             <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
//             <Pressable onPress={onClose} style={styles.datePickerCloseButton}>
//               <X size={20} color={colors.text} />
//             </Pressable>
//           </View>
// 
//           <View style={styles.calendarHeader}>
//             {!showYearPicker && !showMonthPicker ? (
//               <>
//                 <Pressable onPress={onPrevMonth} style={styles.navigationButton}>
//                   <ChevronLeft size={20} color={colors.textSecondary} />
//                 </Pressable>
//                 <View style={styles.monthYearContainer}>
//                   <Pressable 
//                     onPress={() => onShowMonthPicker(true)}
//                     style={styles.monthYearPressable}
//                   >
//                     <Text style={styles.monthYearText}>
//                       {MONTHS[currentMonth.getMonth()]}
//                     </Text>
//                   </Pressable>
//                   <Pressable 
//                     onPress={() => onShowYearPicker(true)}
//                     style={styles.monthYearPressable}
//                   >
//                     <Text style={styles.monthYearText}>
//                       {currentMonth.getFullYear()}
//                     </Text>
//                   </Pressable>
//                 </View>
//                 <Pressable onPress={onNextMonth} style={styles.navigationButton}>
//                   <ChevronRight size={20} color={colors.textSecondary} />
//                 </Pressable>
//               </>
//             ) : showMonthPicker ? (
//               <>
//                 <Pressable onPress={() => onShowMonthPicker(false)} style={styles.navigationButton}>
//                   <ChevronLeft size={20} color={colors.textSecondary} />
//                 </Pressable>
//                 <View style={styles.monthYearContainer}>
//                   <Text style={styles.monthYearText}>
//                     Select Month
//                   </Text>
//                 </View>
//                 <View style={styles.navigationButton} />
//               </>
//             ) : (
//               <>
//                 <Pressable onPress={onPrevYear} style={styles.navigationButton}>
//                   <ChevronLeft size={20} color={colors.textSecondary} />
//                 </Pressable>
//                 <View style={styles.monthYearContainer}>
//                   <Pressable 
//                     onPress={() => onShowYearPicker(false)}
//                     style={styles.monthYearPressable}
//                   >
//                     <Text style={styles.monthYearText}>
//                       {currentMonth.getFullYear()}
//                     </Text>
//                   </Pressable>
//                 </View>
//                 <Pressable onPress={onNextYear} style={styles.navigationButton}>
//                   <ChevronRight size={20} color={colors.textSecondary} />
//                 </Pressable>
//               </>
//             )}
//           </View>
// 
//           {showMonthPicker ? (
//             <ScrollView style={styles.monthPickerContainer} contentContainerStyle={styles.monthPickerContent}>
//               <View style={styles.monthPickerGrid}>
//                 {MONTHS.map((month, index) => {
//                   const isSelected = index === currentMonth.getMonth();
//                   const isCurrentMonth = index === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();
//                   return (
//                     <Pressable
//                       key={month}
//                       style={[
//                         styles.monthItem,
//                         isSelected && styles.monthItemSelected,
//                       ]}
//                       onPress={() => onMonthSelect(index)}
//                     >
//                       <Text style={[
//                         styles.monthItemText,
//                         isSelected && styles.monthItemTextSelected,
//                         isCurrentMonth && !isSelected && styles.monthItemTextCurrent,
//                       ]}>
//                         {month}
//                       </Text>
//                     </Pressable>
//                   );
//                 })}
//               </View>
//             </ScrollView>
//           ) : showYearPicker ? (
//             <ScrollView style={styles.yearPickerContainer} contentContainerStyle={styles.yearPickerContent}>
//               <View style={styles.yearPickerGrid}>
//                 {getAvailableYears().map((year) => {
//                   const isSelected = year === currentMonth.getFullYear();
//                   const isCurrentYear = year === new Date().getFullYear();
//                   return (
//                     <Pressable
//                       key={year}
//                       style={[
//                         styles.yearItem,
//                         isSelected && styles.yearItemSelected,
//                       ]}
//                       onPress={() => onYearSelect(year)}
//                     >
//                       <Text style={[
//                         styles.yearItemText,
//                         isSelected && styles.yearItemTextSelected,
//                         isCurrentYear && !isSelected && styles.yearItemTextCurrent,
//                       ]}>
//                         {year}
//                       </Text>
//                     </Pressable>
//                   );
//                 })}
//               </View>
//             </ScrollView>
//           ) : (
//             <>
//               <View style={styles.calendarContainer}>
//                 <View style={styles.weekDays}>
//                   {DAYS.map(day => (
//                     <View key={day} style={styles.weekDay}>
//                       <Text style={styles.weekDayText}>{day}</Text>
//                     </View>
//                   ))}
//                 </View>
// 
//                 <View style={styles.daysGridContainer}>
//                   {(() => {
//                     const totalCells = firstDayOffset + daysInMonth;
//                     const totalRows = Math.ceil(totalCells / 7);
//                     
//                     const allCells = [];
//                     for (let i = 0; i < firstDayOffset; i++) {
//                       allCells.push(null);
//                     }
//                     for (let day = 1; day <= daysInMonth; day++) {
//                       allCells.push(day);
//                     }
//                     const remainingCells = totalRows * 7 - allCells.length;
//                     for (let i = 0; i < remainingCells; i++) {
//                       allCells.push(null);
//                     }
//                     
//                     const weeks = [];
//                     for (let row = 0; row < totalRows; row++) {
//                       const week = allCells.slice(row * 7, (row + 1) * 7);
//                       weeks.push(week);
//                     }
//                     
//                     return weeks.map((week, weekIndex) => (
//                       <View key={`week-${weekIndex}`} style={styles.weekRow}>
//                         {week.map((day, dayIndex) => {
//                           if (day === null) {
//                             return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
//                           }
//                           
//                           const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
//                           const isSelectable = isDateSelectable(date);
//                           const isSelected = selectedDate && 
//                             date.getDate() === selectedDate.getDate() &&
//                             date.getMonth() === selectedDate.getMonth() &&
//                             date.getFullYear() === selectedDate.getFullYear();
// 
//                           return (
//                             <Pressable
//                               key={`day-${weekIndex}-${dayIndex}-${day}`}
//                               style={[
//                                 styles.dayCell,
//                                 isSelected && styles.selectedDay,
//                                 !isSelectable && styles.disabledDay,
//                               ]}
//                               onPress={() => isSelectable && onDateSelect(date)}
//                               disabled={!isSelectable}
//                             >
//                               <Text style={[
//                                 styles.dayText,
//                                 isSelected && styles.selectedDayText,
//                                 !isSelectable && styles.disabledDayText,
//                               ]}>
//                                 {day}
//                               </Text>
//                             </Pressable>
//                           );
//                         })}
//                       </View>
//                     ));
//                   })()}
//                 </View>
//               </View>
//             </>
//           )}
// 
//           <View style={styles.datePickerActions}>
//             <Pressable 
//               style={[styles.datePickerButton, styles.cancelButton]}
//               onPress={onClose}
//             >
//               <Text style={styles.cancelButtonText}>Cancel</Text>
//             </Pressable>
//             <Pressable 
//               style={[styles.datePickerButton, styles.confirmButton]}
//               onPress={onDateConfirm}
//               disabled={!selectedDate}
//             >
//               <Text style={styles.confirmButtonText}>Confirm</Text>
//             </Pressable>
//           </View>
//         </View>
//       </View>
//     </Modal>
//   );
// }
// 
// 
