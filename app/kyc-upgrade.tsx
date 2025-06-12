import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, User, Calendar, Info, Shield, ChevronRight, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';

type KYCStep = 'personal' | 'identity' | 'verification' | 'review';
type IdentityType = 'bvn' | 'nin' | 'passport' | 'drivers_license';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<KYCStep>('personal');
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>('bvn');
  const [isLoading, setIsLoading] = useState(false);
  
  // Personal information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  
  // Identity information
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [driversLicense, setDriversLicense] = useState('');
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Refs for auto-focus
  const lastNameInputRef = useRef<TextInput>(null);
  const middleNameInputRef = useRef<TextInput>(null);
  const dobInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);
  
  // Pre-fill form with user data if available
  useEffect(() => {
    // In a real app, you would fetch user data from your backend
    // For demo purposes, we'll use placeholder data
    setFirstName('John');
    setLastName('Doe');
    setPhoneNumber('08012345678');
  }, []);
  
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
    
    // Validate phone number (Nigerian format)
    if (phoneNumber && !/^0[789][01]\d{8}$/.test(phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Nigerian phone number';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };
  
  const validateIdentityInfo = () => {
    const newErrors: Record<string, string> = {};
    
    switch (selectedIdentityType) {
      case 'bvn':
        if (!bvn.trim()) newErrors.bvn = 'BVN is required';
        else if (bvn.length !== 11 || !/^\d+$/.test(bvn)) newErrors.bvn = 'BVN must be 11 digits';
        break;
      case 'nin':
        if (!nin.trim()) newErrors.nin = 'NIN is required';
        else if (nin.length !== 11 || !/^\d+$/.test(nin)) newErrors.nin = 'NIN must be 11 digits';
        break;
      case 'passport':
        if (!passportNumber.trim()) newErrors.passportNumber = 'Passport number is required';
        break;
      case 'drivers_license':
        if (!driversLicense.trim()) newErrors.driversLicense = 'Driver\'s license number is required';
        break;
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };
  
  const handleNextStep = () => {
    switch (currentStep) {
      case 'personal':
        if (validatePersonalInfo()) {
          setCurrentStep('identity');
        }
        break;
      case 'identity':
        if (validateIdentityInfo()) {
          setCurrentStep('verification');
        }
        break;
      case 'verification':
        setCurrentStep('review');
        break;
      case 'review':
        handleSubmit();
        break;
    }
  };
  
  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'identity':
        setCurrentStep('personal');
        break;
      case 'verification':
        setCurrentStep('identity');
        break;
      case 'review':
        setCurrentStep('verification');
        break;
      default:
        router.back();
    }
  };
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast('Verification submitted successfully!', 'success');
      router.replace('/(tabs)');
    } catch (error) {
      showToast('Failed to submit verification. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDateInput = (text: string) => {
    // Remove non-numeric characters
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // Add slashes automatically
    if (cleaned.length > 4) {
      cleaned = cleaned.slice(0, 4) + cleaned.slice(4);
    }
    if (cleaned.length > 2) {
      cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 5) {
      cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
    }
    
    // Limit to DD/MM/YYYY format
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }
    
    return cleaned;
  };
  
  const handleDateChange = (text: string) => {
    const formattedDate = formatDateInput(text);
    setDateOfBirth(formattedDate);
    setErrors(prev => ({ ...prev, dateOfBirth: '' }));
  };
  
  const getStepProgress = () => {
    switch (currentStep) {
      case 'personal': return 25;
      case 'identity': return 50;
      case 'verification': return 75;
      case 'review': return 100;
    }
  };
  
  const getStepTitle = () => {
    switch (currentStep) {
      case 'personal': return 'Personal Information';
      case 'identity': return 'Identity Verification';
      case 'verification': return 'Document Verification';
      case 'review': return 'Review & Submit';
    }
  };
  
  const renderPersonalInfoStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <Text style={styles.sectionDescription}>
          Please provide your personal details as they appear on your official documents.
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
            <User size={20} color={colors.textSecondary} />
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
            />
          </View>
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <View style={[styles.inputContainer, errors.lastName && styles.inputError]}>
            <User size={20} color={colors.textSecondary} />
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
            />
          </View>
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Middle Name (Optional)</Text>
          <View style={styles.inputContainer}>
            <User size={20} color={colors.textSecondary} />
            <TextInput
              ref={middleNameInputRef}
              style={styles.input}
              placeholder="Enter your middle name"
              placeholderTextColor={colors.textTertiary}
              value={middleName}
              onChangeText={setMiddleName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => dobInputRef.current?.focus()}
            />
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date of Birth</Text>
          <View style={[styles.inputContainer, errors.dateOfBirth && styles.inputError]}>
            <Calendar size={20} color={colors.textSecondary} />
            <TextInput
              ref={dobInputRef}
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.textTertiary}
              value={dateOfBirth}
              onChangeText={handleDateChange}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => phoneInputRef.current?.focus()}
            />
          </View>
          {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
            <User size={20} color={colors.textSecondary} />
            <TextInput
              ref={phoneInputRef}
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.textTertiary}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setErrors(prev => ({ ...prev, phoneNumber: '' }));
              }}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => addressInputRef.current?.focus()}
            />
          </View>
          {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Residential Address</Text>
          <View style={[styles.inputContainer, errors.address && styles.inputError]}>
            <User size={20} color={colors.textSecondary} />
            <TextInput
              ref={addressInputRef}
              style={styles.input}
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
              style={[styles.input, styles.multilineInput]}
            />
          </View>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>
        
        <View style={styles.infoContainer}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your personal information is securely stored and will only be used for verification purposes.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderIdentityStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Identity Verification</Text>
        <Text style={styles.sectionDescription}>
          Please select a verification method and provide the required information.
        </Text>
        
        <View style={styles.identityOptions}>
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'bvn' && styles.selectedIdentityOption
            ]}
            onPress={() => setSelectedIdentityType('bvn')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={24} color={selectedIdentityType === 'bvn' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'bvn' && styles.selectedIdentityTitle
              ]}>BVN</Text>
            </View>
            <Text style={styles.identityDescription}>Bank Verification Number</Text>
            {selectedIdentityType === 'bvn' && (
              <View style={styles.checkmark}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'nin' && styles.selectedIdentityOption
            ]}
            onPress={() => setSelectedIdentityType('nin')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={24} color={selectedIdentityType === 'nin' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'nin' && styles.selectedIdentityTitle
              ]}>NIN</Text>
            </View>
            <Text style={styles.identityDescription}>National Identification Number</Text>
            {selectedIdentityType === 'nin' && (
              <View style={styles.checkmark}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'passport' && styles.selectedIdentityOption
            ]}
            onPress={() => setSelectedIdentityType('passport')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={24} color={selectedIdentityType === 'passport' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'passport' && styles.selectedIdentityTitle
              ]}>Passport</Text>
            </View>
            <Text style={styles.identityDescription}>International Passport</Text>
            {selectedIdentityType === 'passport' && (
              <View style={styles.checkmark}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'drivers_license' && styles.selectedIdentityOption
            ]}
            onPress={() => setSelectedIdentityType('drivers_license')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={24} color={selectedIdentityType === 'drivers_license' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'drivers_license' && styles.selectedIdentityTitle
              ]}>Driver's License</Text>
            </View>
            <Text style={styles.identityDescription}>Driver's License Number</Text>
            {selectedIdentityType === 'drivers_license' && (
              <View style={styles.checkmark}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        </View>
        
        {selectedIdentityType === 'bvn' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Verification Number (BVN)</Text>
            <View style={[styles.inputContainer, errors.bvn && styles.inputError]}>
              <CreditCard size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your 11-digit BVN"
                placeholderTextColor={colors.textTertiary}
                value={bvn}
                onChangeText={(text) => {
                  // Only allow numbers and limit to 11 digits
                  const numericText = text.replace(/[^0-9]/g, '');
                  if (numericText.length <= 11) {
                    setBvn(numericText);
                    setErrors(prev => ({ ...prev, bvn: '' }));
                  }
                }}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>
            {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
            
            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your BVN is not stored and is only used for verification purposes.
              </Text>
            </View>
          </View>
        )}
        
        {selectedIdentityType === 'nin' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>National Identification Number (NIN)</Text>
            <View style={[styles.inputContainer, errors.nin && styles.inputError]}>
              <CreditCard size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your 11-digit NIN"
                placeholderTextColor={colors.textTertiary}
                value={nin}
                onChangeText={(text) => {
                  // Only allow numbers and limit to 11 digits
                  const numericText = text.replace(/[^0-9]/g, '');
                  if (numericText.length <= 11) {
                    setNin(numericText);
                    setErrors(prev => ({ ...prev, nin: '' }));
                  }
                }}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>
            {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
            
            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your NIN is not stored and is only used for verification purposes.
              </Text>
            </View>
          </View>
        )}
        
        {selectedIdentityType === 'passport' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>International Passport Number</Text>
            <View style={[styles.inputContainer, errors.passportNumber && styles.inputError]}>
              <CreditCard size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your passport number"
                placeholderTextColor={colors.textTertiary}
                value={passportNumber}
                onChangeText={(text) => {
                  setPassportNumber(text);
                  setErrors(prev => ({ ...prev, passportNumber: '' }));
                }}
                autoCapitalize="characters"
              />
            </View>
            {errors.passportNumber && <Text style={styles.errorText}>{errors.passportNumber}</Text>}
          </View>
        )}
        
        {selectedIdentityType === 'drivers_license' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Driver's License Number</Text>
            <View style={[styles.inputContainer, errors.driversLicense && styles.inputError]}>
              <CreditCard size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your driver's license number"
                placeholderTextColor={colors.textTertiary}
                value={driversLicense}
                onChangeText={(text) => {
                  setDriversLicense(text);
                  setErrors(prev => ({ ...prev, driversLicense: '' }));
                }}
                autoCapitalize="characters"
              />
            </View>
            {errors.driversLicense && <Text style={styles.errorText}>{errors.driversLicense}</Text>}
          </View>
        )}
      </View>
    );
  };
  
  const renderVerificationStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Document Verification</Text>
        <Text style={styles.sectionDescription}>
          Please upload the required documents for verification.
        </Text>
        
        <View style={styles.documentSection}>
          <Text style={styles.documentTitle}>Required Documents</Text>
          
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentName}>Proof of Identity</Text>
              <View style={styles.documentStatus}>
                <Text style={styles.documentStatusText}>Required</Text>
              </View>
            </View>
            <Text style={styles.documentDescription}>
              Upload a clear photo of your government-issued ID (National ID, Passport, Driver's License)
            </Text>
            <Pressable style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>Upload Document</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          </View>
          
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentName}>Proof of Address</Text>
              <View style={styles.documentStatus}>
                <Text style={styles.documentStatusText}>Required</Text>
              </View>
            </View>
            <Text style={styles.documentDescription}>
              Upload a utility bill or bank statement from the last 3 months showing your name and address
            </Text>
            <Pressable style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>Upload Document</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          </View>
          
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentName}>Selfie Verification</Text>
              <View style={styles.documentStatus}>
                <Text style={styles.documentStatusText}>Required</Text>
              </View>
            </View>
            <Text style={styles.documentDescription}>
              Take a clear selfie holding your ID document
            </Text>
            <Pressable style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>Take Selfie</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          <Shield size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your documents are securely encrypted and will only be used for verification purposes. They will be deleted after verification is complete.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderReviewStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Review Your Information</Text>
        <Text style={styles.sectionDescription}>
          Please review your information before submitting.
        </Text>
        
        <View style={styles.reviewSection}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Personal Information</Text>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Full Name</Text>
              <Text style={styles.reviewValue}>
                {firstName} {middleName ? `${middleName} ` : ''}{lastName}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Date of Birth</Text>
              <Text style={styles.reviewValue}>{dateOfBirth || 'Not provided'}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Phone Number</Text>
              <Text style={styles.reviewValue}>{phoneNumber || 'Not provided'}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Address</Text>
              <Text style={styles.reviewValue}>{address || 'Not provided'}</Text>
            </View>
            
            <Pressable 
              style={styles.editButton}
              onPress={() => setCurrentStep('personal')}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
          
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Identity Information</Text>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Verification Method</Text>
              <Text style={styles.reviewValue}>
                {selectedIdentityType === 'bvn' ? 'Bank Verification Number (BVN)' :
                 selectedIdentityType === 'nin' ? 'National Identification Number (NIN)' :
                 selectedIdentityType === 'passport' ? 'International Passport' :
                 'Driver\'s License'}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>
                {selectedIdentityType === 'bvn' ? 'BVN' :
                 selectedIdentityType === 'nin' ? 'NIN' :
                 selectedIdentityType === 'passport' ? 'Passport Number' :
                 'License Number'}
              </Text>
              <Text style={styles.reviewValue}>
                {selectedIdentityType === 'bvn' ? bvn :
                 selectedIdentityType === 'nin' ? nin :
                 selectedIdentityType === 'passport' ? passportNumber :
                 driversLicense || 'Not provided'}
              </Text>
            </View>
            
            <Pressable 
              style={styles.editButton}
              onPress={() => setCurrentStep('identity')}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
          
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Documents</Text>
            <Text style={styles.reviewValue}>
              Documents have been uploaded and are ready for verification.
            </Text>
            
            <Pressable 
              style={styles.editButton}
              onPress={() => setCurrentStep('verification')}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
        </View>
        
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By submitting this information, you confirm that all details provided are accurate and complete. You authorize Planmoni to verify your identity using the information provided.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'personal':
        return renderPersonalInfoStep();
      case 'identity':
        return renderIdentityStep();
      case 'verification':
        return renderVerificationStep();
      case 'review':
        return renderReviewStep();
    }
  };
  
  const styles = StyleSheet.create({
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
      backgroundColor: colors.primary,
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
    formContainer: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
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
      height: 56,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
    },
    multilineInput: {
      height: 100,
      textAlignVertical: 'top',
      paddingTop: 16,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    infoContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 12,
      flex: 1,
      lineHeight: 20,
    },
    identityOptions: {
      marginBottom: 24,
    },
    identityOption: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      position: 'relative',
    },
    selectedIdentityOption: {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundTertiary,
    },
    identityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    identityTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 12,
    },
    selectedIdentityTitle: {
      color: colors.primary,
    },
    identityDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    checkmark: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    documentSection: {
      marginBottom: 24,
    },
    documentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    documentCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    documentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    documentName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    documentStatus: {
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    documentStatusText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
    documentDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
      marginRight: 8,
    },
    reviewSection: {
      marginBottom: 24,
    },
    reviewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    reviewSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    reviewItem: {
      marginBottom: 12,
    },
    reviewLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    reviewValue: {
      fontSize: 16,
      color: colors.text,
    },
    editButton: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 6,
    },
    editButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    termsContainer: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    termsText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handlePreviousStep} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account Verification</Text>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getStepProgress()}%` }]} />
        </View>
        <Text style={styles.stepText}>{getStepTitle()}</Text>
      </View>
      
      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        {renderCurrentStep()}
      </KeyboardAvoidingWrapper>
      
      <FloatingButton 
        title={currentStep === 'review' ? 'Submit Verification' : 'Continue'}
        onPress={handleNextStep}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}