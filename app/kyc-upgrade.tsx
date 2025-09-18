import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Image, Platform, Modal, Animated } from 'react-native';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, User, Calendar, Info, Lock, ChevronRight, Check, CreditCard, Camera, Upload, MapPin, FileText, ChevronLeft, X } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useWindowDimensions } from 'react-native';
import LocationSearchModal from '@/components/LocationSearchModal';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';
import { useBanks, Bank } from '@/hooks/useBanks';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
type IdentityType = 'bvn' | 'nin' | 'passport' | 'drivers_license';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { session } = useAuth();
  const haptics = useHaptics();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Custom hooks for KYC data and progress
  const { formData, loading: formDataLoading, saveFormData } = useKYCData();
  const { progress, loading: progressLoading, updateProgress, getStepProgress } = useKYCProgress();
  const { banks, isLoading: banksLoading, error: banksError, refetch: refetchBanks } = useBanks();
  
  // Animation values for bank selection modal
  const bankListSlideAnim = useRef(new Animated.Value(height)).current;
  
  // Debug banks state
  useEffect(() => {
    console.log('KYC Upgrade - Banks state:', {
      banksCount: banks.length,
      banksLoading,
      banksError,
      banks: banks.slice(0, 3) // Log first 3 banks for debugging
    });
  }, [banks, banksLoading, banksError]);
  

  
  // Load form data when component mounts
  useEffect(() => {
    if (formData.bank_code && formData.bank_name) {
      setSelectedBank({
        id: 0, // We'll use the code to find the actual bank
        name: formData.bank_name,
        code: formData.bank_code,
        country: 'Nigeria',
        currency: 'NGN',
        type: 'nuban',
        is_active: true
      });
    }
  }, [formData.bank_code, formData.bank_name]);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<KYCStep>('personal');
  
  // Identity verification
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>('bvn');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isResolvingBvn, setIsResolvingBvn] = useState(false);
  const [isVerifyingDocuments, setIsVerifyingDocuments] = useState(false);
  
  // Date picker modal
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
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
  const [houseUrl, setHouseUrl] = useState<string | null>(null);
  const [lga, setLga] = useState('');
  const [state, setState] = useState('');
  const [utilityBill, setUtilityBill] = useState<string | null>(null);

  // Utility bill validation
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDate, setUploadDate] = useState<Date | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  // Location search
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [addressLat, setAddressLat] = useState('');
  const [addressLon, setAddressLon] = useState('');
  const [addressPlaceId, setAddressPlaceId] = useState('');
  
  // Identity information
  const [bvn, setBvn] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bvnMatchedName, setBvnMatchedName] = useState('');
  const [nin, setNin] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [driversLicense, setDriversLicense] = useState('');
  
  // Bank selection
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showBankSelection, setShowBankSelection] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState(''); // Added for search functionality
  
  // Animation effects for bank selection modal
  useEffect(() => {
    if (showBankSelection) {
      // Animate bank list in
      Animated.spring(bankListSlideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate bank list out
      Animated.timing(bankListSlideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showBankSelection]);
  
  // Document verification
  const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(null);
  const [documentBackImage, setDocumentBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Flag to prevent automatic toasts during manual verification
  const [isManualVerification, setIsManualVerification] = useState(false);
  
  // Refs for auto-focus
  const lastNameInputRef = useRef<TextInput>(null);
  const middleNameInputRef = useRef<TextInput>(null);
  const dobInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);
  
  // Add back the house number state
  const [addressNo, setAddressNo] = useState('');
  
  // Pre-fill form with user data if available and load form data
  useEffect(() => {
    if (session?.user?.user_metadata) {
      const { first_name, last_name, phone } = session.user.user_metadata;
      if (first_name) setFirstName(first_name);
      if (last_name) setLastName(last_name);
      if (phone) setPhoneNumber(phone);
    }
  }, [session]);

  // Load form data and progress when they change
  useEffect(() => {
    if (formData) {
      // Load personal information
      if (formData.first_name) setFirstName(formData.first_name);
      if (formData.last_name) setLastName(formData.last_name);
      if (formData.middle_name) setMiddleName(formData.middle_name);
      if (formData.date_of_birth) setDateOfBirth(formData.date_of_birth);
      if (formData.phone_number) setPhoneNumber(formData.phone_number);
      if (formData.address) setAddress(formData.address);
      if (formData.house_url) setHouseUrl(formData.house_url);
      if (formData.address_lat) setAddressLat(formData.address_lat);
      if (formData.address_lon) setAddressLon(formData.address_lon);
      if (formData.address_place_id) setAddressPlaceId(formData.address_place_id);
      
      // Load identity information
      if (formData.bvn) setBvn(formData.bvn);
      if (formData.nin) setNin(formData.nin);
      
      // Load document information based on document_type
      if (formData.document_type) {
        setSelectedIdentityType(formData.document_type as IdentityType);
        if (formData.document_number) {
          switch (formData.document_type) {
            case 'nin':
              setNin(formData.document_number);
              break;
            case 'passport':
              setPassportNumber(formData.document_number);
              break;
            case 'drivers_license':
              setDriversLicense(formData.document_number);
              break;
          }
        }
      }
      
      // Load document images
      if (formData.document_front_url) setDocumentFrontImage(formData.document_front_url);
      if (formData.document_back_url) setDocumentBackImage(formData.document_back_url);
      if (formData.selfie_url) setSelfieImage(formData.selfie_url);
      
      // Load address details
      if (formData.lga) setLga(formData.lga);
      if (formData.state) setState(formData.state);
      if (formData.utility_bill_url) setUtilityBill(formData.utility_bill_url);
      
      // Add back the house number state
      if (formData.address_no) setAddressNo(formData.address_no);
    }
  }, [formData]);

  // Update current step when progress changes
  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.current_step);
      setBvnVerified(progress.bvn_verified);
      setDocumentsVerified(progress.documents_verified);
      
      // Set verification status without showing toasts on initial load
      if (progress.overall_completed) {
        setVerificationStatus('fully_verified');
        // Don't show toast on initial load - only show when user completes verification
      } else if (progress.bvn_verified && progress.documents_verified) {
        setVerificationStatus('partially_verified');
        // showToast('Your identity is verified. Please complete address details', 'info');
      } else if (progress.bvn_verified) {
        setVerificationStatus('partially_verified');
      } else {
        setVerificationStatus('unverified');
      }
    }
  }, [progress, showToast, isManualVerification]);
  

  
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
    
    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      newErrors.accountNumber = 'Account number must be 10 digits';
    }
    
    if (!selectedBank) {
      newErrors.selectedBank = 'Please select your bank';
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
    if (!houseUrl) newErrors.houseUrl = 'House photo is required';
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    
    return true;
  };

  const validateUtilityBill = async (utilityBill: string): Promise<any> => {
    // Example validation: check if utilityBill is a non-empty string
    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    // Get user's address from KYC data for validation
    const userAddress = addressNo || '';

    const response = await fetch('/api/utility-bill-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        utilityBillImage: utilityBill,
        userAddress: userAddress
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Validation failed');
    }

    const result = await response.json();
    return result;
  };

  
  const uploadUtilityBill = async () => {
    if (!utilityBill || !session?.user?.id) {
      showToast('Please select a utility bill image first.', 'error');
      return;
    }

    setIsUploading(true);
    setIsValidating(true);

    try {
      // Upload image to Supabase storage
      showToast('Uploading utility bill...', 'info');
      
      // Get file extension from URI
      const fileExtension = utilityBill.split('.').pop() || 'jpg';
      const fileName = `utility-bill.${fileExtension}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Convert image to blob for upload
      const response = await fetch(utilityBill);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true // Replace if file already exists
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const storageUrl = urlData.publicUrl;

      // Validate utility bill with Dojah using the storage URL
      showToast('Validating utility bill...', 'info');
      const validation = await validateUtilityBill(storageUrl);
      setValidationResult(validation);

      if (!validation.isValid) {
        // Show validation errors
        const errors = [];
        if (!validation.validationChecks.isRecent) {
          errors.push('Utility bill is not recent (must be within 3 months)');
        }
        if (!validation.validationChecks.hasAddressInfo) {
          errors.push('Address information could not be extracted from the utility bill');
        }
        if (!validation.validationChecks.addressMatches) {
          errors.push('Address on utility bill does not match your registered address');
        }

        showToast(`Validation failed: ${errors.join(', ')}`, 'error');
        setIsValidating(false);
        return;
      }

      // Validation passed, save to KYC data
      showToast('Validation passed! Saving utility bill...', 'success');
      
      // const success = await saveFormData({
      //   utility_bill_url: storageUrl,
      //   utility_bill_validated: true,
      //   utility_bill_validation_result: validation
      // });

      // if (success) {
      //   setUploadDate(new Date());
      //   showToast('Utility bill uploaded and validated successfully!', 'success');
      // } else {
      //   showToast('Failed to save utility bill. Please try again.', 'error');
      // }
    } catch (error) {
      console.error('Error uploading utility bill:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to upload utility bill: ${errorMessage}`, 'error');
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  };

  const handleNextStep = async () => {
    try {
      switch (currentStep) {
        case 'personal':
          if (validatePersonalInfo()) {
            setIsLoading(true);
            
            try {
              // Save personal info data
              const saveResult = await saveFormData({
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName,
                date_of_birth: dateOfBirth,
                phone_number: phoneNumber,
                address: address,
                house_url: houseUrl || undefined,
                address_lat: addressLat,
                address_lon: addressLon,
                address_place_id: addressPlaceId
              });
              
              if (!saveResult) {
                showToast('Failed to save personal information. Please try again.', 'error');
                return;
              }
              
              // Create Paystack customer
              const customerPayload = {
                email: session?.user?.email || '',
                first_name: firstName,
                last_name: lastName,
                phone: phoneNumber,
                metadata: {
                  user_id: session?.user?.id,
                  middle_name: middleName,
                  date_of_birth: dateOfBirth,
                  address: address
                }
              };
              
              const customerResponse = await fetch('https://api.paystack.co/customer', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`
                },
                body: JSON.stringify(customerPayload),
              });
              
              if (!customerResponse.ok) {
                throw new Error('Failed to create Paystack customer');
              }
              
              const customerData = await customerResponse.json();
              console.log('Paystack customer created:', customerData);
              
              // Update progress when personal info is completed
              const progressResult = await updateProgress({
                current_step: 'bvn_verification',
                personal_info_completed: true
              });
              
              if (!progressResult) {
                showToast('Failed to update progress. Please try again.', 'error');
                return;
              }
              
              // Wait for toast to be visible before moving to next step
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              setCurrentStep('bvn_verification');
              setTimeout(() => {
                setIsManualVerification(false);
              }, 1000);
              
            } catch (error) {
              console.error('Error creating Paystack customer:', error);
              showToast('Failed to create customer profile. Please try again.', 'error');
            } finally {
              setIsLoading(false);
            }
          }
          break;
        case 'bvn_verification':
          if (validateBvnVerification()) {
            setIsLoading(true);
            
            // Save BVN data
            const saveResult = await saveFormData({
              bvn: bvn,
              account_number: accountNumber
            });
            
            if (!saveResult) {
              showToast('Failed to save BVN data. Please try again.', 'error');
              return;
            }
            
            // Verify BVN with Dojah
            await verifyBvn();
          }
          break;
        case 'id_face_match':
          if (validateIdFaceMatch()) {
            setIsLoading(true);
            
            // Save identity and document data
            const saveResult = await saveFormData({
              nin: nin,
              document_type: selectedIdentityType,
              document_number: selectedIdentityType === 'nin' ? nin : 
                             selectedIdentityType === 'passport' ? passportNumber : 
                             selectedIdentityType === 'drivers_license' ? driversLicense : '',
              document_front_url: documentFrontImage || undefined,
              document_back_url: documentBackImage || undefined,
              selfie_url: selfieImage || undefined
            });
            
            if (!saveResult) {
              showToast('Failed to save document data. Please try again.', 'error');
              return;
            }
            
            // Verify documents with Dojah
            await verifyDocuments();
          }
          break;
        case 'address_details':
          if (validateAddressDetails()) {
            setIsLoading(true);
            if (utilityBill) {
              await uploadUtilityBill();
            }
            
            // Save address details data
            const saveResult = await saveFormData({
              address_no: addressNo,
              lga: lga,
              state: state,
              house_url: houseUrl || undefined,
              utility_bill_url: utilityBill || undefined,
              utility_bill_validated: validationResult?.isValid || false,
              utility_bill_validation_result: validationResult || undefined,
            });
            
            if (!saveResult) {
              showToast('Failed to save address details. Please try again.', 'error');
              return;
            }
            
            // Update progress when address is completed
            const progressResult = await updateProgress({
              current_step: 'review',
              address_completed: true
            });
            
            if (!progressResult) {
              showToast('Failed to update progress. Please try again.', 'error');
              return;
            }
            
            // Wait for toast to be visible before moving to next step
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            setCurrentStep('review');
            setTimeout(() => {
              setIsManualVerification(false);
            }, 1000);
          }
          break;
        case 'review':
          await handleSubmit();
          break;
      }
    } catch (error) {
      console.error('Error in handleNextStep:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const verifyBvn = async () => {
    try {
      setIsManualVerification(true);
      setIsResolvingBvn(true);
      setErrors({});
      
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      // Check if environment variables are available
      const appId = process.env.EXPO_PUBLIC_DOJAH_APP_ID!;
      const privateKey = process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!;
      
      if (!appId || !privateKey) {
        console.error('Missing Dojah credentials:', { appId: !!appId, privateKey: !!privateKey });
        showToast('KYC service configuration error', 'error');
        return;
      }
      
      // Make actual Dojah API call
      const response = await fetch(`https://api.dojah.io/api/v1/kyc/bvn/advance?bvn=${bvn}`, {
        method: 'GET',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`BVN verification failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('BVN verification response:', data);
      
      if (!data.entity) {
        throw new Error('Invalid BVN or no data returned');
      }
      
      const bvnData = data.entity;
      
      // Smart name matching function
      const normalizeName = (name: string) => {
        return name.toLowerCase().trim().replace(/\s+/g, ' ');
      };
      
      const isNameMatch = (name1: string, name2: string) => {
        const normalized1 = normalizeName(name1);
        const normalized2 = normalizeName(name2);
        
        // Exact match
        if (normalized1 === normalized2) return true;
        
        // Check if one name contains the other (for partial matches)
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
        
        // Check for common misspellings or variations
        const similarity = calculateSimilarity(normalized1, normalized2);
        return similarity >= 0.7; // 70% similarity threshold
      };
      
      // Simple similarity calculation (Levenshtein distance based)
      const calculateSimilarity = (str1: string, str2: string) => {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
      };
      
      const levenshteinDistance = (str1: string, str2: string) => {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[str2.length][str1.length];
      };
      
      // Get names from BVN data
      const bvnFirstName = bvnData.first_name || '';
      const bvnLastName = bvnData.last_name || '';
      const bvnMiddleName = bvnData.middle_name || '';
      
      // Get names from user's saved data
      const userFirstName = firstName || '';
      const userLastName = lastName || '';
      const userMiddleName = middleName || '';
      
      console.log('Name comparison:', {
        bvn: { firstName: bvnFirstName, lastName: bvnLastName, middleName: bvnMiddleName },
        user: { firstName: userFirstName, lastName: lastName, middleName: userMiddleName }
      });
      
      // Check if any name matches (considering possible swaps)
      const allBvnNames = [bvnFirstName, bvnLastName, bvnMiddleName].filter(Boolean);
      const allUserNames = [userFirstName, userLastName, userMiddleName].filter(Boolean);
      
      let nameMatches = 0;
      let totalNames = Math.max(allBvnNames.length, allUserNames.length);
      
      // Check for matches (including swapped positions)
      for (const bvnName of allBvnNames) {
        for (const userName of allUserNames) {
          if (isNameMatch(bvnName, userName)) {
            nameMatches++;
            break;
          }
        }
      }
      
      const matchPercentage = totalNames > 0 ? (nameMatches / totalNames) * 100 : 0;
      console.log(`Name match percentage: ${matchPercentage}% (${nameMatches}/${totalNames})`);
      
      // Consider it a match if at least 60% of names match
      if (matchPercentage >= 60) {
        setBvnVerified(true);
        
        // Create a display name from BVN data
        const displayName = [bvnFirstName, bvnMiddleName, bvnLastName]
          .filter(Boolean)
          .join(' ');
        
        setBvnMatchedName(displayName);
        
        // Verify customer identity in Paystack
        try {
          // Get the customer code from the created customer (you might need to store this)
          // For now, we'll use the user's email to find the customer
          const customerResponse = await fetch(` https://api.paystack.co/customer?email=${encodeURIComponent(session?.user?.email || '')}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`
            }
          });
          
          if (customerResponse.ok) {
            const customerData = await customerResponse.json();
            const customerCode = customerData.data?.[0]?.customer_code;
            
            if (customerCode) {
              // Call Paystack identification endpoint
              const identificationResponse = await fetch(`https://api.paystack.co/customer/${customerCode}/identification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`
                },
                body: JSON.stringify({
                  country: "NG",
                  type: "bank_account",
                  account_number: accountNumber,
                  bvn: bvn,
                  bank_code: selectedBank?.code || "007", // Use selected bank or fallback to First Bank
                  first_name: firstName,
                  last_name: lastName
                }),
              });
              
              if (identificationResponse.ok) {
                const identificationData = await identificationResponse.json();
                console.log('Paystack identification successful:', identificationData);
                showToast(`BVN verified and identity confirmed! Name: ${displayName}`, 'success');
              } else {
                console.error('Paystack identification failed:', await identificationResponse.text());
                showToast(`BVN verified! Name: ${displayName}`, 'success');
              }
            } else {
              showToast(`BVN verified! Name: ${displayName}`, 'success');
            }
          } else {
            showToast(`BVN verified! Name: ${displayName}`, 'success');
          }
        } catch (error) {
          console.error('Error with Paystack identification:', error);
          showToast(`BVN verified! Name: ${displayName}`, 'success');
        }
        
        // Update progress
        const progressResult = await updateProgress({
          current_step: 'id_face_match',
          bvn_verified: true
        });
        
        if (!progressResult) {
          showToast('Failed to update progress. Please try again.', 'error');
          return;
        }
        
        // Wait for toast to be visible before moving to next step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setCurrentStep('id_face_match');
        setTimeout(() => {
          setIsManualVerification(false);
        }, 1000);
      } else {
        throw new Error('Name mismatch detected. Please verify your personal information.');
      }
      
    } catch (error) {
      console.error('BVN verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
      showToast(errorMessage, 'error');
      setErrors({ bvn: errorMessage });
      // Reset manual verification flag on error
      setIsManualVerification(false);
    } finally {
      setIsResolvingBvn(false);
    }
  };
  
  // Image validation function
  const validateImage = (imageUri: string): { isValid: boolean; error?: string } => {
    // Check if it's a valid image format
    if (!imageUri.startsWith('data:image/')) {
      return { isValid: false, error: 'Invalid image format. Please select a valid image.' };
    }
    
    // Check file size (5MB limit)
    const base64Data = imageUri.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4; // Approximate size calculation
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > 5) {
      return { isValid: false, error: 'Image size must be less than 5MB. Please select a smaller image.' };
    }
    
    return { isValid: true };
  };



  // Smart name matching function (same as BVN verification)
  const isNameMatch = (name1: string, name2: string) => {
    const normalizeName = (name: string) => {
      return name.toLowerCase().trim().replace(/\s+/g, ' ');
    };
    
    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Check if one name contains the other (for partial matches)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
    
    // Check for common misspellings or variations
    const similarity = calculateSimilarity(normalized1, normalized2);
    return similarity >= 0.7; // 70% similarity threshold
  };
  
  const calculateSimilarity = (str1: string, str2: string) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };
  
  const levenshteinDistance = (str1: string, str2: string) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const verifyDocuments = async () => {
    try {
      setIsManualVerification(true);
      setIsVerifyingDocuments(true);
      setErrors({});
      
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      // Check if environment variables are available
      const appId = process.env.EXPO_PUBLIC_DOJAH_APP_ID!;
      const privateKey = process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!;
      
      if (!appId || !privateKey) {
        console.error('Missing Dojah credentials:', { appId: !!appId, privateKey: !!privateKey });
        showToast('KYC service configuration error', 'error');
        return;
      }

      // Validate required images
      if (!documentFrontImage) {
        throw new Error('Front of document is required');
      }
      
      if (!selfieImage) {
        throw new Error('Selfie is required');
      }

      // Validate image formats and sizes
      const frontImageValidation = validateImage(documentFrontImage);
      if (!frontImageValidation.isValid) {
        throw new Error(frontImageValidation.error);
      }

      const selfieValidation = validateImage(selfieImage);
      if (!selfieValidation.isValid) {
        throw new Error(selfieValidation.error);
      }

      if (documentBackImage) {
        const backImageValidation = validateImage(documentBackImage);
        if (!backImageValidation.isValid) {
          throw new Error(backImageValidation.error);
        }
      }

      // Verify based on document type first (before saving anything )
      if (selectedIdentityType === 'drivers_license') {
        await verifyDriversLicense(appId, privateKey);
      } else if (selectedIdentityType === 'nin') {
        await verifyNIN(appId, privateKey);
      } else {
        throw new Error('Unsupported document type');
      }
      
    } catch (error) {
      console.error('Document verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Document verification failed';
      showToast(errorMessage, 'error');
      setErrors({ documentVerification: errorMessage });
      // Reset manual verification flag on error
      setIsManualVerification(false);
    } finally {
      setIsVerifyingDocuments(false);
    }
  };

  const verifyDriversLicense = async (appId: string, privateKey: string) => {
    try {
      if (!driversLicense.trim()) {
        throw new Error('Driver\'s license number is required');
      }

      // Make Dojah API call for driver's license verification
      const response = await fetch(`https://api.dojah.io/api/v1/kyc/dl?license_number=${driversLicense}`, {
        method: 'GET',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Driver's license verification failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Driver\'s license verification response:', data);
      
      if (!data.entity) {
        throw new Error('Invalid driver\'s license or no data returned');
      }
      
      const dlData = data.entity;
      
      // Get names from driver's license data
      const dlFirstName = dlData.firstName || '';
      const dlLastName = dlData.lastName || '';
      const dlMiddleName = dlData.middleName || '';
      
      // Get names from user's saved data
      const userFirstName = firstName || '';
      const userLastName = lastName || '';
      const userMiddleName = middleName || '';
      
      console.log('Driver\'s license name comparison:', {
        dl: { firstName: dlFirstName, lastName: dlLastName, middleName: dlMiddleName },
        user: { firstName: userFirstName, lastName: userLastName, middleName: userMiddleName }
      });
      
      // Check if any name matches (considering possible swaps)
      const allDlNames = [dlFirstName, dlLastName, dlMiddleName].filter(Boolean);
      const allUserNames = [userFirstName, userLastName, userMiddleName].filter(Boolean);
      
      let nameMatches = 0;
      let totalNames = Math.max(allDlNames.length, allUserNames.length);
      
      // Check for matches (including swapped positions)
      for (const dlName of allDlNames) {
        for (const userName of allUserNames) {
          if (isNameMatch(dlName, userName)) {
            nameMatches++;
            break;
          }
        }
      }
      
      const matchPercentage = totalNames > 0 ? (nameMatches / totalNames) * 100 : 0;
      console.log(`Driver's license name match percentage: ${matchPercentage}% (${nameMatches}/${totalNames})`);
      
      // Consider it a match if at least 60% of names match
      if (matchPercentage >= 60) {
        // Only save data after successful verification
        try {
          await saveFormData({
            document_type: 'drivers_license',
            document_number: driversLicense,
            document_front_url: documentFrontImage || undefined,
            document_back_url: documentBackImage || undefined,
            selfie_url: selfieImage || undefined
          });
          
          console.log('Driver\'s license data saved successfully');
        } catch (saveError) {
          console.error('Error saving driver\'s license data:', saveError);
          // Don't throw error if data might have been saved despite network issues
          console.log('Continuing with verification process...');
        }
        
        setDocumentsVerified(true);
        
        // Create a display name from DL data
        const displayName = [dlFirstName, dlMiddleName, dlLastName]
          .filter(Boolean)
          .join(' ');
        
        // Show success toast after verification completes
        showToast(`Driver's license verified! Name: ${displayName}`, 'success');
        
        // Update progress
        const progressResult = await updateProgress({
          current_step: 'address_details',
          documents_verified: true
        });
        
        if (!progressResult) {
          showToast('Failed to update progress. Please try again.', 'error');
          return;
        }
        
        // Wait for toast to be visible before moving to next step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setCurrentStep('address_details');
        setTimeout(() => {
          setIsManualVerification(false);
        }, 1000);
      } else {
        throw new Error('Name mismatch detected. Please verify your personal information.');
      }
      
    } catch (error) {
      console.error('Driver\'s license verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Driver\'s license verification failed';
      showToast(errorMessage, 'error');
      setErrors({ documentVerification: errorMessage });
      // Reset manual verification flag on error
      setIsManualVerification(false);
      throw error; // Re-throw to be handled by verifyDocuments
    }
  };

  const verifyNIN = async (appId: string, privateKey: string) => {
    try {
      if (!nin.trim()) {
        throw new Error('NIN is required');
      }

      // Convert selfie image to base64 (remove data:image/jpeg;base64, prefix)
      const selfieBase64 = selfieImage!.split(',')[1];

      // Make Dojah API call for NIN verification
      const response = await fetch('https://api.dojah.io/api/v1/kyc/nin/verify', {
        method: 'POST',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nin: nin,
          first_name: firstName,
          last_name: lastName,
          selfie_image: selfieBase64
        })
      });
      
      if (!response.ok) {
        throw new Error(`NIN verification failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('NIN verification response:', data);
      
      if (!data.entity) {
        throw new Error('Invalid NIN or no data returned');
      }
      
      const ninData = data.entity;
      
      // Check selfie verification with confidence threshold
      const selfieVerification = ninData.selfie_verification;
      if (!selfieVerification) {
        throw new Error('Selfie verification data not available. Please try again.');
      }
      
      if (!selfieVerification.match) {
        throw new Error('Selfie verification failed. Please ensure the selfie matches your NIN photo.');
      }
      
      if (selfieVerification.confidence_value < 90) {
        throw new Error(`Selfie confidence too low (${selfieVerification.confidence_value.toFixed(1)}%). Please take a clearer selfie.`);
      }
      
      console.log(`Selfie verification passed: ${selfieVerification.confidence_value.toFixed(1)}% confidence`);
      
      // Get names from NIN data
      const ninFirstName = ninData.first_name || '';
      const ninLastName = ninData.last_name || '';
      const ninMiddleName = ninData.middle_name || '';
      
      // Get names from user's saved data
      const userFirstName = firstName || '';
      const userLastName = lastName || '';
      const userMiddleName = middleName || '';
      
      console.log('NIN name comparison:', {
        nin: { firstName: ninFirstName, lastName: ninLastName, middleName: ninMiddleName },
        user: { firstName: userFirstName, lastName: userLastName, middleName: userMiddleName }
      });
      
      // Check if any name matches (considering possible swaps)
      const allNinNames = [ninFirstName, ninLastName, ninMiddleName].filter(Boolean);
      const allUserNames = [userFirstName, userLastName, userMiddleName].filter(Boolean);
      
      let nameMatches = 0;
      let totalNames = Math.max(allNinNames.length, allUserNames.length);
      
      // Check for matches (including swapped positions)
      for (const ninName of allNinNames) {
        for (const userName of allUserNames) {
          if (isNameMatch(ninName, userName)) {
            nameMatches++;
            break;
          }
        }
      }
      
      const matchPercentage = totalNames > 0 ? (nameMatches / totalNames) * 100 : 0;
      console.log(`NIN name match percentage: ${matchPercentage}% (${nameMatches}/${totalNames})`);
      
      // Consider it a match if at least 60% of names match
      if (matchPercentage >= 60) {
        // Only save data after successful verification
        try {
          await saveFormData({
            document_type: 'nin',
            document_number: nin,
            document_front_url: documentFrontImage || undefined,
            selfie_url: selfieImage || undefined
          });
          
          console.log('NIN data saved successfully');
        } catch (saveError) {
          console.error('Error saving NIN data:', saveError);
          // Don't throw error if data might have been saved despite network issues
          console.log('Continuing with verification process...');
        }
        
        setDocumentsVerified(true);
        
        // Create a display name from NIN data
        const displayName = [ninFirstName, ninMiddleName, ninLastName]
          .filter(Boolean)
          .join(' ');
        
        // Show success toast after verification completes
        showToast(`NIN verified! Name: ${displayName} (${selfieVerification.confidence_value.toFixed(1)}% confidence)`, 'success');
        
        // Update progress
        const progressResult = await updateProgress({
          current_step: 'address_details',
          documents_verified: true
        });
        
        if (!progressResult) {
          showToast('Failed to update progress. Please try again.', 'error');
          return;
        }
        
        // Wait for toast to be visible before moving to next step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setCurrentStep('address_details');
        setTimeout(() => {
          setIsManualVerification(false);
        }, 1000);
      } else {
        throw new Error('Name mismatch detected. Please verify your personal information.');
      }
      
    } catch (error) {
      console.error('NIN verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'NIN verification failed';
      showToast(errorMessage, 'error');
      setErrors({ documentVerification: errorMessage });
      // Reset manual verification flag on error
      setIsManualVerification(false);
      throw error; // Re-throw to be handled by verifyDocuments
    }
  };
  
  const handlePreviousStep = async () => {
    try {
      switch (currentStep) {
        case 'bvn_verification':
          await updateProgress({ current_step: 'personal' });
          setCurrentStep('personal');
          break;
        case 'id_face_match':
          await updateProgress({ current_step: 'bvn_verification' });
          setCurrentStep('bvn_verification');
          break;
        case 'address_details':
          await updateProgress({ current_step: 'id_face_match' });
          setCurrentStep('id_face_match');
          break;
        case 'review':
          await updateProgress({ current_step: 'address_details' });
          setCurrentStep('address_details');
          break;
        default:
          router.back();
      }
    } catch (error) {
      console.error('Error in handlePreviousStep:', error);
      // Still allow navigation even if progress update fails
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
    }
  };
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }
      
      // Mark KYC as fully completed
      const progressResult = await updateProgress({
        overall_completed: true
      });
      
      if (progressResult) {
        // Update account_verified to true in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ account_verified: true })
          .eq('id', session.user.id);
        
        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Don't fail the entire process if profile update fails
          console.log('Continuing with verification completion...');
        }
        
        showToast('Verification completed successfully!', 'success');
        router.replace('/(tabs)');
      } else {
        showToast('Failed to complete verification. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Final verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete verification';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Date picker functions
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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
    // Parse existing date if available
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
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleDateConfirm = () => {
    if (selectedDate) {
      const formattedDate = formatDateForDisplay(selectedDate);
      setDateOfBirth(formattedDate);
      setErrors(prev => ({ ...prev, dateOfBirth: '' }));
    }
    setIsDatePickerVisible(false);
  };
  
  const handleLocationSelect = (location: any) => {
    // Build a more detailed address with house number if available
    let detailedAddress = location.display_name;
    let houseNumber = '';
    
    if (location.address) {
      const addressParts = [];
      
      // Extract house number if available
      if (location.address.house_number) {
        houseNumber = location.address.house_number;
        addressParts.push(location.address.house_number);
      }
      
      // Add road/street name
      if (location.address.road) {
        addressParts.push(location.address.road);
      }
      
      // Add suburb/neighborhood
      if (location.address.suburb) {
        addressParts.push(location.address.suburb);
      }
      
      // Add city
      if (location.address.city) {
        addressParts.push(location.address.city);
      }
      
      // Add state
      if (location.address.state) {
        addressParts.push(location.address.state);
      }
      
      // If we have address parts, use them; otherwise use display_name
      if (addressParts.length > 0) {
        detailedAddress = addressParts.join(', ');
      }
    }
    
    setAddress(detailedAddress);
    // Note: houseUrl will be set by photo capture, not from location
    setAddressLat(location.lat);
    setAddressLon(location.lon);
    setAddressPlaceId(location.place_id.toString());
    
    // Extract LGA and State from the location data
    if (location.address) {
      if (location.address.city) {
        setLga(location.address.city);
      }
      if (location.address.state) {
        setState(location.address.state);
      }
    }
    
    setErrors(prev => ({ ...prev, address: '' }));
    
    // Save the location data
    saveFormData({
      address: detailedAddress,
      address_lat: location.lat,
      address_lon: location.lon,
      address_place_id: location.place_id.toString(),
      lga: location.address?.city || '',
      state: location.address?.state || ''
    });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isDateSelectable = (date: Date) => {
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()); // 100 years ago
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()); // 18 years ago
    return date >= minDate && date <= maxDate;
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
            <Pressable onPress={handleDatePickerOpen} style={styles.calendarIconButton}>
              <Calendar size={20} color={colors.primary} />
            </Pressable>
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
          <Text style={styles.label}>House/Street Number</Text>
          <View style={styles.inputContainer}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter house/street number"
              placeholderTextColor={colors.textTertiary}
              value={addressNo}
              onChangeText={(text) => {
                setAddressNo(text);
                setErrors(prev => ({ ...prev, addressNo: '' }));
              }}
              keyboardType="numeric"
            />
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Residential Address</Text>
          <Pressable 
            style={[styles.inputContainer, errors.address && styles.inputError]}
            onPress={() => setShowLocationSearch(true)}
          >
            <MapPin size={20} color={colors.textSecondary} />
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
    );
  };
  
  const renderBvnVerificationStep = () => {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>BVN Verification</Text>
        <Text style={styles.sectionDescription}>
          Please enter your Bank Verification Number (BVN) and the account number associated with it for identity verification.
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
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account Number</Text>
          <View style={[styles.inputContainer, errors.accountNumber && styles.inputError]}>
            <CreditCard size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter your 10-digit account number"
              placeholderTextColor={colors.textTertiary}
              value={accountNumber}
              onChangeText={(text) => {
                // Only allow numbers and limit to 10 digits
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 10) {
                  setAccountNumber(numericText);
                  setErrors(prev => ({ ...prev, accountNumber: '' }));
                }
              }}
              keyboardType="numeric"
              maxLength={10}
              editable={!isResolvingBvn && !bvnVerified}
            />
          </View>
          {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bank</Text>
          <Pressable
            style={[styles.inputContainer, errors.selectedBank && styles.inputError]}
            onPress={() => setShowBankSelection(true)}
          >
            <CreditCard size={20} color={colors.textSecondary} />
            <Text style={[styles.input, !selectedBank && { color: colors.textTertiary }]}>
              {selectedBank ? selectedBank.name : 'Select your bank'}
            </Text>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
          {errors.selectedBank && <Text style={styles.errorText}>{errors.selectedBank}</Text>}
        </View>
        
        {bvnVerified && bvnMatchedName && (
          <View style={styles.matchedNameContainer}>
            <Check size={16} color={colors.success} />
            <Text style={styles.matchedNameText}>
              BVN verified! Name: {bvnMatchedName}
            </Text>
          </View>
        )}
        
        <View style={styles.infoContainer}>
          <Info size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your BVN and account number are used for verification purposes only. This helps us confirm your identity and protect your account.
          </Text>
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
            
            {/* <Pressable
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
            </Pressable> */}
            
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
        
        {/* {selectedIdentityType === 'passport' && (
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
        )} */}
        
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
          <Text style={styles.label}>House/Street Number</Text>
          <View style={styles.inputContainer}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter house/street number"
              placeholderTextColor={colors.textTertiary}
              value={addressNo}
              onChangeText={(text) => {
                setAddressNo(text);
                setErrors(prev => ({ ...prev, addressNo: '' }));
              }}
              keyboardType="numeric"
            />
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Residential Address</Text>
          <Pressable 
            style={[styles.inputContainer, errors.address && styles.inputError]}
            onPress={() => setShowLocationSearch(true)}
          >
            <MapPin size={20} color={colors.textSecondary} />
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
            <Text style={styles.documentName}>House Photo (Required)</Text>
            <View style={[styles.documentStatus, styles.requiredStatus]}>
              <Text style={styles.requiredStatusText}>Required</Text>
            </View>
          </View>
          <Text style={styles.documentDescription}>
            Take a photo of your house/building for address verification.
          </Text>
          {houseUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: houseUrl }} 
                style={styles.imagePreview} 
                resizeMode="cover"
              />
              <Pressable 
                style={styles.retakeButton}
                onPress={() => setHouseUrl(null)}
              >
                <Text style={styles.retakeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.documentActions}>
              <Pressable 
                style={styles.documentButton}
                onPress={() => takePicture(setHouseUrl, 'housePhoto')}
              >
                <Camera size={16} color={colors.primary} />
                <Text style={styles.documentButtonText}>Take Photo</Text>
              </Pressable>
            </View>
          )}
          {errors.houseUrl && <Text style={styles.errorText}>{errors.houseUrl}</Text>}
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
              <Text style={styles.reviewLabel}>Bank</Text>
              <Text style={styles.reviewValue}>
                {selectedBank ? selectedBank.name : 'Not selected'}
              </Text>
            </View>
            
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Account Number</Text>
              <Text style={styles.reviewValue}>
                •••• •••• {accountNumber.slice(-4)}
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
              <Text style={styles.reviewLabel}>House/Street Number</Text>
              <Text style={styles.reviewValue}>{addressNo || 'Not provided'}</Text>
            </View>
            
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
              <Text style={styles.reviewLabel}>House Photo</Text>
              <Text style={styles.reviewValue}>
                {houseUrl ? 'Uploaded' : 'Not provided'}
              </Text>
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

  const renderDatePickerModal = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOffset = getFirstDayOfMonth(currentMonth);

    return (
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
              <Pressable onPress={handleDatePickerClose} style={styles.closeButton}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              <Pressable onPress={handlePrevMonth} style={styles.navigationButton}>
                <ChevronLeft size={20} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.monthYearText}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <Pressable onPress={handleNextMonth} style={styles.navigationButton}>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.weekDays}>
              {DAYS.map(day => (
                <View key={day} style={styles.weekDay}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: firstDayOffset }).map((_, index) => (
                <View key={`empty-${index}`} style={styles.dayCell} />
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                const isSelectable = isDateSelectable(date);
                const isSelected = selectedDate && 
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDay,
                      !isSelectable && styles.disabledDay,
                    ]}
                    onPress={() => isSelectable && handleDateSelect(date)}
                    disabled={!isSelectable}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      !isSelectable && styles.disabledDayText,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.datePickerActions}>
              <Pressable 
                style={[styles.datePickerButton, styles.cancelButton]}
                onPress={handleDatePickerClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.datePickerButton, styles.confirmButton]}
                onPress={handleDateConfirm}
                disabled={!selectedDate}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Calculate responsive sizes
  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 20 : 24;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const labelSize = isSmallScreen ? 13 : 14;
  const inputHeight = isSmallScreen ? 50 : 60;
  
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
    skipButton: {
      padding: 8,
      marginLeft: 'auto',
      marginRight: 12,
    },
    skipButtonText: {
      fontSize: 16,
      fontWeight: '600',
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
      paddingHorizontal: 14,
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
    calendarIconButton: {
      padding: 4,
      borderRadius: 6,
    },
    multilineInput: {
      height: inputHeight * 0.9,
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
    // Date picker modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    datePickerModal: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: isSmallScreen ? 16 : 24,
      width: '100%',
      maxWidth: 400,
      maxHeight: '90%',
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    datePickerTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: colors.text,
    },
    // closeButton: {
    //   width: 32,
    //   height: 32,
    //   borderRadius: 16,
    //   backgroundColor: colors.backgroundTertiary,
    //   justifyContent: 'center',
    //   alignItems: 'center',
    // },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    navigationButton: {
      padding: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
    },
    monthYearText: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '500',
      color: colors.text,
    },
    weekDays: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
    },
    weekDayText: {
      fontSize: isSmallScreen ? 12 : 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 24,
    },
    dayCell: {
      width: `${100/7}%`,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayText: {
      fontSize: isSmallScreen ? 12 : 14,
      color: colors.text,
    },
    selectedDay: {
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    selectedDayText: {
      color: '#FFFFFF',
      fontWeight: '500',
    },
    disabledDay: {
      opacity: 0.3,
    },
    disabledDayText: {
      color: colors.textTertiary,
    },
    datePickerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    datePickerButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    locationInfo: {
      fontSize: 12,
      color: colors.success,
      marginTop: 4,
      fontStyle: 'italic',
    },
    requiredStatus: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
    },
    requiredStatusText: {
      color: colors.warning,
    },
    // Bank selection modal styles
    bankModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    bankModalContent: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    bankModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankModalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    bankCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bankSearchContainer: {
      padding: 20,
      paddingTop: 0,
      paddingBottom: 16,
    },
    bankSearchInput: {
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    bankListContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    bankItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankItemSelected: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    bankIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bankIconText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    bankInfo: {
      flex: 1,
    },
    bankName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    bankCode: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    bankCheckIcon: {
      marginLeft: 12,
    },
    noBanksFound: {
      padding: 40,
      alignItems: 'center',
    },
          noBanksFoundText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
      },
      retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
      },
      retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
      },
    // New bank selection modal styles
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    overlayPressable: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    bankListModal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      width: '100%',
      maxHeight: '80%',
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? colors.border : 'transparent',
      // Add shadow for iOS
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    dragIndicator: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    bankListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: isSmallScreen ? 16 : 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankListTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: isSmallScreen ? 36 : 40,
      height: isSmallScreen ? 36 : 40,
      borderRadius: isSmallScreen ? 18 : 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: isSmallScreen ? 12 : 16,
      marginHorizontal: 2,
      marginTop: 5,
    },
    searchInput: {
      flex: 1,
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.text,
      borderRadius: 10,
      padding: isSmallScreen ? 12 : 16,
      marginHorizontal: 5,
      height: 65,
      borderBottomColor: colors.border,
      backgroundColor: '#EBF1F9',
    },
    bankList: {
      maxHeight: '60%',
    },
    bankOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: isSmallScreen ? 10 : 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bankOptionLogo: {
      width: 32,
      height: 32,
      borderRadius: 6,
      marginRight: 12,
    },
    bankOptionIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bankOptionText: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: 500,
      color: colors.text,
    },
    noResultsContainer: {
      padding: isSmallScreen ? 32 : 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noResultsText: {
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.textSecondary,
    },
  });
  
  if ((formDataLoading || progressLoading) && !currentStep) {
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
        
        <Pressable onPress={() => router.back()} style={styles.skipButton}>
          <Text style={[styles.skipButtonText, { color: colors.primary }]}>Done</Text>
        </Pressable>
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
      
      {!(currentStep === 'review' && progress?.overall_completed) && (
        <FloatingButton 
          title={currentStep === 'review' ? "Submit Verification" : "Continue"}
          onPress={handleNextStep}
          disabled={
            isLoading || 
            formDataLoading ||
            progressLoading ||
            isResolvingBvn || 
            isVerifyingDocuments || 
            (currentStep === 'bvn_verification' && bvnVerified) ||
            (currentStep === 'id_face_match' && documentsVerified)
          }
          loading={isLoading || formDataLoading || progressLoading || isResolvingBvn || isVerifyingDocuments}
        />
      )}
      
      {renderDatePickerModal()}
      
      <LocationSearchModal
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelectLocation={handleLocationSelect}
        placeholder="Search for your address..."
      />
      
      {/* Bank Selection Modal */}
      <Animated.View 
        style={[
          styles.overlay,
          { 
            opacity: showBankSelection ? 1 : 0,
            zIndex: showBankSelection ? 1100 : -1,
          }
        ]}
        pointerEvents={showBankSelection ? 'auto' : 'none'}
      >
        <Pressable 
          style={styles.overlayPressable} 
          onPress={() => {
            setShowBankSelection(false);
            haptics.lightImpact();
          }} 
        />
        
        <Animated.View 
          style={[
            styles.bankListModal,
            { 
              transform: [{ translateY: bankListSlideAnim }]
            }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={styles.bankListHeader}>
            <Text style={styles.bankListTitle}>Select Bank</Text>
            <Pressable 
              style={styles.closeButton}
              onPress={() => {
                setShowBankSelection(false);
                haptics.lightImpact();
              }}
            >
              <X size={isSmallScreen ? 20 : 24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search banks..."
              placeholderTextColor={colors.textTertiary}
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
              autoFocus
            />
          </View>
          
          <ScrollView style={styles.bankList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {banksLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading banks...</Text>
              </View>
            ) : banksError ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>
                  Error loading banks: {banksError}
                </Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={refetchBanks}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              (() => {
                console.log('Bank Modal - Total banks:', banks.length);
                console.log('Bank Modal - Search query:', bankSearchQuery);
                
                const filteredBanks = banks.filter(bank =>
                  bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
                  bank.code.toLowerCase().includes(bankSearchQuery.toLowerCase())
                );
                
                console.log('Bank Modal - Filtered banks:', filteredBanks.length);
                
                if (filteredBanks.length === 0) {
                  return (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>
                        {banks.length === 0 
                          ? 'No banks available. Please check your connection.' 
                          : `No banks match "${bankSearchQuery}"`
                        }
                      </Text>
                      {banks.length === 0 && (
                        <Text style={[styles.noResultsText, { fontSize: 12, marginTop: 8 }]}>
                          Total banks loaded: {banks.length}
                        </Text>
                      )}
                      {!bankSearchQuery && banks.length === 0 && (
                        <Pressable
                          style={styles.retryButton}
                          onPress={refetchBanks}
                        >
                          <Text style={styles.retryButtonText}>Refresh Banks</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }
                
                return filteredBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={styles.bankOption}
                    onPress={() => {
                      setSelectedBank(bank);
                      setShowBankSelection(false);
                      setBankSearchQuery(''); // Clear search on selection
                      setErrors(prev => ({ ...prev, selectedBank: '' }));
                      haptics.selection();
                      
                      // Save bank selection to form data
                      saveFormData({
                        bank_code: bank.code,
                        bank_name: bank.name
                      });
                    }}
                  >
                    <View style={styles.bankOptionContent}>
                      {bank.logoSvg ? (
                        <View style={styles.bankOptionLogo}>
                          {React.createElement(bank.logoSvg.default || bank.logoSvg, {
                            width: 32,
                            height: 32,
                            fill: colors.textSecondary
                          })}
                        </View>
                      ) : bank.logo ? (
                        <Image
                          source={bank.logo as any}
                          style={styles.bankOptionLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.bankOptionIconContainer}>
                          <Ionicons name="business" size={20} color={colors.textSecondary} />
                        </View>
                      )}
                      <Text style={styles.bankOptionText}>{bank.name}</Text>
                    </View>
                    {selectedBank?.id === bank.id && (
                      <Check size={20} color={colors.primary} />
                    )}
                  </Pressable>
                ));
              })()
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}