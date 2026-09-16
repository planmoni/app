// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useState, useCallback } from 'react';
// 
// const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// const MONTHS = [
//   'January', 'February', 'March', 'April', 'May', 'June',
//   'July', 'August', 'September', 'October', 'November', 'December'
// ];
// 
// export const useKYCDatePicker = (initialDate?: string) => {
//   const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
//   const [selectedDate, setSelectedDate] = useState<Date | null>(null);
//   const [currentMonth, setCurrentMonth] = useState(new Date());
//   const [showYearPicker, setShowYearPicker] = useState(false);
//   const [dateOfBirth, setDateOfBirth] = useState(initialDate || '');
// 
//   const getDaysInMonth = useCallback((date: Date) => {
//     return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
//   }, []);
// 
//   const getFirstDayOfMonth = useCallback((date: Date) => {
//     return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
//   }, []);
// 
//   const formatDateForDisplay = useCallback((date: Date) => {
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}/${month}/${year}`;
//   }, []);
// 
//   const parseDateFromString = useCallback((dateString: string): Date | null => {
//     if (!dateString) return null;
//     const parts = dateString.split('/');
//     if (parts.length === 3) {
//       const day = parseInt(parts[0]);
//       const month = parseInt(parts[1]) - 1;
//       const year = parseInt(parts[2]);
//       if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
//         return new Date(year, month, day);
//       }
//     }
//     return null;
//   }, []);
// 
//   const handleDatePickerOpen = useCallback(() => {
//     const existingDate = parseDateFromString(dateOfBirth);
//     if (existingDate) {
//       setSelectedDate(existingDate);
//       setCurrentMonth(existingDate);
//     } else {
//       setSelectedDate(null);
//       setCurrentMonth(new Date());
//     }
//     setIsDatePickerVisible(true);
//   }, [dateOfBirth, parseDateFromString]);
// 
//   const handleDatePickerClose = useCallback(() => {
//     setIsDatePickerVisible(false);
//     setShowYearPicker(false);
//   }, []);
// 
//   const handleDateSelect = useCallback((date: Date) => {
//     setSelectedDate(date);
//   }, []);
// 
//   const handleDateConfirm = useCallback(() => {
//     if (selectedDate) {
//       const formattedDate = formatDateForDisplay(selectedDate);
//       setDateOfBirth(formattedDate);
//     }
//     setIsDatePickerVisible(false);
//   }, [selectedDate, formatDateForDisplay]);
// 
//   const handlePrevMonth = useCallback(() => {
//     setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
//   }, [currentMonth]);
// 
//   const handleNextMonth = useCallback(() => {
//     setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
//   }, [currentMonth]);
// 
//   const handlePrevYear = useCallback(() => {
//     setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()));
//   }, [currentMonth]);
// 
//   const handleNextYear = useCallback(() => {
//     setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()));
//   }, [currentMonth]);
// 
//   const handleYearSelect = useCallback((year: number) => {
//     const newDate = new Date(year, currentMonth.getMonth(), 1);
//     setCurrentMonth(newDate);
//     setShowYearPicker(false);
//   }, [currentMonth]);
// 
//   const getAvailableYears = useCallback(() => {
//     const today = new Date();
//     const minYear = today.getFullYear() - 100;
//     const maxYear = today.getFullYear() - 18;
//     const years = [];
//     for (let year = maxYear; year >= minYear; year--) {
//       years.push(year);
//     }
//     return years;
//   }, []);
// 
//   const isDateSelectable = useCallback((date: Date) => {
//     const today = new Date();
//     const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
//     const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
//     return date >= minDate && date <= maxDate;
//   }, []);
// 
//   const formatDateInput = useCallback((text: string) => {
//     let cleaned = text.replace(/[^0-9]/g, '');
//     
//     if (cleaned.length > 4) {
//       cleaned = cleaned.slice(0, 4) + cleaned.slice(4);
//     }
//     if (cleaned.length > 2) {
//       cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
//     }
//     if (cleaned.length > 5) {
//       cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
//     }
//     
//     if (cleaned.length > 10) {
//       cleaned = cleaned.slice(0, 10);
//     }
//     
//     return cleaned;
//   }, []);
// 
//   const handleDateChange = useCallback((text: string) => {
//     const formattedDate = formatDateInput(text);
//     setDateOfBirth(formattedDate);
//   }, [formatDateInput]);
// 
//   return {
//     // State
//     isDatePickerVisible,
//     selectedDate,
//     currentMonth,
//     showYearPicker,
//     dateOfBirth,
//     
//     // Setters
//     setDateOfBirth,
//     setShowYearPicker,
//     
//     // Handlers
//     handleDatePickerOpen,
//     handleDatePickerClose,
//     handleDateSelect,
//     handleDateConfirm,
//     handlePrevMonth,
//     handleNextMonth,
//     handlePrevYear,
//     handleNextYear,
//     handleYearSelect,
//     handleDateChange,
//     
//     // Helpers
//     getDaysInMonth,
//     getFirstDayOfMonth,
//     formatDateForDisplay,
//     parseDateFromString,
//     getAvailableYears,
//     isDateSelectable,
//     formatDateInput,
//     
//     // Constants
//     DAYS,
//     MONTHS,
//   };
// };
// 
// 
