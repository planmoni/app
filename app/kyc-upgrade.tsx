import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, User, Calendar, Info, Lock, ChevronRight, Check, CreditCard, Camera, Upload, MapPin, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useWindowDimensions } from 'react-native';

type KYCStep = 'personal' | 'bvn_verification' | 'id_face_match' | 'address_details' | 'review';
type IdentityType = 'bvn' | 'nin' | 'passport' | 'drivers_license';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { session } = useAuth();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Step management
  const [currentStep, setCurrentStep] = useState<KYCStep>('personal');
  
  // Identity verification
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>('bvn');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isResolvingBvn, setIsResolvingBvn] = useState(false);
  const [isVerifyingDocuments, setIsVerifyingDocuments] = useState(false);
  
  // Verification status
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [bvnVerified, setBvnVerified] = useState(false);
  const [documentsVerified, setDocumentsVerified] = useState(false);
  
  // Personal information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  
  // Address details
  const [lga, setLga] = useState('');
  const [state, setState] = useState('');
  const [utilityBill, setUtilityBill] = useState<string | null>(null);
  
  // Identity information
  const [bvn, setBvn] = useState('');
  const [bvnMatchedName, setBvnMatchedName] = useState('');
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
      
      if (!session?.access_token) {
        console.error('No access token available');
        showToast('Authentication required', 'error');
        return;
      }
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      console.log('Response status:', response.status);
      console.log('Response content-type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Expected JSON but received:', contentType);
        console.error('Response body:', text.substring(0, 500));
        throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. This usually means the API endpoint is not available or returning an error page.`);
      }
      
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data.overallStatus);
        
        // If user is already verified, show appropriate message
        if (data.overallStatus === 'fully_verified') {
          showToast('Your account is already fully verified', 'success');
          setCurrentStep('review');
        } else if (data.overallStatus === 'partially_verified') {
          showToast('Your identity is verified. Please complete document verification', 'info');
          setBvnVerified(true);
          setCurrentStep('id_face_match');
        }
      } else {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Show a more user-friendly error message
      if (errorMessage.includes('JSON') || errorMessage.includes('content type')) {
        showToast('KYC service is temporarily unavailable. Please try again later.', 'error');
      } else {
        showToast('Failed to fetch verification status', 'error');
      }
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
  
  const validateBvnVerification = () => {
    const newErrors: Record<string, string> = {};
    
    if (!bvn.trim()) {
      newErrors.bvn = 'BVN is required';
    } else if (bvn.length !== 11 || !/^\d+$/.test(bvn)) {
      newErrors.bvn = 'BVN must be 11 digits';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };
  
  const validateIdFaceMatch = () => {
    const newErrors: Record<string, string> = {};
    
    switch (selectedIdentityType) {
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
    
    if (!documentFrontImage) {
      newErrors.documentFront = 'Front of document is required';
    }
    
    if ((selectedIdentityType === 'passport' || selectedIdentityType === 'drivers_license') && !documentBackImage) {
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
  
  const validateAddressDetails = () => {
    const newErrors: Record<string, string> = {};
    
    if (!address.trim()) newErrors.address = 'Address is required';
    if (!lga.trim()) newErrors.lga = 'Local Government Area is required';
    if (!state.trim()) newErrors.state = 'State is required';
    
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
          setCurrentStep('bvn_verification');
        }
        break;
      case 'bvn_verification':
        if (validateBvnVerification()) {
          // Verify BVN with Dojah
          await verifyBvn();
        }
        break;
      case 'id_face_match':
        if (validateIdFaceMatch()) {
          // Verify documents with Dojah
          await verifyDocuments();
        }
        break;
      case 'address_details':
        if (validateAddressDetails()) {
          setCurrentStep('review');
        }
        break;
      case 'review':
        await handleSubmit();
        break;
    }
  };
  
  const verifyBvn = async () => {
    try {
      setIsResolvingBvn(true);
      setErrors({});
      
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationType: 'bvn',
          verificationData: { bvn }
        })
      });
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('BVN verification - Expected JSON but received:', contentType);
        console.error('Response body:', text.substring(0, 500));
        throw new Error('KYC service is temporarily unavailable. Please try again later.');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'BVN verification failed');
      }
      
      const data = await response.json();
      
      // Check if verification was successful
      if (data.status === 'success') {
        setBvnVerified(true);
        
        // If we have a name from the BVN verification, store it
        if (data.data && data.data.firstName && data.data.lastName) {
          setBvnMatchedName(`${data.data.firstName} ${data.data.lastName}`);
          showToast('BVN matched! Let\'s continue.', 'success');
        } else {
          setBvnMatchedName('Verified');
          showToast('BVN verified successfully', 'success');
        }
        
        // Move to next step
        setCurrentStep('id_face_match');
      } else {
        throw new Error('BVN verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
      showToast(errorMessage, 'error');
      setErrors({ bvn: errorMessage });
    } finally {
      setIsResolvingBvn(false);
    }
  };
  
  const verifyDocuments = async () => {
    try {
      setIsVerifyingDocuments(true);
      setErrors({});
      
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // In a real app, you would upload the images to a storage service
      // and then send the URLs to the Dojah API
      
      const response = await fetch('/api/dojah-kyc', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentType: selectedIdentityType,
          documentImage: documentFrontImage,
          selfieImage
        })
      });
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Document verification - Expected JSON but received:', contentType);
        console.error('Response body:', text.substring(0, 500));
        throw new Error('KYC service is temporarily unavailable. Please try again later.');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Document verification failed');
      }
      
      const data = await response.json();
      
      // Check if verification was successful
      if (data.status === 'success') {
        setDocumentsVerified(true);
        showToast('Documents verified successfully', 'success');
        
        // Move to next step
        setCurrentStep('address_details');
      } else {
        throw new Error('Document verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Document verification failed';
      showToast(errorMessage, 'error');
      setErrors({ documentVerification: errorMessage });
    } finally {
      setIsVerifyingDocuments(false);
    }
  };
  
  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'bvn_verification':
        setCurrentStep('personal');
        break;
      case 'id_face_match':
        setCurrentStep('bvn_verification');
        break;
      case 'address_details':
        setCurrentStep('id_face_match');
        break;
      case 'review':
        setCurrentStep('address_details');
        break;
      default:
        router.back();
    }
  };
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // Fetch final verification status
      const response = await fetch('/api/dojah-kyc', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Final verification check - Expected JSON but received:', contentType);
        console.error('Response body:', text.substring(0, 500));
        throw new Error('KYC service is temporarily unavailable. Please try again later.');
      }
      
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete verification. Please try again.';
      showToast(errorMessage, 'error');
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
      case 'personal': return 20;
      case 'bvn_verification': return 40;
      case 'id_face_match': return 60;
      case 'address_details': return 80;
      case 'review': return 100;
    }
  };
  
  const getStepTitle = () => {
    switch (currentStep) {
      case 'personal': return 'Personal Information';
      case 'bvn_verification': return 'BVN Verification';
      case 'id_face_match': return 'ID & Face Verification';
      case 'address_details': return 'Address Details';
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
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              ref={addressInputRef}
              style={[styles.input, styles.multilineInput]}
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
          <Info size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your personal information is securely stored and will only be used for verification purposes.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderBvnVerificationStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>BVN Verification</Text>
        <Text style={styles.sectionDescription}>
          Please enter your Bank Verification Number (BVN) for identity verification.
        </Text>
        
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
              editable={!isResolvingBvn && !bvnVerified}
            />
            {isResolvingBvn && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.activityIndicator} />
            )}
            {bvnVerified && (
              <View style={styles.verifiedBadge}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
          
          {bvnVerified && bvnMatchedName && (
            <View style={styles.matchedNameContainer}>
              <Check size={16} color={colors.success} />
              <Text style={styles.matchedNameText}>
                BVN matched! Name: {bvnMatchedName}
              </Text>
            </View>
          )}
          
          <View style={styles.infoContainer}>
            <Info size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Your BVN is not stored and is only used for verification purposes. This helps us confirm your identity and protect your account.
            </Text>
          </View>
        </View>
      </View>
    );
  };
  
  const renderIDFaceMatchStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>ID & Face Verification</Text>
        <Text style={styles.sectionDescription}>
          Please provide a government-issued ID and take a selfie for verification.
        </Text>
        
        {!bvnVerified && (
          <View style={styles.warningContainer}>
            <Info size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              You must complete BVN verification before proceeding with ID verification.
            </Text>
          </View>
        )}
        
        <View style={styles.idTypeSelector}>
          <Text style={styles.label}>Select ID Type</Text>
          <View style={styles.idOptions}>
            <Pressable
              style={[
                styles.idOption,
                selectedIdentityType === 'nin' && styles.selectedIdOption
              ]}
              onPress={() => {
                setSelectedIdentityType('nin');
                setErrors({});
              }}
              disabled={isVerifyingDocuments || documentsVerified}
            >
              <Text style={[
                styles.idOptionText,
                selectedIdentityType === 'nin' && styles.selectedIdOptionText
              ]}>NIN</Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.idOption,
                selectedIdentityType === 'passport' && styles.selectedIdOption
              ]}
              onPress={() => {
                setSelectedIdentityType('passport');
                setErrors({});
              }}
              disabled={isVerifyingDocuments || documentsVerified}
            >
              <Text style={[
                styles.idOptionText,
                selectedIdentityType === 'passport' && styles.selectedIdOptionText
              ]}>Passport</Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.idOption,
                selectedIdentityType === 'drivers_license' && styles.selectedIdOption
              ]}
              onPress={() => {
                setSelectedIdentityType('drivers_license');
                setErrors({});
              }}
              disabled={isVerifyingDocuments || documentsVerified}
            >
              <Text style={[
                styles.idOptionText,
                selectedIdentityType === 'drivers_license' && styles.selectedIdOptionText
              ]}>Driver's License</Text>
            </Pressable>
          </View>
        </View>
        
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
                editable={!isVerifyingDocuments && !documentsVerified}
              />
            </View>
            {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
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
                editable={!isVerifyingDocuments && !documentsVerified}
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
                editable={!isVerifyingDocuments && !documentsVerified}
              />
            </View>
            {errors.driversLicense && <Text style={styles.errorText}>{errors.driversLicense}</Text>}
          </View>
        )}
        
        <View style={styles.documentSection}>
          <Text style={styles.documentSectionTitle}>Document Upload</Text>
          
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentName}>Front of ID</Text>
              <View style={styles.documentStatus}>
                <Text style={styles.documentStatusText}>Required</Text>
              </View>
            </View>
            <Text style={styles.documentDescription}>
              Upload a clear photo of the front of your {
                selectedIdentityType === 'nin' ? 'NIN slip' :
                selectedIdentityType === 'passport' ? 'passport' : 'driver\'s license'
              }
            </Text>
            
            {documentFrontImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: documentFrontImage }} 
                  style={styles.imagePreview} 
                  resizeMode="cover"
                />
                <Pressable 
                  style={styles.retakeButton}
                  onPress={() => setDocumentFrontImage(null)}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.documentActions}>
                <Pressable 
                  style={styles.documentButton}
                  onPress={() => pickImage(setDocumentFrontImage, 'documentFront')}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload</Text>
                </Pressable>
                
                <Pressable 
                  style={styles.documentButton}
                  onPress={() => takePicture(setDocumentFrontImage, 'documentFront')}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Camera size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Take Photo</Text>
                </Pressable>
              </View>
            )}
            {errors.documentFront && <Text style={styles.errorText}>{errors.documentFront}</Text>}
          </View>
          
          {(selectedIdentityType === 'passport' || selectedIdentityType === 'drivers_license') && (
            <View style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <Text style={styles.documentName}>Back of ID</Text>
                <View style={styles.documentStatus}>
                  <Text style={styles.documentStatusText}>Required</Text>
                </View>
              </View>
              <Text style={styles.documentDescription}>
                Upload a clear photo of the back of your {
                  selectedIdentityType === 'passport' ? 'passport' : 'driver\'s license'
                }
              </Text>
              
              {documentBackImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: documentBackImage }} 
                    style={styles.imagePreview} 
                    resizeMode="cover"
                  />
                  <Pressable 
                    style={styles.retakeButton}
                    onPress={() => setDocumentBackImage(null)}
                    disabled={isVerifyingDocuments || documentsVerified}
                  >
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.documentActions}>
                  <Pressable 
                    style={styles.documentButton}
                    onPress={() => pickImage(setDocumentBackImage, 'documentBack')}
                    disabled={isVerifyingDocuments || documentsVerified}
                  >
                    <Upload size={16} color={colors.primary} />
                    <Text style={styles.documentButtonText}>Upload</Text>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.documentButton}
                    onPress={() => takePicture(setDocumentBackImage, 'documentBack')}
                    disabled={isVerifyingDocuments || documentsVerified}
                  >
                    <Camera size={16} color={colors.primary} />
                    <Text style={styles.documentButtonText}>Take Photo</Text>
                  </Pressable>
                </View>
              )}
              {errors.documentBack && <Text style={styles.errorText}>{errors.documentBack}</Text>}
            </View>
          )}
          
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentName}>Selfie Verification</Text>
              <View style={styles.documentStatus}>
                <Text style={styles.documentStatusText}>Required</Text>
              </View>
            </View>
            <Text style={styles.documentDescription}>
              Take a clear selfie showing your face. Look straight at the camera with neutral expression.
            </Text>
            
            {selfieImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: selfieImage }} 
                  style={styles.imagePreview} 
                  resizeMode="cover"
                />
                <Pressable 
                  style={styles.retakeButton}
                  onPress={() => setSelfieImage(null)}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.documentActions}>
                <Pressable 
                  style={styles.documentButton}
                  onPress={() => pickImage(setSelfieImage, 'selfie')}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Upload</Text>
                </Pressable>
                
                <Pressable 
                  style={styles.documentButton}
                  onPress={() => takePicture(setSelfieImage, 'selfie')}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Camera size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Take Selfie</Text>
                </Pressable>
              </View>
            )}
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}
          </View>
        </View>
        
        {errors.documentVerification && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errors.documentVerification}</Text>
          </View>
        )}
        
        <View style={styles.infoContainer}>
          <Shield size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your documents are securely encrypted and will only be used for verification purposes. They will be deleted after verification is complete.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderAddressDetailsStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Address Details</Text>
        <Text style={styles.sectionDescription}>
          Please confirm your residential address and provide additional details.
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Residential Address</Text>
          <View style={[styles.inputContainer, errors.address && styles.inputError]}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, styles.multilineInput]}
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
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Local Government Area (LGA)</Text>
          <View style={[styles.inputContainer, errors.lga && styles.inputError]}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter your LGA"
              placeholderTextColor={colors.textTertiary}
              value={lga}
              onChangeText={(text) => {
                setLga(text);
                setErrors(prev => ({ ...prev, lga: '' }));
              }}
            />
          </View>
          {errors.lga && <Text style={styles.errorText}>{errors.lga}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>State</Text>
          <View style={[styles.inputContainer, errors.state && styles.inputError]}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter your state"
              placeholderTextColor={colors.textTertiary}
              value={state}
              onChangeText={(text) => {
                setState(text);
                setErrors(prev => ({ ...prev, state: '' }));
              }}
            />
          </View>
          {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
        </View>
        
        <View style={styles.documentCard}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentName}>Utility Bill (Optional for Tier 3)</Text>
            <View style={[styles.documentStatus, styles.optionalStatus]}>
              <Text style={styles.optionalStatusText}>Optional</Text>
            </View>
          </View>
          <Text style={styles.documentDescription}>
            Upload a recent utility bill (electricity, water, etc.) for Tier 3 verification.
          </Text>
          
          {utilityBill ? (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: utilityBill }} 
                style={styles.imagePreview} 
                resizeMode="cover"
              />
              <Pressable 
                style={styles.retakeButton}
                onPress={() => setUtilityBill(null)}
              >
                <Text style={styles.retakeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.documentActions}>
              <Pressable 
                style={styles.documentButton}
                onPress={() => pickImage(setUtilityBill, 'utilityBill')}
              >
                <Upload size={16} color={colors.primary} />
                <Text style={styles.documentButtonText}>Upload</Text>
              </Pressable>
              
              <Pressable 
                style={styles.documentButton}
                onPress={() => takePicture(setUtilityBill, 'utilityBill')}
              >
                <Camera size={16} color={colors.primary} />
                <Text style={styles.documentButtonText}>Take Photo</Text>
              </Pressable>
            </View>
          )}
        </View>
        
        <View style={styles.infoContainer}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your address information is used for verification purposes and to determine your transaction limits.
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
          </View>
          
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Identity Verification</Text>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>BVN</Text>
              <Text style={styles.reviewValue}>
                •••• •••• {bvn.slice(-3)} {bvnVerified && <Check size={16} color={colors.success} />}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>ID Type</Text>
              <Text style={styles.reviewValue}>
                {selectedIdentityType === 'nin' ? 'National ID (NIN)' :
                 selectedIdentityType === 'passport' ? 'International Passport' :
                 'Driver\'s License'}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>
                {selectedIdentityType === 'nin' ? 'NIN' :
                 selectedIdentityType === 'passport' ? 'Passport Number' :
                 'License Number'}
              </Text>
              <Text style={styles.reviewValue}>
                {selectedIdentityType === 'nin' ? nin :
                 selectedIdentityType === 'passport' ? passportNumber :
                 driversLicense || 'Not provided'}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Document Verification</Text>
              <Text style={[
                styles.reviewValue,
                documentsVerified ? styles.verifiedText : styles.pendingText
              ]}>
                {documentsVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          
          <View style={styles.reviewCard}>
            <Text style={styles.reviewSectionTitle}>Address Information</Text>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Residential Address</Text>
              <Text style={styles.reviewValue}>{address}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>LGA</Text>
              <Text style={styles.reviewValue}>{lga}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>State</Text>
              <Text style={styles.reviewValue}>{state}</Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Utility Bill</Text>
              <Text style={styles.reviewValue}>
                {utilityBill ? 'Uploaded' : 'Not provided (Optional for Tier 3)'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By submitting this information, I confirm that all details provided are accurate and complete. I authorize Planmoni to verify my identity using the information provided.
          </Text>
        </View>
      </View>
    );
  };
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'personal':
        return renderPersonalInfoStep();
      case 'bvn_verification':
        return renderBvnVerificationStep();
      case 'id_face_match':
        return renderIDFaceMatchStep();
      case 'address_details':
        return renderAddressDetailsStep();
      case 'review':
        return renderReviewStep();
    }
  };
  
  // Calculate responsive sizes
  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 20 : 24;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const labelSize = isSmallScreen ? 13 : 14;
  const inputHeight = isSmallScreen ? 50 : 56;
  
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
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    progressContainer: {
      padding: contentPadding,
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
      padding: contentPadding,
    },
    sectionTitle: {
      fontSize: titleSize,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: subtitleSize,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: subtitleSize * 1.5,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: labelSize,
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
      height: inputHeight,
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
      height: inputHeight * 2,
      textAlignVertical: 'top',
      paddingTop: 16,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      padding: 16,
      borderRadius: 12,
      marginTop: 16,
    },
    infoText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7',
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    warningText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.warning,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    activityIndicator: {
      marginLeft: 8,
    },
    verifiedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    matchedNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    matchedNameText: {
      fontSize: 14,
      color: colors.success,
      fontWeight: '500',
    },
    idTypeSelector: {
      marginBottom: 20,
    },
    idOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    idOption: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      minWidth: 100,
      alignItems: 'center',
    },
    selectedIdOption: {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundTertiary,
    },
    idOptionText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    selectedIdOptionText: {
      color: colors.primary,
    },
    documentSection: {
      marginBottom: 20,
    },
    documentSectionTitle: {
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
      marginBottom: 16,
    },
    documentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    documentName: {
      fontSize: 14,
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
    optionalStatus: {
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F1F5F9',
    },
    optionalStatusText: {
      color: colors.textSecondary,
    },
    documentDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
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
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    documentButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    imagePreviewContainer: {
      width: '100%',
      height: 200,
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
      fontSize: 12,
      fontWeight: '500',
    },
    reviewSection: {
      marginBottom: 24,
    },
    reviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
      flexDirection: 'row',
      alignItems: 'center',
    },
    verifiedText: {
      color: colors.success,
    },
    pendingText: {
      color: colors.warning,
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
    },
  });
  
  if (isLoading && !currentStep) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Account Verification</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        title={currentStep === 'review' ? "Submit Verification" : "Continue"}
        onPress={handleNextStep}
        disabled={
          isLoading || 
          isResolvingBvn || 
          isVerifyingDocuments || 
          (currentStep === 'bvn_verification' && bvnVerified) ||
          (currentStep === 'id_face_match' && documentsVerified)
        }
        loading={isLoading || isResolvingBvn || isVerifyingDocuments}
      />
    </SafeAreaView>
  );
}