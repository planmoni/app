import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, useWindowDimensions, ScrollView, Modal } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, Camera, Calendar, Info, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import * as ImagePicker from 'expo-image-picker';

type Step = 'personal' | 'documents' | 'selfie' | 'success';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function KycTierTwo() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  const [step, setStep] = useState<Step>('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  
  // Date picker
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Documents
  const [selectedIdentityType, setSelectedIdentityType] = useState<'nin' | 'driversLicense' | 'passport'>('nin');
  const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(null);
  const [documentBackImage, setDocumentBackImage] = useState<string | null>(null);
  
  // Selfie
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  const lastNameInputRef = useRef<TextInput>(null);
  const middleNameInputRef = useRef<TextInput>(null);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handlePrevYear = () => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()));
  const handleNextYear = () => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()));

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(newDate);
    setShowYearPicker(false);
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(currentMonth.getFullYear(), month, 1);
    setCurrentMonth(newDate);
    setShowYearPicker(false);
  };

  const getAvailableYears = () => {
    const today = new Date();
    const minYear = today.getFullYear() - 100; // 100 years ago
    const maxYear = today.getFullYear() - 18; // 18 years ago
    const years = [];
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setDateOfBirth(selected.toLocaleDateString('en-GB'));
    setIsDatePickerVisible(false);
  };

  const pickImage = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageData = `data:image/jpeg;base64,${asset.base64}`;
          setImageFunction(imageData);
          setErrors(prev => ({ ...prev, [type]: '' }));
          showToast('Image selected successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  const takePicture = async (type: 'front' | 'back' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Permission to access camera is required', 'error');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageData = `data:image/jpeg;base64,${asset.base64}`;
          switch (type) {
            case 'front':
              setDocumentFrontImage(imageData);
              setErrors(prev => ({ ...prev, documentFront: '' }));
              break;
            case 'back':
              setDocumentBackImage(imageData);
              setErrors(prev => ({ ...prev, documentBack: '' }));
              break;
            case 'selfie':
              setSelfieImage(imageData);
              setErrors(prev => ({ ...prev, selfie: '' }));
              break;
          }
          showToast('Image captured successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
    }
  };

  const validatePersonalInfo = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!address.trim()) newErrors.address = 'Address is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('Please fill in all required fields', 'error');
      return false;
    }

    setErrors({});
    return true;
  };

  const validateDocuments = () => {
    const newErrors: Record<string, string> = {};

    if (!documentFrontImage) newErrors.documentFront = 'Front of document is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('Please upload required documents', 'error');
      return false;
    }

    setErrors({});
    return true;
  };

  const validateSelfie = () => {
    if (!selfieImage) {
      setErrors({ selfie: 'Selfie is required' });
      showToast('Please capture a selfie', 'error');
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    haptics.mediumImpact();
    
    if (step === 'personal') {
      if (validatePersonalInfo()) {
        setStep('documents');
      }
    } else if (step === 'documents') {
      if (validateDocuments()) {
        setStep('selfie');
      }
    } else if (step === 'selfie') {
      if (validateSelfie()) {
        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
          setStep('success');
          haptics.success();
        }, 1500);
      }
    }
  };

  const handlePrevious = () => {
    haptics.lightImpact();
    if (step === 'documents') setStep('personal');
    else if (step === 'selfie') setStep('documents');
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const renderPersonalInfo = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Please provide your personal details as they appear on your official documents.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>First Name *</Text>
          <View style={[
            styles.inputContainer,
            firstName.trim() !== '' && styles.inputFilled,
            errors.firstName && styles.inputError,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
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
            />
          </View>
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Last Name *</Text>
          <View style={[
            styles.inputContainer,
            lastName.trim() !== '' && styles.inputFilled,
            errors.lastName && styles.inputError,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <TextInput
              ref={lastNameInputRef}
              style={[styles.input, { color: colors.text }]}
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
            />
          </View>
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Middle Name (Optional)</Text>
          <View style={[
            styles.inputContainer,
            middleName.trim() !== '' && styles.inputFilled,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <TextInput
              ref={middleNameInputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your middle name"
              placeholderTextColor={colors.textTertiary}
              value={middleName}
              onChangeText={setMiddleName}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Date of Birth *</Text>
          <Pressable 
            style={[
              styles.inputContainer,
              dateOfBirth && styles.inputFilled,
              errors.dateOfBirth && styles.inputError,
              { borderColor: colors.border, backgroundColor: colors.background }
            ]}
            onPress={() => setIsDatePickerVisible(true)}
          >
            <Text style={[styles.dateInputText, { color: dateOfBirth ? colors.text : colors.textTertiary }]}>
              {dateOfBirth || 'DD/MM/YYYY'}
            </Text>
          </Pressable>
          {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Residential Address *</Text>
          <View style={[
            styles.inputContainer,
            address.trim() !== '' && styles.inputFilled,
            errors.address && styles.inputError,
            { borderColor: colors.border, backgroundColor: colors.background }
          ]}>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.text }]}
              placeholder="Enter your address"
              placeholderTextColor={colors.textTertiary}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setErrors(prev => ({ ...prev, address: '' }));
              }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.accentBackground }]}>
          <Info size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your personal information is securely stored and will only be used for verification purposes.
          </Text>
        </View>
      </View>
    );
  };

  const renderDocuments = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Document Verification</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Please upload clear photos of your identity document for verification.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Document Type</Text>
          <View style={styles.identityTypeContainer}>
            <Pressable
              style={[
                styles.identityTypeOption,
                selectedIdentityType === 'nin' && [styles.identityTypeSelected, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]
              ]}
              onPress={() => setSelectedIdentityType('nin')}
            >
              <Text style={[
                styles.identityTypeText,
                { color: selectedIdentityType === 'nin' ? colors.primary : colors.textSecondary }
              ]}>
                NIN
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.identityTypeOption,
                selectedIdentityType === 'driversLicense' && [styles.identityTypeSelected, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]
              ]}
              onPress={() => setSelectedIdentityType('driversLicense')}
            >
              <Text style={[
                styles.identityTypeText,
                { color: selectedIdentityType === 'driversLicense' ? colors.primary : colors.textSecondary }
              ]}>
                Driver's License
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.identityTypeOption,
                selectedIdentityType === 'passport' && [styles.identityTypeSelected, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]
              ]}
              onPress={() => setSelectedIdentityType('passport')}
            >
              <Text style={[
                styles.identityTypeText,
                { color: selectedIdentityType === 'passport' ? colors.primary : colors.textSecondary }
              ]}>
                Passport
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Front of Document *</Text>
          <View style={styles.documentActions}>
            <Pressable style={[styles.documentButton, { backgroundColor: colors.primary }]} onPress={() => pickImage(setDocumentFrontImage, 'documentFront')}>
              <Text style={styles.documentButtonText}>Upload Photo</Text>
            </Pressable>
            <Pressable style={[styles.documentButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => takePicture('front')}>
              <Camera size={16} color={colors.text} />
              <Text style={[styles.documentButtonText, { color: colors.text }]}>Take Photo</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.imageUploadContainer, errors.documentFront && styles.inputError]}
            onPress={() => takePicture('front')}
          >
            {documentFrontImage ? (
              <Image source={{ uri: documentFrontImage }} style={styles.uploadedImage} />
            ) : (
              <View style={[styles.uploadPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Camera size={24} color={colors.textSecondary} />
                <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Tap to take photo</Text>
              </View>
            )}
          </Pressable>
          {errors.documentFront && <Text style={styles.errorText}>{errors.documentFront}</Text>}
        </View>

        {selectedIdentityType !== 'nin' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Back of Document (Optional)</Text>
            <View style={styles.documentActions}>
              <Pressable style={[styles.documentButton, { backgroundColor: colors.primary }]} onPress={() => pickImage(setDocumentBackImage, 'documentBack')}>
                <Text style={styles.documentButtonText}>Upload Photo</Text>
              </Pressable>
              <Pressable style={[styles.documentButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => takePicture('back')}>
                <Camera size={16} color={colors.text} />
                <Text style={[styles.documentButtonText, { color: colors.text }]}>Take Photo</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.imageUploadContainer]}
              onPress={() => takePicture('back')}
            >
              {documentBackImage ? (
                <Image source={{ uri: documentBackImage }} style={styles.uploadedImage} />
              ) : (
                <View style={[styles.uploadPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Camera size={24} color={colors.textSecondary} />
                  <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Tap to take photo</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        <View style={[styles.infoContainer, { backgroundColor: colors.accentBackground }]}>
          <Info size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Ensure the document is clearly visible, well-lit, and all text is readable. Avoid glare and shadows.
          </Text>
        </View>
      </View>
    );
  };

  const renderSelfie = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Selfie Verification</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Please capture a clear selfie for identity verification.
        </Text>

        <View style={styles.inputGroup}>
          <Pressable
            style={[styles.imageUploadContainer, errors.selfie && styles.inputError]}
            onPress={() => takePicture('selfie')}
          >
            {selfieImage ? (
              <Image source={{ uri: selfieImage }} style={styles.uploadedImage} />
            ) : (
              <View style={[styles.uploadPlaceholder, styles.selfiePlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Camera size={48} color={colors.textSecondary} />
                <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Tap to capture selfie</Text>
              </View>
            )}
          </Pressable>
          {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.accentBackground }]}>
          <Info size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Ensure your face is clearly visible, well-lit, and you are looking directly at the camera.
          </Text>
        </View>
      </View>
    );
  };

  const renderSuccess = () => {
    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
          <CheckCircle size={64} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Verification Successful!</Text>
        <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
          Your Tier 2 KYC verification has been completed successfully.
          You can now proceed with Tier 3 verification.
        </Text>
      </View>
    );
  };

  const renderDatePicker = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOffset = getFirstDayOfMonth(currentMonth);
    const totalCells = firstDayOffset + daysInMonth;
    const totalRows = Math.ceil(totalCells / 7);
    const weeks = [];
    
    for (let row = 0; row < totalRows; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        const index = row * 7 + col;
        if (index < firstDayOffset || index >= firstDayOffset + daysInMonth) {
          week.push(null);
        } else {
          week.push(index - firstDayOffset + 1);
        }
      }
      weeks.push(week);
    }

    return (
      <Modal
        visible={isDatePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.surface }]}>
            <View style={styles.datePickerHeader}>
              <Text style={[styles.datePickerTitle, { color: colors.text }]}>Select Date of Birth</Text>
              <Pressable onPress={() => setIsDatePickerVisible(false)} style={styles.datePickerCloseButton}>
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
                      <Text style={[styles.monthYearText, { color: colors.text }]}>
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
                      <Text style={[styles.monthYearText, { color: colors.text }]}>
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
                          { color: isSelected ? '#FFFFFF' : (isCurrentYear ? colors.primary : colors.text) }
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
                {/* Month Selector */}
                <View style={styles.monthSelectorContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthSelectorContent}>
                    {MONTHS.map((month, index) => {
                      const isSelected = index === currentMonth.getMonth();
                      return (
                        <Pressable
                          key={index}
                          style={[
                            styles.monthItem,
                            isSelected && styles.monthItemSelected,
                            { backgroundColor: isSelected ? colors.primary : colors.surface }
                          ]}
                          onPress={() => handleMonthSelect(index)}
                        >
                          <Text style={[
                            styles.monthItemText,
                            { color: isSelected ? '#FFFFFF' : colors.text }
                          ]}>
                            {month.substring(0, 3)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.calendarContainer}>
              <View style={styles.weekDays}>
                {DAYS.map(day => (
                  <View key={day} style={styles.weekDay}>
                    <Text style={[styles.weekDayText, { color: colors.textSecondary }]}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.daysGridContainer}>
                {weeks.map((week, weekIndex) => (
                  <View key={weekIndex} style={styles.weekRow}>
                    {week.map((day, dayIndex) => (
                      <Pressable
                        key={dayIndex}
                        style={[
                          styles.dayCell,
                          day !== null && day !== undefined ? { backgroundColor: colors.surface } : null
                        ]}
                        onPress={() => day && handleDateSelect(day)}
                      >
                        {day && (
                          <Text style={[styles.dayText, { color: colors.text }]}>{day}</Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            </View>
            </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: headerPadding }]}>
        {step !== 'success' && (
          <Pressable onPress={handlePrevious} style={styles.backButton}>
            <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Tier 2 Upgrade</Text>
        </View>
        
        {step !== 'success' && (
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <X size={isSmallScreen ? 20 : 24} color={colors.text} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        {step === 'personal' && renderPersonalInfo()}
        {step === 'documents' && renderDocuments()}
        {step === 'selfie' && renderSelfie()}
        {step === 'success' && renderSuccess()}
      </KeyboardAvoidingWrapper>

      {step !== 'success' && (
        <FloatingButton
          title={step === 'selfie' ? 'Submit' : 'Continue'}
          onPress={handleNext}
          disabled={isLoading}
          loading={isLoading}
        />
      )}

      {step === 'success' && (
        <View style={[styles.stickyButtonContainer, { paddingHorizontal: contentPadding }]}>
          <Pressable
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      )}

      {renderDatePicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  formContainer: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 55,
    gap: 12,
  },
  inputFilled: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 18,
  },
  multilineInput: {
    height: 80,
    paddingVertical: 12,
  },
  dateInputText: {
    fontSize: 18,
    marginLeft: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  identityTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  identityTypeOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  identityTypeSelected: {
    borderWidth: 2,
  },
  identityTypeText: {
    fontSize: 14,
    alignItems: 'center',
    textAlignVertical: 'center',
    fontWeight: '600',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  documentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  documentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageUploadContainer: {
    width: '100%',
    minHeight: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 12,
  },
  selfiePlaceholder: {
    borderRadius: 20,
    width: 200,
    height: 200,
    alignSelf: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  stickyButtonContainer: {
    paddingBottom: 16,
    paddingTop: 8,
  },
  doneButton: {
    height: 55,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  navigationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  monthYearContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
    pointerEvents: 'box-none',
  },
  monthYearPressable: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthSelectorContainer: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  monthSelectorContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  monthItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthItemSelected: {
    borderColor: '#1E3A8A',
  },
  monthItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  yearPickerContainer: {
    maxHeight: 300,
  },
  yearPickerContent: {
    paddingVertical: 8,
  },
  yearPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  yearItem: {
    width: '22%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: 'transparent',
  },
  yearItemSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  yearItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  yearItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  yearItemTextCurrent: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  calendarContainer: {
    marginTop: 12,
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
  },
  daysGridContainer: {
    marginTop: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

