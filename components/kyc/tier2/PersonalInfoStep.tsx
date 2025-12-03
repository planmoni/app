import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Calendar, Info, ChevronRight, ChevronLeft, X } from 'lucide-react-native';
import ProgressBar from './ProgressBar';
import { useTier2KYC } from '@/hooks/useTier2KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import Button from '@/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
import { BlurView } from 'expo-blur';
import LocationSearchModal from '@/components/LocationSearchModal';

interface PersonalInfoStepProps {
  onComplete: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PersonalInfoStep({ onComplete }: PersonalInfoStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier2KYC();
  const insets = useSafeAreaInsets();
  
  // Keyboard offset for floating button
  const { bottomOffset } = useFabKeyboardOffset({
    gap: Platform.OS === 'android' ? -180 : -20,
    tabBarHeight: 0,
  });
  
  // Form state
  const [firstName, setFirstName] = useState(formData?.first_name || '');
  const [lastName, setLastName] = useState(formData?.last_name || '');
  const [middleName, setMiddleName] = useState(formData?.middle_name || '');
  const [dateOfBirth, setDateOfBirth] = useState(formData?.date_of_birth || '');
  const [phoneNumber, setPhoneNumber] = useState(formData?.phone_number || '');
  const [address, setAddress] = useState(formData?.address || '');
  const [addressNo, setAddressNo] = useState(formData?.address_no || '');
  const [addressLat, setAddressLat] = useState(formData?.address_lat || '');
  const [addressLon, setAddressLon] = useState(formData?.address_lon || '');
  const [addressPlaceId, setAddressPlaceId] = useState(formData?.address_place_id || '');
  
  // Date picker state
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Location search
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs
  const lastNameInputRef = useRef<TextInput>(null);
  const middleNameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  // Date picker helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateForDisplay = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseDateFromString = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  const handleDatePickerOpen = () => {
    const existingDate = parseDateFromString(dateOfBirth);
    if (existingDate) {
      setSelectedDate(existingDate);
      setCurrentMonth(existingDate);
    } else {
      setSelectedDate(null);
      setCurrentMonth(new Date());
    }
    setIsDatePickerVisible(true);
  };

  const handleDatePickerClose = () => {
    setIsDatePickerVisible(false);
    setShowYearPicker(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleDateConfirm = () => {
    if (selectedDate) {
      setDateOfBirth(formatDateForDisplay(selectedDate));
      setErrors(prev => ({ ...prev, dateOfBirth: '' }));
    }
    handleDatePickerClose();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleYearSelect = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth()));
    setShowYearPicker(false);
  };

  const handlePrevYear = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()));
  };

  const handleNextYear = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()));
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 100; year--) {
      years.push(year);
    }
    return years;
  };

  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day &&
           selectedDate.getMonth() === currentMonth.getMonth() &&
           selectedDate.getFullYear() === currentMonth.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() &&
           currentMonth.getMonth() === today.getMonth() &&
           currentMonth.getFullYear() === today.getFullYear();
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Validation
  const validatePersonalInfo = () => {
    const newErrors: Record<string, string> = {};
    
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';
    if (!phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!address.trim()) newErrors.address = 'Address is required';
    
    // Validate date format (DD/MM/YYYY)
    if (dateOfBirth && !/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(dateOfBirth)) {
      newErrors.dateOfBirth = 'Please enter a valid date (DD/MM/YYYY)';
    }
    
    // Validate phone number
    if (phoneNumber && (phoneNumber.length < 10 || !/^\d+$/.test(phoneNumber))) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };

  const handleContinue = async () => {
    if (!validatePersonalInfo()) {
      return;
    }

    if (!session?.user?.id) {
      showToast('Authentication required', 'error');
      return;
    }

    setIsSaving(true);

    try {
      // Save personal info data
      const saveResult = await saveFormData({
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        date_of_birth: dateOfBirth,
        phone_number: phoneNumber,
        address: address,
        address_no: addressNo,
        address_lat: addressLat,
        address_lon: addressLon,
        address_place_id: addressPlaceId
      });
      
      if (!saveResult) {
        showToast('Failed to save personal information. Please try again.', 'error');
        return;
      }
      
      // Update progress
      const progressResult = await updateProgress({
        current_step: 'documents_verification',
        personal_info_completed: true
      });
      
      if (!progressResult) {
        showToast('Failed to update progress. Please try again.', 'error');
        return;
      }
      
      showToast('Personal information saved successfully', 'success');
      
      // Navigate to next step
      setTimeout(() => {
        onComplete();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving personal info:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationSelect = (location: {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    address?: {
      house_number?: string;
      road?: string;
      suburb?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  }) => {
    setAddress(location.display_name);
    setAddressLat(location.lat);
    setAddressLon(location.lon);
    setAddressPlaceId(location.place_id.toString());
    setErrors(prev => ({ ...prev, address: '' }));
    setShowLocationSearch(false);
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();
  const isCompleted = progress?.personal_info_completed || false;

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOffset = getFirstDayOfMonth(currentMonth);

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={2} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Personal Information</Text>
            <Text style={styles.description}>
              Please provide your personal details as they appear on your official documents.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.textTertiary}
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    setErrors(prev => ({ ...prev, firstName: '' }));
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameInputRef.current?.focus()}
                  editable={!isCompleted}
                />
              </View>
              {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <View style={[styles.inputContainer, errors.lastName && styles.inputError]}>
                <TextInput
                  ref={lastNameInputRef}
                  style={styles.input}
                  placeholder="Enter your last name"
                  placeholderTextColor={colors.textTertiary}
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text);
                    setErrors(prev => ({ ...prev, lastName: '' }));
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => middleNameInputRef.current?.focus()}
                  editable={!isCompleted}
                />
              </View>
              {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Middle Name (Optional)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  ref={middleNameInputRef}
                  style={styles.input}
                  placeholder="Enter your middle name"
                  placeholderTextColor={colors.textTertiary}
                  value={middleName}
                  onChangeText={setMiddleName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                  editable={!isCompleted}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <Pressable 
                style={[styles.inputContainer, errors.dateOfBirth && styles.inputError]}
                onPress={handleDatePickerOpen}
                disabled={isCompleted}
              >
                <View style={styles.dateInputContent}>
                  <Calendar size={20} color={colors.textSecondary} />
                  <Text style={[
                    styles.dateInputText,
                    !dateOfBirth && styles.dateInputPlaceholder
                  ]}>
                    {dateOfBirth || 'DD/MM/YYYY'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textTertiary} />
              </Pressable>
              {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.input}
                  placeholder="090XXXXXXXX"
                  placeholderTextColor={colors.textTertiary}
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    setErrors(prev => ({ ...prev, phoneNumber: '' }));
                  }}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  editable={!isCompleted}
                />
              </View>
              {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
              <Text style={styles.helperText}>
                Use the same phone number you registered your NIN with. One-Time Passwords can only be sent to that line.
              </Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>House/Street Number</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter house/street number"
                  placeholderTextColor={colors.textTertiary}
                  value={addressNo}
                  onChangeText={setAddressNo}
                  keyboardType="numeric"
                  editable={!isCompleted}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Residential Address</Text>
              <Pressable 
                style={[styles.inputContainer, errors.address && styles.inputError]}
                onPress={() => setShowLocationSearch(true)}
                disabled={isCompleted}
              >
                <TextInput
                  ref={addressInputRef}
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Tap to search for your address"
                  placeholderTextColor={colors.textTertiary}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    setErrors(prev => ({ ...prev, address: '' }));
                  }}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={false}
                  pointerEvents="none"
                />
                <ChevronRight size={20} color={colors.textTertiary} />
              </Pressable>
              {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
              {address && (
                <Text style={styles.locationInfo}>
                  📍 Location selected from map
                </Text>
              )}
            </View>
            
            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your personal information is securely stored and will only be used for verification purposes.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!isCompleted && (
        <View 
          style={[
            styles.floatingButtonContainer,
            { 
              bottom: Platform.OS === 'android' 
                ? insets.bottom 
                : bottomOffset 
            }
          ]}
          pointerEvents="box-none"
        >
          <BlurView
            intensity={Platform.OS === 'android' ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurUnderlay}
            pointerEvents="none"
          />
          
          <BlurView
            intensity={Platform.OS === 'android' ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurBackground}
            pointerEvents="none"
          />
          
          <View style={[
            styles.buttonContentOverlay,
            Platform.OS === 'android' && styles.androidButtonContentOverlay
          ]}>
            <Button
              title="Continue"
              onPress={handleContinue}
              disabled={isSaving}
              isLoading={isSaving}
              style={styles.mainButton}
              variant="primary"
              textColor="#fff"
              textStyle={styles.buttonText}
            />
          </View>
        </View>
      )}

      {/* Date Picker Modal */}
      <Modal
        visible={isDatePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDatePickerClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
              <Pressable onPress={handleDatePickerClose} style={styles.datePickerCloseButton}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              {!showYearPicker ? (
                <>
                  <Pressable onPress={handlePrevMonth} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Pressable 
                      onPress={() => setShowYearPicker(true)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={handlePrevYear} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Pressable 
                      onPress={() => setShowYearPicker(false)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {currentMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={handleNextYear} style={styles.navigationButton}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </>
              )}
            </View>

            {showYearPicker ? (
              <ScrollView style={styles.yearPickerContainer} contentContainerStyle={styles.yearPickerContent}>
                <View style={styles.yearPickerGrid}>
                  {getAvailableYears().map((year) => {
                    const isSelected = year === currentMonth.getFullYear();
                    const isCurrentYear = year === new Date().getFullYear();
                    return (
                      <Pressable
                        key={year}
                        style={[
                          styles.yearItem,
                          isSelected && styles.yearItemSelected,
                        ]}
                        onPress={() => handleYearSelect(year)}
                      >
                        <Text style={[
                          styles.yearItemText,
                          isSelected && styles.yearItemTextSelected,
                          isCurrentYear && !isSelected && styles.yearItemTextCurrent,
                        ]}>
                          {year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <>
                <View style={styles.calendarContainer}>
                  <View style={styles.weekDays}>
                    {DAYS.map(day => (
                      <View key={day} style={styles.weekDay}>
                        <Text style={styles.weekDayText}>{day}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.daysGridContainer}>
                    {(() => {
                      const totalCells = firstDayOffset + daysInMonth;
                      const totalRows = Math.ceil(totalCells / 7);
                      const weeks = [];
                      
                      const allCells = [];
                      for (let i = 0; i < firstDayOffset; i++) {
                        allCells.push(null);
                      }
                      for (let day = 1; day <= daysInMonth; day++) {
                        allCells.push(day);
                      }
                      
                      for (let row = 0; row < totalRows; row++) {
                        const week = [];
                        for (let col = 0; col < 7; col++) {
                          const index = row * 7 + col;
                          const day = allCells[index];
                          week.push(day);
                        }
                        weeks.push(week);
                      }
                      
                      return weeks.map((week, weekIndex) => (
                        <View key={weekIndex} style={styles.weekRow}>
                          {week.map((day, dayIndex) => {
                            if (day === null) {
                              return <View key={dayIndex} style={styles.dayCell} />;
                            }
                            
                            const isSelected = isDateSelected(day);
                            const isTodayDate = isToday(day);
                            const isPast = isPastDate(day);
                            
                            return (
                              <Pressable
                                key={dayIndex}
                                style={[
                                  styles.dayCell,
                                  isSelected && styles.dayCellSelected,
                                  isTodayDate && !isSelected && styles.dayCellToday,
                                ]}
                                onPress={() => handleDateSelect(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                                disabled={isPast}
                              >
                                <Text style={[
                                  styles.dayText,
                                  isSelected && styles.dayTextSelected,
                                  isTodayDate && !isSelected && styles.dayTextToday,
                                  isPast && styles.dayTextPast,
                                ]}>
                                  {day}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ));
                    })()}
                  </View>
                </View>

                <View style={styles.datePickerActions}>
                  <Pressable
                    style={styles.datePickerCancelButton}
                    onPress={handleDatePickerClose}
                  >
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.datePickerConfirmButton, !selectedDate && styles.datePickerConfirmButtonDisabled]}
                    onPress={handleDateConfirm}
                    disabled={!selectedDate}
                  >
                    <Text style={styles.datePickerConfirmText}>Confirm</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Search Modal */}
      <LocationSearchModal
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelectLocation={handleLocationSelect}
      />
    </View>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 250,
    },
    content: {
      padding: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      minHeight: 60,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: 16,
    },
    multilineInput: {
      minHeight: 80,
      paddingTop: 16,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    helperText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 16,
    },
    dateInputContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    dateInputText: {
      fontSize: 16,
      color: colors.text,
    },
    dateInputPlaceholder: {
      color: colors.textTertiary,
    },
    locationInfo: {
      fontSize: 12,
      color: colors.success,
      marginTop: 8,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      padding: 16,
      borderRadius: 12,
      marginTop: 20,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      flex: 1,
    },
    floatingButtonContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    blurUnderlay: {
      position: 'absolute',
      top: -1,
      left: 0,
      right: 0,
      bottom: 0,
      height: 200,
    },
    blurBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    buttonContentOverlay: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    androidButtonContentOverlay: {
      borderTopWidth: 0,
      backgroundColor: 'transparent',
      paddingTop: 4,
      paddingBottom: 4,
    },
    mainButton: {
      width: '100%',
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
    // Date Picker Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    datePickerModal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 20,
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    datePickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    datePickerCloseButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
    },
    navigationButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    monthYearContainer: {
      flex: 1,
      alignItems: 'center',
    },
    monthYearPressable: {
      padding: 8,
    },
    monthYearText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    calendarContainer: {
      paddingHorizontal: 20,
    },
    weekDays: {
      flexDirection: 'row',
      marginBottom: 10,
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
    daysGridContainer: {
      marginBottom: 20,
    },
    weekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 2,
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    dayCellToday: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
      borderRadius: 20,
    },
    dayText: {
      fontSize: 16,
      color: colors.text,
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: '600',
    },
    dayTextPast: {
      color: colors.textTertiary,
    },
    datePickerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    datePickerCancelButton: {
      flex: 1,
      paddingVertical: 14,
      marginRight: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    datePickerCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    datePickerConfirmButton: {
      flex: 1,
      paddingVertical: 14,
      marginLeft: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    datePickerConfirmButtonDisabled: {
      opacity: 0.5,
    },
    datePickerConfirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    yearPickerContainer: {
      maxHeight: 300,
    },
    yearPickerContent: {
      padding: 20,
    },
    yearPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    yearItem: {
      width: '18%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    yearItemSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    yearItemText: {
      fontSize: 14,
      color: colors.text,
    },
    yearItemTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    yearItemTextCurrent: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

