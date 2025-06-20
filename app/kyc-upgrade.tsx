import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, User, Calendar, Info, Lock, ChevronRight, Check, CreditCard, Camera, Upload } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useWindowDimensions } from 'react-native';

type KYCStep = 'personal' | 'identity' | 'verification' | 'review';
type IdentityType = 'bvn' | 'nin' | 'passport' | 'drivers_license';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState<KYCStep>('personal');
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>('bvn');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
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
  
  // Document verification
  const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(null);
  const [documentBackImage, setDocumentBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  
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
    if (session?.user?.user_metadata) {
      const { first_name, last_name, phone } = session.user.user_metadata;
      if (first_name) setFirstName(first_name);
      if (last_name) setLastName(last_name);
      if (phone) setPhoneNumber(phone);
    }
    
    // Fetch current verification status
    fetchVerificationStatus();
  }, [session]);
  
  const fetchVerificationStatus = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data.overallStatus);
        
        // If user is already verified, show appropriate message
        if (data.overallStatus === 'fully_verified') {
          showToast('Your account is already fully verified', 'success');
        } else if (data.overallStatus === 'partially_verified') {
          showToast('Your identity is verified. Please complete document verification', 'info');
          setCurrentStep('verification');
        }
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
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
  
  const validateDocumentVerification = () => {
    const newErrors: Record<string, string> = {};
    
    if (!documentFrontImage) {
      newErrors.documentFront = 'Front of document is required';
    }
    
    if (selectedIdentityType !== 'bvn' && selectedIdentityType !== 'nin' && !documentBackImage) {
      newErrors.documentBack = 'Back of document is required';
    }
    
    if (!selfieImage) {
      newErrors.selfie = 'Selfie is required';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };
  
  const handleNextStep = async () => {
    switch (currentStep) {
      case 'personal':
        if (validatePersonalInfo()) {
          setCurrentStep('identity');
        }
        break;
      case 'identity':
        if (validateIdentityInfo()) {
          // Verify identity with Dojah
          await verifyIdentity();
        }
        break;
      case 'verification':
        if (validateDocumentVerification()) {
          // Verify documents with Dojah
          await verifyDocuments();
        }
        break;
      case 'review':
        await handleSubmit();
        break;
    }
  };
  
  const verifyIdentity = async () => {
    try {
      setIsLoading(true);
      
      let verificationData = {};
      
      switch (selectedIdentityType) {
        case 'bvn':
          verificationData = { bvn };
          break;
        case 'nin':
          verificationData = { nin };
          break;
        case 'passport':
          verificationData = { 
            passportNumber,
            firstName,
            lastName
          };
          break;
        case 'drivers_license':
          verificationData = { 
            licenseNumber: driversLicense,
            firstName,
            lastName
          };
          break;
      }
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationType: selectedIdentityType,
          verificationData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }
      
      const data = await response.json();
      
      showToast('Identity verified successfully', 'success');
      setCurrentStep('verification');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      showToast(errorMessage, 'error');
      console.error('Error verifying identity:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const verifyDocuments = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, you would upload the images to a storage service
      // and then send the URLs to the Dojah API
      // For this demo, we'll simulate a successful verification
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentType: selectedIdentityType,
          documentImage: documentFrontImage,
          selfieImage
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Document verification failed');
      }
      
      const data = await response.json();
      
      showToast('Documents verified successfully', 'success');
      setCurrentStep('review');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Document verification failed';
      showToast(errorMessage, 'error');
      console.error('Error verifying documents:', error);
    } finally {
      setIsLoading(false);
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
      // Fetch final verification status
      const response = await fetch('/api/dojah-kyc', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get verification status');
      }
      
      const data = await response.json();
      
      if (data.overallStatus === 'fully_verified') {
        showToast('Verification completed successfully!', 'success');
        router.replace('/(tabs)');
      } else {
        showToast('Verification is still in progress. We will notify you once completed.', 'info');
        router.replace('/(tabs)');
      }
    } catch (error) {
      showToast('Failed to complete verification. Please try again.', 'error');
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
  
  const pickImage = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showToast('Permission to access media library is required', 'error');
      return;
    }
    
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
          setImageFunction(`data:image/jpeg;base64,${asset.base64}`);
          setErrors(prev => ({ ...prev, [type]: '' }));
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };
  
  const takePicture = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    // Request permissions
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
          setImageFunction(`data:image/jpeg;base64,${asset.base64}`);
          setErrors(prev => ({ ...prev, [type]: '' }));
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
    }
  };
  
  const renderPersonalInfoStep = () => {
    // Calculate responsive sizes
    const inputHeight = isSmallScreen ? 50 : 56;
    const iconSize = isSmallScreen ? 18 : 20;
    const fontSize = isSmallScreen ? 14 : 16;
    const labelSize = isSmallScreen ? 13 : 14;
    const spacing = isSmallScreen ? 16 : 20;
    
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <Text style={styles.sectionDescription}>
          Please provide your personal details as they appear on your official documents.
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
            <User size={iconSize} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { height: inputHeight, fontSize }]}
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
            <User size={iconSize} color={colors.textSecondary} />
            <TextInput
              ref={lastNameInputRef}
              style={[styles.input, { height: inputHeight, fontSize }]}
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
            <User size={iconSize} color={colors.textSecondary} />
            <TextInput
              ref={middleNameInputRef}
              style={[styles.input, { height: inputHeight, fontSize }]}
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
            <Calendar size={iconSize} color={colors.textSecondary} />
            <TextInput
              ref={dobInputRef}
              style={[styles.input, { height: inputHeight, fontSize }]}
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
            <User size={iconSize} color={colors.textSecondary} />
            <TextInput
              ref={phoneInputRef}
              style={[styles.input, { height: inputHeight, fontSize }]}
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
            <User size={iconSize} color={colors.textSecondary} />
            <TextInput
              ref={addressInputRef}
              style={[styles.input, styles.multilineInput, { fontSize }]}
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
        
        <View style={styles.infoContainer}>
          <Info size={iconSize} color={colors.primary} />
          <Text style={[styles.infoText, { fontSize: isSmallScreen ? 13 : 14 }]}>
            Your personal information is securely stored and will only be used for verification purposes.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderIdentityStep = () => {
    // Calculate responsive sizes
    const iconSize = isSmallScreen ? 18 : 20;
    const cardPadding = isSmallScreen ? 12 : 16;
    const fontSize = isSmallScreen ? 14 : 16;
    const descSize = isSmallScreen ? 13 : 14;
    
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
              selectedIdentityType === 'bvn' && styles.selectedIdentityOption,
              { padding: cardPadding }
            ]}
            onPress={() => setSelectedIdentityType('bvn')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={iconSize} color={selectedIdentityType === 'bvn' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'bvn' && styles.selectedIdentityTitle,
                { fontSize }
              ]}>BVN</Text>
            </View>
            <Text style={[styles.identityDescription, { fontSize: descSize }]}>Bank Verification Number</Text>
            {selectedIdentityType === 'bvn' && (
              <View style={styles.checkmark}>
                <Check size={isSmallScreen ? 14 : 16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'nin' && styles.selectedIdentityOption,
              { padding: cardPadding }
            ]}
            onPress={() => setSelectedIdentityType('nin')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={iconSize} color={selectedIdentityType === 'nin' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'nin' && styles.selectedIdentityTitle,
                { fontSize }
              ]}>NIN</Text>
            </View>
            <Text style={[styles.identityDescription, { fontSize: descSize }]}>National Identification Number</Text>
            {selectedIdentityType === 'nin' && (
              <View style={styles.checkmark}>
                <Check size={isSmallScreen ? 14 : 16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'passport' && styles.selectedIdentityOption,
              { padding: cardPadding }
            ]}
            onPress={() => setSelectedIdentityType('passport')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={iconSize} color={selectedIdentityType === 'passport' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'passport' && styles.selectedIdentityTitle,
                { fontSize }
              ]}>Passport</Text>
            </View>
            <Text style={[styles.identityDescription, { fontSize: descSize }]}>International Passport</Text>
            {selectedIdentityType === 'passport' && (
              <View style={styles.checkmark}>
                <Check size={isSmallScreen ? 14 : 16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.identityOption,
              selectedIdentityType === 'drivers_license' && styles.selectedIdentityOption,
              { padding: cardPadding }
            ]}
            onPress={() => setSelectedIdentityType('drivers_license')}
          >
            <View style={styles.identityHeader}>
              <CreditCard size={iconSize} color={selectedIdentityType === 'drivers_license' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.identityTitle,
                selectedIdentityType === 'drivers_license' && styles.selectedIdentityTitle,
                { fontSize }
              ]}>Driver's License</Text>
            </View>
            <Text style={[styles.identityDescription, { fontSize: descSize }]}>Driver's License Number</Text>
            {selectedIdentityType === 'drivers_license' && (
              <View style={styles.checkmark}>
                <Check size={isSmallScreen ? 14 : 16} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        </View>
        
        {selectedIdentityType === 'bvn' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Verification Number (BVN)</Text>
            <View style={[styles.inputContainer, errors.bvn && styles.inputError]}>
              <CreditCard size={iconSize} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { fontSize }]}
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
              <Info size={iconSize} color={colors.primary} />
              <Text style={[styles.infoText, { fontSize: descSize }]}>
                Your BVN is not stored and is only used for verification purposes.
              </Text>
            </View>
          </View>
        )}
        
        {selectedIdentityType === 'nin' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>National Identification Number (NIN)</Text>
            <View style={[styles.inputContainer, errors.nin && styles.inputError]}>
              <CreditCard size={iconSize} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { fontSize }]}
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
              <Info size={iconSize} color={colors.primary} />
              <Text style={[styles.infoText, { fontSize: descSize }]}>
                Your NIN is not stored and is only used for verification purposes.
              </Text>
            </View>
          </View>
        )}
        
        {selectedIdentityType === 'passport' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>International Passport Number</Text>
            <View style={[styles.inputContainer, errors.passportNumber && styles.inputError]}>
              <CreditCard size={iconSize} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { fontSize }]}
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
              <CreditCard size={iconSize} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { fontSize }]}
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
    // Calculate responsive sizes
    const iconSize = isSmallScreen ? 18 : 20;
    const cardPadding = isSmallScreen ? 12 : 16;
    const fontSize = isSmallScreen ? 14 : 16;
    const descSize = isSmallScreen ? 13 : 14;
    const buttonHeight = isSmallScreen ? 40 : 48;
    const imagePreviewHeight = isSmallScreen ? 150 : 200;
    
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Document Verification</Text>
        <Text style={styles.sectionDescription}>
          Please upload the required documents for verification.
        </Text>
        
        <View style={styles.documentSection}>
          <Text style={[styles.documentTitle, { fontSize }]}>Required Documents</Text>
          
          <View style={[styles.documentCard, { padding: cardPadding }]}>
            <View style={styles.documentHeader}>
              <Text style={[styles.documentName, { fontSize }]}>Front of ID</Text>
              <View style={styles.documentStatus}>
                <Text style={[styles.documentStatusText, { fontSize: isSmallScreen ? 11 : 12 }]}>Required</Text>
              </View>
            </View>
            <Text style={[styles.documentDescription, { fontSize: descSize }]}>
              Upload a clear photo of the front of your {
                selectedIdentityType === 'bvn' ? 'any government-issued ID' :
                selectedIdentityType === 'nin' ? 'NIN card' :
                selectedIdentityType === 'passport' ? 'passport' : 'driver\'s license'
              }
            </Text>
            
            {documentFrontImage ? (
              <View style={[styles.imagePreviewContainer, { height: imagePreviewHeight }]}>
                <Image 
                  source={{ uri: documentFrontImage }} 
                  style={styles.imagePreview} 
                  resizeMode="cover"
                />
                <Pressable 
                  style={styles.retakeButton}
                  onPress={() => setDocumentFrontImage(null)}
                >
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.documentActions}>
                <Pressable 
                  style={[styles.documentButton, { height: buttonHeight }]}
                  onPress={() => pickImage(setDocumentFrontImage, 'documentFront')}
                >
                  <Upload size={iconSize} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload</Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.documentButton, { height: buttonHeight }]}
                  onPress={() => takePicture(setDocumentFrontImage, 'documentFront')}
                >
                  <Camera size={iconSize} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Take Photo</Text>
                </Pressable>
              </View>
            )}
            {errors.documentFront && <Text style={styles.errorText}>{errors.documentFront}</Text>}
          </View>
          
          {(selectedIdentityType === 'passport' || selectedIdentityType === 'drivers_license') && (
            <View style={[styles.documentCard, { padding: cardPadding }]}>
              <View style={styles.documentHeader}>
                <Text style={[styles.documentName, { fontSize }]}>Back of ID</Text>
                <View style={styles.documentStatus}>
                  <Text style={[styles.documentStatusText, { fontSize: isSmallScreen ? 11 : 12 }]}>Required</Text>
                </View>
              </View>
              <Text style={[styles.documentDescription, { fontSize: descSize }]}>
                Upload a clear photo of the back of your {
                  selectedIdentityType === 'passport' ? 'passport' : 'driver\'s license'
                }
              </Text>
              
              {documentBackImage ? (
                <View style={[styles.imagePreviewContainer, { height: imagePreviewHeight }]}>
                  <Image 
                    source={{ uri: documentBackImage }} 
                    style={styles.imagePreview} 
                    resizeMode="cover"
                  />
                  <Pressable 
                    style={styles.retakeButton}
                    onPress={() => setDocumentBackImage(null)}
                  >
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.documentActions}>
                  <Pressable 
                    style={[styles.documentButton, { height: buttonHeight }]}
                    onPress={() => pickImage(setDocumentBackImage, 'documentBack')}
                  >
                    <Upload size={iconSize} color={colors.primary} />
                    <Text style={styles.documentButtonText}>Upload</Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[styles.documentButton, { height: buttonHeight }]}
                    onPress={() => takePicture(setDocumentBackImage, 'documentBack')}
                  >
                    <Camera size={iconSize} color={colors.primary} />
                    <Text style={styles.documentButtonText}>Take Photo</Text>
                  </Pressable>
                </View>
              )}
              {errors.documentBack && <Text style={styles.errorText}>{errors.documentBack}</Text>}
            </View>
          )}
          
          <View style={[styles.documentCard, { padding: cardPadding }]}>
            <View style={styles.documentHeader}>
              <Text style={[styles.documentName, { fontSize }]}>Selfie Verification</Text>
              <View style={styles.documentStatus}>
                <Text style={[styles.documentStatusText, { fontSize: isSmallScreen ? 11 : 12 }]}>Required</Text>
              </View>
            </View>
            <Text style={[styles.documentDescription, { fontSize: descSize }]}>
              Take a clear selfie holding your ID document
            </Text>
            
            {selfieImage ? (
              <View style={[styles.imagePreviewContainer, { height: imagePreviewHeight }]}>
                <Image 
                  source={{ uri: selfieImage }} 
                  style={styles.imagePreview} 
                  resizeMode="cover"
                />
                <Pressable 
                  style={styles.retakeButton}
                  onPress={() => setSelfieImage(null)}
                >
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.documentActions}>
                <Pressable 
                  style={[styles.documentButton, { height: buttonHeight }]}
                  onPress={() => pickImage(setSelfieImage, 'selfie')}
                >
                  <Upload size={iconSize} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload</Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.documentButton, { height: buttonHeight }]}
                  onPress={() => takePicture(setSelfieImage, 'selfie')}
                >
                  <Camera size={iconSize} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Take Photo</Text>
                </Pressable>
              </View>
            )}
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          <Shield size={iconSize} color={colors.primary} />
          <Text style={[styles.infoText, { fontSize: descSize }]}>
            Your documents are securely encrypted and will only be used for verification purposes. They will be deleted after verification is complete.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderReviewStep = () => {
    // Calculate responsive sizes
    const cardPadding = isSmallScreen ? 12 : 16;
    const fontSize = isSmallScreen ? 14 : 16;
    const labelSize = isSmallScreen ? 13 : 14;
    const valueSize = isSmallScreen ? 14 : 16;
    const buttonSize = isSmallScreen ? 12 : 14;
    
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Review Your Information</Text>
        <Text style={styles.sectionDescription}>
          Please review your information before submitting.
        </Text>
        
        <View style={styles.reviewSection}>
          <View style={[styles.reviewCard, { padding: cardPadding }]}>
            <Text style={[styles.reviewSectionTitle, { fontSize }]}>Personal Information</Text>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>Full Name</Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>
                {firstName} {middleName ? `${middleName} ` : ''}{lastName}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>Date of Birth</Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>{dateOfBirth || 'Not provided'}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>Phone Number</Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>{phoneNumber || 'Not provided'}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>Address</Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>{address || 'Not provided'}</Text>
            </View>
            
            <Pressable 
              style={styles.editButton}
              onPress={() => setCurrentStep('personal')}
            >
              <Text style={[styles.editButtonText, { fontSize: buttonSize }]}>Edit</Text>
            </Pressable>
          </View>
          
          <View style={[styles.reviewCard, { padding: cardPadding }]}>
            <Text style={[styles.reviewSectionTitle, { fontSize }]}>Identity Information</Text>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>Verification Method</Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>
                {selectedIdentityType === 'bvn' ? 'Bank Verification Number (BVN)' :
                 selectedIdentityType === 'nin' ? 'National Identification Number (NIN)' :
                 selectedIdentityType === 'passport' ? 'International Passport' :
                 'Driver\'s License'}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { fontSize: labelSize }]}>
                {selectedIdentityType === 'bvn' ? 'BVN' :
                 selectedIdentityType === 'nin' ? 'NIN' :
                 selectedIdentityType === 'passport' ? 'Passport Number' :
                 'License Number'}
              </Text>
              <Text style={[styles.reviewValue, { fontSize: valueSize }]}>
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
              <Text style={[styles.editButtonText, { fontSize: buttonSize }]}>Edit</Text>
            </Pressable>
          </View>
          
          <View style={[styles.reviewCard, { padding: cardPadding }]}>
            <Text style={[styles.reviewSectionTitle, { fontSize }]}>Documents</Text>
            <Text style={[styles.reviewValue, { fontSize: valueSize }]}>
              Documents have been uploaded and are ready for verification.
            </Text>
            
            <Pressable 
              style={styles.editButton}
              onPress={() => setCurrentStep('verification')}
            >
              <Text style={[styles.editButtonText, { fontSize: buttonSize }]}>Edit</Text>
            </Pressable>
          </View>
        </View>
        
        <View style={styles.termsContainer}>
          <Text style={[styles.termsText, { fontSize: descSize }]}>
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
  
  // Calculate responsive header sizes
  const headerPadding = isSmallScreen ? 12 : 16;
  const headerHeight = isSmallScreen ? 56 : 64;
  const titleSize = isSmallScreen ? 18 : 20;
  const backButtonSize = isSmallScreen ? 36 : 40;
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: headerPadding,
      paddingVertical: headerPadding,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      height: headerHeight,
    },
    backButton: {
      width: backButtonSize,
      height: backButtonSize,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: titleSize,
      fontWeight: '600',
      color: colors.text,
    },
    progressContainer: {
      padding: isSmallScreen ? 16 : 20,
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
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginBottom: isSmallScreen ? 16 : 20,
    },
    scrollContent: {
      paddingBottom: 100, // Extra padding for the floating button
    },
    formContainer: {
      padding: isSmallScreen ? 16 : 20,
    },
    sectionTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: isSmallScreen ? 6 : 8,
    },
    sectionDescription: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginBottom: isSmallScreen ? 20 : 24,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    inputGroup: {
      marginBottom: isSmallScreen ? 16 : 20,
    },
    label: {
      fontSize: isSmallScreen ? 13 : 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: isSmallScreen ? 6 : 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      height: isSmallScreen ? 50 : 56,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.text,
      marginLeft: 12,
    },
    multilineInput: {
      height: isSmallScreen ? 14 : 16,
      textAlignVertical: 'center',
      paddingTop: 30,
    },
    errorText: {
      fontSize: isSmallScreen ? 11 : 12,
      color: colors.error,
      marginTop: 4,
    },
    infoContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: isSmallScreen ? 12 : 16,
      marginTop: 8,
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    infoText: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginLeft: 12,
      flex: 1,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    identityOptions: {
      marginBottom: isSmallScreen ? 20 : 24,
      gap: isSmallScreen ? 8 : 12,
    },
    identityOption: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
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
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 12,
    },
    selectedIdentityTitle: {
      color: colors.primary,
    },
    identityDescription: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
    },
    checkmark: {
      position: 'absolute',
      top: isSmallScreen ? 12 : 16,
      right: isSmallScreen ? 12 : 16,
      width: isSmallScreen ? 20 : 24,
      height: isSmallScreen ? 20 : 24,
      borderRadius: isSmallScreen ? 10 : 12,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    documentSection: {
      marginBottom: isSmallScreen ? 20 : 24,
      gap: isSmallScreen ? 12 : 16,
    },
    documentTitle: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: isSmallScreen ? 12 : 16,
    },
    documentCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
    },
    documentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    documentName: {
      fontSize: isSmallScreen ? 14 : 16,
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
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginBottom: isSmallScreen ? 12 : 16,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    documentActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    documentButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: isSmallScreen ? 10 : 12,
      paddingHorizontal: isSmallScreen ? 12 : 16,
    },
    documentButtonText: {
      fontSize: isSmallScreen ? 13 : 14,
      fontWeight: '500',
      color: colors.primary,
    },
    imagePreviewContainer: {
      width: '100%',
      height: isSmallScreen ? 150 : 200,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 12,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    retakeButton: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    retakeButtonText: {
      color: '#FFFFFF',
      fontSize: isSmallScreen ? 11 : 12,
      fontWeight: '500',
    },
    reviewSection: {
      marginBottom: isSmallScreen ? 20 : 24,
      gap: isSmallScreen ? 12 : 16,
    },
    reviewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
    },
    reviewSectionTitle: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: isSmallScreen ? 12 : 16,
    },
    reviewItem: {
      marginBottom: isSmallScreen ? 8 : 12,
    },
    reviewLabel: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    reviewValue: {
      fontSize: isSmallScreen ? 14 : 16,
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
      fontSize: isSmallScreen ? 12 : 14,
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
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      lineHeight: isSmallScreen ? 18 : 20,
    },
  });
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handlePreviousStep} style={styles.backButton}>
          <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
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