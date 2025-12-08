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
import { supabase } from '@/lib/supabase';

interface PersonalInfoStepProps {
  onComplete: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
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
  
  // Check if BVN is verified and names should be populated from BVN
  const isBVNVerified = progress?.bvn_verified || progress?.id_face_verified || false;
  const hasBVNNames = !!(formData?.first_name || formData?.last_name || formData?.middle_name);
  const namesFromBVN = isBVNVerified && hasBVNNames;
  
  // Date picker state
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  // Location search
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // BVN data loading state
  const [isLoadingBVNData, setIsLoadingBVNData] = useState(false);
  
  // Refs
  const lastNameInputRef = useRef<TextInput>(null);
  const middleNameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  // Populate names from BVN when BVN is verified and formData has names
  useEffect(() => {
    if (namesFromBVN && formData) {
      if (formData.first_name) {
        setFirstName(formData.first_name);
      }
      if (formData.last_name) {
        setLastName(formData.last_name);
      }
      if (formData.middle_name !== undefined) {
        setMiddleName(formData.middle_name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesFromBVN, formData?.first_name, formData?.last_name, formData?.middle_name]);

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

  // Load BVN names if BVN is verified
  useEffect(() => {
    const loadBVNNames = async () => {
      if (!isBVNVerified || !session?.user?.id) return;
      
      // If names are already populated from formData, sync state with formData
      if (formData?.first_name && formData?.last_name) {
        if (firstName !== formData.first_name) setFirstName(formData.first_name);
        if (lastName !== formData.last_name) setLastName(formData.last_name);
        if (middleName !== (formData.middle_name || '')) setMiddleName(formData.middle_name || '');
        return;
      }
      
      try {
        setIsLoadingBVNData(true);
        
        // Query safehaven_accounts to get account_name
        const { data: accountData, error } = await supabase
          .from('safehaven_accounts')
          .select('account_name')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .limit(1)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching BVN account data:', error);
          return;
        }
        
        if (accountData?.account_name) {
          // Extract names from account_name
          const names = accountData.account_name.trim().split(/\s+/);
          const bvnFirstName = names[0] || '';
          const bvnLastName = names[names.length - 1] || '';
          const bvnMiddleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';
          
          // Update state with BVN names
          setFirstName(bvnFirstName);
          setLastName(bvnLastName);
          setMiddleName(bvnMiddleName);
          
          // Save to formData
          await saveFormData({
            first_name: bvnFirstName,
            last_name: bvnLastName,
            middle_name: bvnMiddleName
          });
        }
      } catch (error) {
        console.error('Error loading BVN names:', error);
      } finally {
        setIsLoadingBVNData(false);
      }
    };
    
    loadBVNNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBVNVerified, session?.user?.id, formData?.first_name, formData?.last_name, formData?.middle_name]);

  const handleDatePickerOpen = () => {
    const existingDate = parseDateFromString(dateOfBirth);
    if (existingDate) {
      // Ensure the existing date is within valid range
      const today = new Date();
      const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
      const maxDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
      maxDate.setHours(23, 59, 59, 999);
      
      if (existingDate >= minDate && existingDate <= maxDate) {
      setSelectedDate(existingDate);
      setCurrentMonth(existingDate);
    } else {
        // If existing date is out of range, set to a valid default (12 years ago)
        const defaultDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
      setSelectedDate(null);
        setCurrentMonth(defaultDate);
      }
    } else {
      // Default to 12 years ago (maximum selectable date)
      const today = new Date();
      const defaultDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
      setSelectedDate(null);
      // Set to maximum allowed date (7 years ago) by default
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 7);
      maxDate.setHours(0, 0, 0, 0);
      setCurrentMonth(maxDate);
    }
    setIsDatePickerVisible(true);
  };

  const handleDatePickerClose = () => {
    setIsDatePickerVisible(false);
    setShowYearPicker(false);
    setShowMonthPicker(false);
  };

  const handleDateSelect = (date: Date) => {
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
    maxDate.setHours(23, 59, 59, 999);
    
    // Only allow selection if date is within valid range
    if (date >= minDate && date <= maxDate) {
    setSelectedDate(date);
    }
  };

  const handleDateConfirm = () => {
    if (selectedDate) {
      const today = new Date();
      const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
      const maxDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
      maxDate.setHours(23, 59, 59, 999);
      
      // Validate date is within range before confirming
      if (selectedDate >= minDate && selectedDate <= maxDate) {
      setDateOfBirth(formatDateForDisplay(selectedDate));
      setErrors(prev => ({ ...prev, dateOfBirth: '' }));
      } else {
        showToast('Please select a valid date of birth (minimum age: 12 years)', 'error');
        return;
      }
    }
    handleDatePickerClose();
  };

  // Calculate maximum date (7 years ago from today)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 7);
    maxDate.setHours(23, 59, 59, 999);
    return maxDate;
  };

  // Calculate minimum date (reasonable limit, e.g., 120 years ago)
  const getMinDate = () => {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 120);
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    // Only allow navigation if the new month is within valid range
    if (newDate >= minDate && newDate <= maxDate) {
      setCurrentMonth(newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    // Only allow navigation if the new month is within valid range
    if (newDate >= minDate && newDate <= maxDate) {
      setCurrentMonth(newDate);
    }
  };

  const handleYearSelect = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth()));
    setShowYearPicker(false);
  };

  const handleMonthSelect = (month: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month));
    setShowMonthPicker(false);
  };

  const handlePrevYear = () => {
    const newDate = new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth());
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    // Only allow navigation if the new year is within valid range
    if (newDate.getFullYear() >= minDate.getFullYear() && newDate.getFullYear() <= maxDate.getFullYear()) {
      setCurrentMonth(newDate);
    }
  };

  const handleNextYear = () => {
    const newDate = new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth());
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    // Only allow navigation if the new year is within valid range
    if (newDate.getFullYear() >= minDate.getFullYear() && newDate.getFullYear() <= maxDate.getFullYear()) {
      setCurrentMonth(newDate);
    }
  };

  const getAvailableYears = () => {
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    const years = [];
    for (let year = maxDate.getFullYear(); year >= minDate.getFullYear(); year--) {
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

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const maxDate = getMaxDate();
    const minDate = getMinDate();
    
    // Disable future dates and dates older than 7 years ago
    return date > today || date > maxDate || date < minDate;
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
    
    // Validate age (must be at least 7 years old)
    if (dateOfBirth && /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(dateOfBirth)) {
      const parsedDate = parseDateFromString(dateOfBirth);
      if (parsedDate) {
        const today = new Date();
        const maxDate = getMaxDate();
        const minDate = getMinDate();
        
        if (parsedDate > today) {
          newErrors.dateOfBirth = 'Date of birth cannot be in the future';
        } else if (parsedDate > maxDate) {
          newErrors.dateOfBirth = 'You must be at least 7 years old';
        } else if (parsedDate < minDate) {
          newErrors.dateOfBirth = 'Please enter a valid date of birth';
        }
      }
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
              {namesFromBVN && (
                <Text style={styles.bvnIndicator}>Populated from BVN verification</Text>
              )}
              <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
                <TextInput
                  style={[styles.input, isBVNVerified && styles.inputReadOnly]}
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.textTertiary}
                  value={firstName}
                  onChangeText={(text) => {
                    if (!isBVNVerified) {
                    setFirstName(text);
                    setErrors(prev => ({ ...prev, firstName: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameInputRef.current?.focus()}
                  editable={!isCompleted && !namesFromBVN}
                />
              </View>
              {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
              {isBVNVerified && <Text style={styles.helperText}>This field is populated from your BVN verification</Text>}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              {namesFromBVN && (
                <Text style={styles.bvnIndicator}>Populated from BVN verification</Text>
              )}
              <View style={[styles.inputContainer, errors.lastName && styles.inputError]}>
                <TextInput
                  ref={lastNameInputRef}
                  style={[styles.input, isBVNVerified && styles.inputReadOnly]}
                  placeholder="Enter your last name"
                  placeholderTextColor={colors.textTertiary}
                  value={lastName}
                  onChangeText={(text) => {
                    if (!isBVNVerified) {
                    setLastName(text);
                    setErrors(prev => ({ ...prev, lastName: '' }));
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => middleNameInputRef.current?.focus()}
                  editable={!isCompleted && !namesFromBVN}
                />
              </View>
              {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
              {isBVNVerified && <Text style={styles.helperText}>This field is populated from your BVN verification</Text>}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Middle Name (Optional)</Text>
              {namesFromBVN && formData?.middle_name && (
                <Text style={styles.bvnIndicator}>Populated from BVN verification</Text>
              )}
              <View style={styles.inputContainer}>
                <TextInput
                  ref={middleNameInputRef}
                  style={[styles.input, isBVNVerified && styles.inputReadOnly]}
                  placeholder="Enter your middle name"
                  placeholderTextColor={colors.textTertiary}
                  value={middleName}
                  onChangeText={(text) => {
                    if (!isBVNVerified) {
                      setMiddleName(text);
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                  editable={!isCompleted && !namesFromBVN}
                />
              </View>
              {isBVNVerified && <Text style={styles.helperText}>This field is populated from your BVN verification</Text>}
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
              {showYearPicker ? (
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
              ) : showMonthPicker ? (
                <>
                  <Pressable onPress={() => setShowMonthPicker(false)} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Text style={styles.monthYearText}>
                      Select Month
                    </Text>
                  </View>
                  <Pressable onPress={() => setShowYearPicker(true)} style={styles.navigationButton}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={handlePrevMonth} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Pressable 
                      onPress={() => setShowMonthPicker(true)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {MONTHS[currentMonth.getMonth()]}
                      </Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => setShowYearPicker(true)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {currentMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
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
                    const maxDate = getMaxDate();
                    const isMaxYear = year === maxDate.getFullYear();
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
                          isMaxYear && !isSelected && styles.yearItemTextCurrent,
                        ]}>
                          {year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : showMonthPicker ? (
              <ScrollView style={styles.yearPickerContainer} contentContainerStyle={styles.yearPickerContent}>
                <View style={styles.yearPickerGrid}>
                  {MONTHS.map((month, index) => {
                    const isSelected = index === currentMonth.getMonth();
                    const testDate = new Date(currentMonth.getFullYear(), index, 1);
                    const maxDate = getMaxDate();
                    const minDate = getMinDate();
                    const isDisabled = testDate > maxDate || testDate < minDate;
                    return (
                      <Pressable
                        key={index}
                        style={[
                          styles.yearItem,
                          isSelected && styles.yearItemSelected,
                          isDisabled && styles.yearItemDisabled,
                        ]}
                        onPress={() => !isDisabled && handleMonthSelect(index)}
                        disabled={isDisabled}
                      >
                        <Text style={[
                          styles.yearItemText,
                          isSelected && styles.yearItemTextSelected,
                          isDisabled && styles.yearItemTextDisabled,
                        ]}>
                          {month}
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
                            const isDisabled = isDateDisabled(day);
                            
                            return (
                              <Pressable
                                key={dayIndex}
                                style={[
                                  styles.dayCell,
                                  isSelected && styles.dayCellSelected,
                                  isTodayDate && !isSelected && styles.dayCellToday,
                                  isDisabled && styles.dayCellDisabled,
                                ]}
                                onPress={() => handleDateSelect(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                                disabled={isDisabled}
                              >
                                <Text style={[
                                  styles.dayText,
                                  isSelected && styles.dayTextSelected,
                                  isTodayDate && !isSelected && styles.dayTextToday,
                                  isDisabled && styles.dayTextPast,
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
    bvnIndicator: {
      fontSize: 12,
      color: colors.primary,
      marginBottom: 4,
      fontStyle: 'italic',
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
    navigationButtonDisabled: {
      opacity: 0.3,
    },
    monthYearContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
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
    dayCellDisabled: {
      opacity: 0.3,
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
    yearItemDisabled: {
      opacity: 0.3,
      borderColor: colors.border,
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
    yearItemTextDisabled: {
      color: colors.textTertiary,
    },
  });
}

