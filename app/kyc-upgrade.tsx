import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import LocationSearchModal from '@/components/LocationSearchModal';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import { safeHavenService } from '@/lib/safehaven-service';
import { useCameraPermission } from 'react-native-vision-camera';
import CameraPermissionModal from '@/components/CameraPermissionModal';
import DatePickerModal from '@/components/DatePickerModal';
import PersonalInfoStep from '@/components/KYCSteps/PersonalInfoStep';
import BVNVerificationStep from '@/components/KYCSteps/BVNVerificationStep';
import IDFaceMatchStep from '@/components/KYCSteps/IDFaceMatchStep';
import DocumentsVerificationStep from '@/components/KYCSteps/DocumentsVerificationStep';
import AddressDetailsStep from '@/components/KYCSteps/AddressDetailsStep';
import ReviewStep from '@/components/KYCSteps/ReviewStep';
import { IdentityType } from '@/components/KYCSteps/types';

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
  const { progress, loading: progressLoading, updateProgress, getStepProgress, updateTier, currentTier, checkTierCompletion } = useKYCProgress();
  const params = useLocalSearchParams<{ selfieUrl?: string }>();
  
  
  
  
  
  // Helper function to get the first incomplete step from scratch
  const getFirstIncompleteStep = useCallback((): KYCStep => {
    if (!progress) return 'liveness_verification';
    
    const stepOrder: KYCStep[] = ['liveness_verification', 'bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    
    // Find the first incomplete step
    for (const step of stepOrder) {
      switch (step) {
        case 'liveness_verification':
          if (!progress.liveness_test_completed) return step;
          break;
        case 'bvn_verification':
          if (!progress.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress.address_completed) return step;
          break;
        case 'review':
          return step; // Review is accessible if all steps are complete
      }
    }
    
    return 'review'; // Default to review if all steps are complete
  }, [progress]);

  // Step management - will be initialized to first incomplete step by useEffect
  const [currentStep, setCurrentStep] = useState<KYCStep>('liveness_verification');
  
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
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Verification status
  const [bvnVerified, setBvnVerified] = useState(false);
  const [documentsVerified, setDocumentsVerified] = useState(false);
  
  // LivenessTestEnhanced integration
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [livenessInitiated, setLivenessInitiated] = useState(false);
  const [livenessManuallyClosed, setLivenessManuallyClosed] = useState(false);
  const [livenessCompleted, setLivenessCompleted] = useState(false);
  
  // Camera permission modals
  const [showCameraPermissionModal, setShowCameraPermissionModal] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  
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
  const [validationResult, setValidationResult] = useState<any>(null);
  
  // Location search
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [addressLat, setAddressLat] = useState('');
  const [addressLon, setAddressLon] = useState('');
  const [addressPlaceId, setAddressPlaceId] = useState('');
  
  // Identity information
  const [bvn, setBvn] = useState('');
  const [bvnMatchedName, setBvnMatchedName] = useState('');
  const [nin, setNin] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  
  
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
  const phoneInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);
  const bvnInputRef = useRef<TextInput>(null);
  
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

  // Show camera permission modal when on liveness_verification step
  useEffect(() => {
    // Only check if we're on the liveness_verification step
    if (currentStep !== 'liveness_verification') {
      return;
    }

    // Only check if we haven't already initiated liveness test and it's not manually closed
    if (livenessInitiated || showLivenessTest || livenessManuallyClosed || showCameraPermissionModal) {
      return;
    }

    // Check if liveness test is completed in progress
    if (progress?.liveness_test_completed) {
      return; // Liveness already completed, move to next step
    }

    // Check if selfie exists in kyc_data table
    const checkSelfie = async () => {
      try {
        const { data: kycData } = await supabase
          .from('kyc_data')
          .select('selfie_url')
          .eq('user_id', session?.user?.id)
          .maybeSingle();
        
        const hasSelfie = kycData?.selfie_url && kycData.selfie_url.trim() !== '';
        
        // If no selfie and liveness not completed, show camera permission modal
        if (!hasSelfie && !progress?.liveness_test_completed) {
          console.log('On liveness_verification step - showing camera permission modal');
          setShowCameraPermissionModal(true);
        }
      } catch (error) {
        console.error('Error checking liveness test status:', error);
      }
    };

    if (progress && session?.user?.id) {
      checkSelfie();
    }
  }, [currentStep, progress, session?.user?.id, livenessInitiated, showLivenessTest, livenessManuallyClosed, showCameraPermissionModal]);

  // Handle selfie URL from navigation params (when coming from CameraPermissionModal)
  useEffect(() => {
    if (params.selfieUrl && !livenessCompleted && !progress?.liveness_test_completed) {
      // Selfie URL passed from navigation - handle liveness completion
      handleLivenessComplete(params.selfieUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.selfieUrl]);

  // Load form data and progress when they change
  useEffect(() => {
    const loadFormDataAndCheckSelfie = async () => {
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
            }
          }
        }
        
        // Load document images
        if (formData.document_front_url) setDocumentFrontImage(formData.document_front_url);
        if (formData.document_back_url) setDocumentBackImage(formData.document_back_url);
        if (formData.selfie_url) setSelfieImage(formData.selfie_url);
        
        // Check if selfie exists but liveness is not marked as completed in progress
        // This handles the case where liveness was completed but progress hasn't updated yet
        if (formData.selfie_url && !progress?.liveness_test_completed) {
          // Selfie exists but progress not updated - trigger handleLivenessComplete
          handleLivenessComplete(formData.selfie_url);
        }
        
        // Load address details
        if (formData.lga) setLga(formData.lga);
        if (formData.state) setState(formData.state);
        if (formData.utility_bill_url) setUtilityBill(formData.utility_bill_url);
        
        // Add back the house number state
        if (formData.address_no) setAddressNo(formData.address_no);
      }
    };

    loadFormDataAndCheckSelfie();
  }, [formData]);

  // Helper function to get the next incomplete step
  const getNextIncompleteStep = (current: KYCStep): KYCStep => {
    // Define step order based on tiers:
    // Tier 1: liveness_verification, bvn_verification, id_face_match
    // Tier 2: personal, documents_verification
    // Tier 3: address_details
    const stepOrder: KYCStep[] = ['liveness_verification', 'bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    const currentIndex = stepOrder.indexOf(current);
    
    // Find the next incomplete step
    for (let i = currentIndex + 1; i < stepOrder.length; i++) {
      const step = stepOrder[i];
      switch (step) {
        case 'liveness_verification':
          if (!progress.liveness_test_completed) return step;
          break;
        case 'bvn_verification':
          if (!progress.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress.address_completed) return step;
          break;
        case 'review':
          return step; // Review is always accessible if all steps are complete
      }
    }
    
    return 'review'; // Default to review if all steps are complete
  };

  // Helper function to get the previous incomplete step (or first incomplete if going back from a completed step)
  const getPreviousIncompleteStep = (current: KYCStep): KYCStep | null => {
    // Define step order based on tiers:
    // Tier 1: liveness_verification, bvn_verification, id_face_match
    // Tier 2: personal, documents_verification
    // Tier 3: address_details
    const stepOrder: KYCStep[] = ['liveness_verification', 'bvn_verification', 'id_face_match', 'personal', 'documents_verification', 'address_details', 'review'];
    const currentIndex = stepOrder.indexOf(current);
    
    // Find the last incomplete step before current
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = stepOrder[i];
      switch (step) {
        case 'liveness_verification':
          if (!progress.liveness_test_completed) return step;
          break;
        case 'bvn_verification':
          if (!progress.bvn_verified) return step;
          break;
        case 'id_face_match':
          if (!progress.id_face_verified) return step;
          break;
        case 'personal':
          if (!progress.personal_info_completed) return step;
          break;
        case 'documents_verification':
          if (!progress.documents_verified) return step;
          break;
        case 'address_details':
          if (!progress.address_completed) return step;
          break;
      }
    }
    
    return null; // No previous incomplete step
  };

  // Update current step when progress changes, but skip to first incomplete step
  useEffect(() => {
    if (progress && !progressLoading) {
      setBvnVerified(progress.bvn_verified);
      setDocumentsVerified(progress.documents_verified);
      
      // Get the first incomplete step directly using the helper function
      const targetStep = getFirstIncompleteStep();
      setCurrentStep(targetStep);
    }
  }, [progress, progressLoading, showToast, isManualVerification, getFirstIncompleteStep]);

  // Auto-focus BVN input when step changes to bvn_verification
  useEffect(() => {
    if (currentStep === 'bvn_verification' && !bvnVerified && bvnInputRef.current) {
      // Small delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        bvnInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep, bvnVerified]);
  

  
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
  
  const validateDocumentVerification = () => {
    const newErrors: Record<string, string> = {};
    
    if (!documentFrontImage) {
      newErrors.documentFront = 'Front of document is required';
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

    if (!nin.trim()) newErrors.nin = 'NIN is required';
    else if (nin.length !== 11 || !/^\d+$/.test(nin)) newErrors.nin = 'NIN must be 11 digits';

    // if (!selfieImage && !formData.selfie_url) {
    //   newErrors.selfie = 'Selfie is required';
    // }

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

    // Upload and validation states removed

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
      const { error: uploadError } = await supabase.storage
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
        // Validation state removed
        return;
      }

      // Validation passed, save to KYC data
      showToast('Validation passed! Saving utility bill...', 'success');
      
      
    } catch (error) {
      console.error('Error uploading utility bill:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to upload utility bill: ${errorMessage}`, 'error');
    } finally {
      // Upload and validation states removed
    }
  };

  const handleNextStep = async () => {
    try {
      switch (currentStep) {
        case 'liveness_verification':
          // Show camera permission modal instead of liveness test directly
          if (!progress || !progress.liveness_test_completed) {
            setShowCameraPermissionModal(true);
          } else {
            // If already completed, move to next step
            const nextStep = getNextIncompleteStep('liveness_verification');
            setCurrentStep(nextStep);
          }
          break;
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
              
              
              // Update progress when personal info is completed
              // After personal (Tier 2), move to documents_verification (still Tier 2)
              const progressResult = await updateProgress({
                current_step: 'documents_verification', // Move to documents verification (Tier 2) after personal info
                personal_info_completed: true
              });
              
              if (!progressResult) {
                showToast('Failed to update progress. Please try again.', 'error');
                return;
              }
              
              // Proceed to next incomplete step (should be documents_verification if not completed)
              const nextStep = getNextIncompleteStep('personal');
              setCurrentStep(nextStep);
              setTimeout(() => {
                setIsManualVerification(false);
              }, 1000);
              
            } catch (error) {
              console.error('Error proceeding after personal info:', error);
              showToast('An error occurred. Please try again.', 'error');
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
              bvn: bvn
            });
            
            if (!saveResult) {
              showToast('Failed to save BVN data. Please try again.', 'error');
              return;
            }
            
            // Verify BVN with Dojah
            await verifyBvn();
          }
          break;
        case 'documents_verification':
          if (validateDocumentVerification()) {
            setIsLoading(true);
            // Do NOT save document data yet; first verify with Dojah, then persist
            await verifyDocuments();
          }
          break;
        case 'id_face_match':
          if (validateIdFaceMatch()) {
            setIsLoading(true);
            
            // Save identity data (NIN verification only)
            const saveResult = await saveFormData({
              nin: nin,
              // selfie_url: formData.selfie_url || undefined
            });
            
            if (!saveResult) {
              showToast('Failed to save identity data. Please try again.', 'error');
              return;
            }
            
            // Verify NIN with Dojah (face matching)
            await verifyNIN(process.env.EXPO_PUBLIC_DOJAH_APP_ID!, process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!);
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
            // Also check if utility bill is validated and mark it as verified
            const utilityBillVerified = utilityBill && validationResult?.isValid;
            
            const progressResult = await updateProgress({
              current_step: 'review',
              address_completed: true,
              utility_bill_verified: utilityBillVerified || false
            });
            
            // Check if Tier 3 is complete (Tier 2 + Address + Utility)
            if (progressResult) {
              await updateTier(); // Update tier after address/utility completion
              const tierStatus = checkTierCompletion();
              if (tierStatus.tier3) {
                console.log('Tier 3 completed! User has full verification.');
                showToast('Tier 3 completed! You can now deposit up to ₦1,000,000 monthly.', 'success');
              }
            }
            
            if (!progressResult) {
              showToast('Failed to update progress. Please try again.', 'error');
              return;
            }
            
            // Wait for toast to be visible before moving to next step
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Move to next incomplete step (should be review if address is completed)
            const nextStep = getNextIncompleteStep('address_details');
            setCurrentStep(nextStep);
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
  

  // Convert image URL to base64 for API calls
  const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      // If already a data URI, extract base64
      if (imageUrl.startsWith('data:image/')) {
        const parts = imageUrl.split(',');
        return parts.length > 1 ? parts[1] : null;
      }

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  };

  // Handle LivenessTestEnhanced completion
  const handleLivenessComplete = async (selfieUrl: string) => {
    try {
      console.log('Liveness test completed, selfie URL received:', selfieUrl);
      
      // Mark liveness as completed immediately to prevent handleLivenessClose from navigating away
      setLivenessCompleted(true);
      
      // Save the selfie URL to form data
      await saveFormData({
        selfie_url: selfieUrl
      });
      
      // Mark liveness test as completed in KYC progress (current_step will be updated below)
      
      // Create audit log for liveness test completion
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'liveness_check',
        p_verification_type: 'liveness',
        p_verification_provider: 'internal',
        p_request_data: {
          action: 'liveness_test_completed',
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          selfie_url: selfieUrl,
          completion_status: 'success',
          next_step: 'bvn_verification'
        },
        p_status: 'success',
        p_result_message: 'Liveness test completed successfully',
        p_metadata: {
          component: 'KYCUpgradeScreen',
          action: 'liveness_completion',
          step: 'id_face_match'
        }
      });

      // Create audit event for liveness completion
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_completed',
            event_data: {
              action: 'liveness_test_completed',
              selfie_url: selfieUrl,
              test_stages: ['blink', 'nod', 'look_left', 'look_right', 'smile']
            },
            severity: 'medium'
          });

        // Create audit attachment for selfie image
        await supabase
          .from('kyc_audit_attachments')
          .insert({
            audit_log_id: auditLogId,
            file_name: `liveness-selfie-${Date.now()}.jpg`,
            file_type: 'image/jpeg',
            file_size: 0, // We don't have the actual file size here
            file_hash: 'selfie-hash-placeholder', // Would need actual hash calculation
            file_path: selfieUrl,
            access_level: 'restricted',
            description: 'Liveness test selfie image',
            tags: ['liveness', 'selfie', 'kyc']
          });
      }
      
      // Show success message
      showToast('Selfie captured and saved successfully', 'success');
      
      // Update current_step to next step after liveness completion
      // Tier 1: After liveness, move to BVN verification
      const progressResult = await updateProgress({
        current_step: 'bvn_verification', // Move to BVN verification (Tier 1) after liveness
        liveness_test_completed: true
      });
      
      if (progressResult) {
        // Proceed to next incomplete step (should be bvn_verification if not completed)
        const nextStep = getNextIncompleteStep('liveness_verification');
        setCurrentStep(nextStep);
        
        // Close the liveness test modal after processing is complete
        setShowLivenessTest(false);
        setLivenessInitiated(false);
        setLivenessManuallyClosed(false); // Reset the manually closed flag
        
        setTimeout(() => {
          setIsManualVerification(false);
          // Reset completion flag after a delay
          setTimeout(() => {
            setLivenessCompleted(false);
          }, 500);
        }, 500);
      } else {
        // If progress update failed, still close the modal
        setShowLivenessTest(false);
        setLivenessInitiated(false);
      }
    } catch (error) {
      console.error('Error handling liveness completion:', error);
      showToast('Failed to process liveness completion. Please try again.', 'error');
      setShowLivenessTest(false);
      setLivenessInitiated(false);
      setLivenessCompleted(false);
    }
  };
  
  const handleLivenessClose = async () => {
    // Check if liveness test was completed successfully
    // If it was completed, don't navigate away - let handleLivenessComplete handle the flow
    if (livenessCompleted || progress?.liveness_test_completed) {
      setShowLivenessTest(false);
      setLivenessInitiated(false);
      return; // Don't navigate away if completed
    }

    try {
      // Create audit log for liveness test manual close
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'liveness_check',
        p_verification_type: 'liveness',
        p_verification_provider: 'internal',
        p_request_data: {
          action: 'liveness_test_manually_closed',
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'manually_closed_liveness_test',
          completion_status: 'cancelled'
        },
        p_status: 'failed',
        p_result_message: 'User manually closed liveness test',
        p_metadata: {
          component: 'KYCUpgradeScreen',
          action: 'liveness_manual_close',
          step: 'id_face_match'
        }
      });

      // Create audit event for liveness test manual close
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_cancelled',
            event_data: {
              action: 'liveness_test_manually_closed',
              reason: 'user_cancelled',
              step: 'id_face_match'
            },
            severity: 'low'
          });
      }
    } catch (error) {
      console.error('Error creating audit log for liveness close:', error);
      // Continue with the action even if audit fails
    }

    setShowLivenessTest(false);
    setLivenessInitiated(false);
    setLivenessManuallyClosed(true);
    // Only navigate to home when liveness test is manually closed (not completed)
    router.push('/(tabs)');
  };
  
  const verifyBvn = async () => {
    try {
      // Create audit log for BVN verification start
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'bvn_verified',
        p_verification_type: 'bvn',
        p_verification_provider: 'dojah',
        p_request_data: {
          action: 'start_bvn_verification',
          bvn: bvn,
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'initiated_bvn_verification',
          verification_status: 'pending'
        },
        p_status: 'pending',
        p_result_message: 'User initiated BVN verification process',
        p_metadata: {
          component: 'KYCUpgradeScreen',
          action: 'bvn_verification_start',
          step: 'bvn_verification'
        }
      });

      // Create audit event for BVN verification start
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_started',
            event_data: {
              action: 'bvn_verification_initiated',
              bvn: bvn,
              provider: 'dojah'
            },
            severity: 'medium'
          });
      }

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
      
      // Get selfie image for verification from saved form data
      let selfieImage = null;
      
      if (formData.selfie_url) {
        const base64Image = await convertImageToBase64(formData.selfie_url);
        if (base64Image) {
          selfieImage = `data:image/jpeg;base64,${base64Image}`;
        }
      }
      
      if (!selfieImage) {
        throw new Error('Selfie image is required for BVN verification. Please complete the liveness test first.');
      }
      
      // Make actual Dojah API call with selfie
      const response = await fetch('https://api.dojah.io/api/v1/kyc/bvn/verify', {
        method: 'POST',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selfie_image: selfieImage,
          bvn: parseInt(bvn)
        })
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
      
      // Check selfie verification result
      if (!bvnData.selfie_verification || !bvnData.selfie_verification.match) {
        throw new Error('Selfie verification failed. Please ensure your face is clearly visible and matches your BVN photo.');
      }
      
      console.log('Selfie verification confidence:', bvnData.selfie_verification.confidence_value);
      
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
        
        // Create audit log for BVN verification
        await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'bvn_verified',
          p_verification_type: 'bvn',
          p_verification_provider: 'dojah',
          p_request_data: {
            bvn: bvn,
            selfie_verification: true,
            name_matching: true
          },
          p_response_data: {
            bvn_data: bvnData,
            name_match_percentage: matchPercentage,
            selfie_confidence: bvnData.selfie_verification?.confidence_value,
            matched_name: displayName
          },
          p_status: 'success',
          p_result_message: `BVN verified successfully. Name: ${displayName}`,
          p_confidence_score: bvnData.selfie_verification?.confidence_value || 95.0,
          p_metadata: {
            component: 'kyc-upgrade',
            verification_step: 'bvn_verification',
            name_match_percentage: matchPercentage,
            provider: 'dojah'
          }
        });
        
        // BVN verification successful with Dojah
        showToast(`BVN verified! Name: ${displayName}`, 'success');
        
        // Update progress with BVN verified and check for Tier 1 completion
        // After BVN (Tier 1), move to id_face_match (NIN verification, still Tier 1)
        const progressResult = await updateProgress({
          current_step: 'id_face_match', // Move to NIN verification (Tier 1) after BVN
          bvn_verified: true
        });
        
        // Check if Tier 1 is complete (Liveness + BVN + NIN)
        if (progressResult) {
          await updateTier(); // Update tier after BVN verification
          const tierStatus = checkTierCompletion();
          if (tierStatus.tier1) {
            console.log('Tier 1 completed! User can now proceed to Tier 2.');
            showToast('Tier 1 completed! You can now deposit up to ₦20,000 monthly.', 'success');
          }
        }
        
        if (!progressResult) {
          showToast('Failed to update progress. Please try again.', 'error');
          return;
        }
        
        // Wait for toast to be visible before moving to next step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Move to next incomplete step (skip if already verified)
        const nextStep = getNextIncompleteStep('bvn_verification');
        setCurrentStep(nextStep);
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
    // Accept data URIs, file/content URIs, and http(s) URLs
    const isDataUri = imageUri.startsWith('data:image/');
    const isFileUri = imageUri.startsWith('file:');
    const isContentUri = imageUri.startsWith('content:');
    const isHttpUri = imageUri.startsWith('http://') || imageUri.startsWith('https://');
    if (!isDataUri && !isFileUri && !isContentUri && !isHttpUri) {
      return { isValid: false, error: 'Invalid image format. Please select a valid image.' };
    }

    // Only enforce size check for data URIs where we can read base64 length
    if (isDataUri) {
      const parts = imageUri.split(',');
      if (parts.length > 1) {
        const base64Data = parts[1];
        const sizeInBytes = (base64Data.length * 3) / 4; // Approximate
        const sizeInMB = sizeInBytes / (1024 * 1024);
        if (sizeInMB > 5) {
          return { isValid: false, error: 'Image size must be less than 5MB. Please select a smaller image.' };
        }
      }
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
      // Create audit log for document verification start
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'document_uploaded',
        p_verification_type: selectedIdentityType,
        p_verification_provider: 'dojah',
        p_request_data: {
          action: 'start_document_verification',
          document_type: selectedIdentityType,
          source: 'kyc_upgrade_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'initiated_document_verification',
          verification_status: 'pending'
        },
        p_status: 'pending',
        p_result_message: 'User initiated document verification process',
        p_metadata: {
          component: 'KYCUpgradeScreen',
          action: 'document_verification_start',
          step: 'documents_verification',
          document_type: selectedIdentityType
        }
      });

      // Create audit event for document verification start
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'document_uploaded',
            event_data: {
              action: 'document_verification_initiated',
              document_type: selectedIdentityType,
              provider: 'dojah'
            },
            severity: 'medium'
          });
      }

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

      // Validate image format for front (URLs or data URIs now allowed)
      const frontImageValidation = validateImage(documentFrontImage);
      if (!frontImageValidation.isValid) {
        throw new Error(frontImageValidation.error);
      }

      // if (documentBackImage) {
      //   const backImageValidation = validateImage(documentBackImage);
      //   if (!backImageValidation.isValid) {
      //     throw new Error(backImageValidation.error);
      //   }
      // }

      // Ensure we have URLs (already uploaded to storage via pickImage). If still data URI, upload now.
      let frontImageUrl = documentFrontImage;
      let backImageUrl = documentBackImage;

      if (frontImageUrl && frontImageUrl.startsWith('data:image/')) {
        const uploaded = await uploadDocumentToStorage(frontImageUrl, 'front');
        if (!uploaded) throw new Error('Failed to upload front document image');
        frontImageUrl = uploaded;
      }

      if (backImageUrl && backImageUrl.startsWith('data:image/')) {
        const uploadedBack = await uploadDocumentToStorage(backImageUrl, 'back');
        if (!uploadedBack) throw new Error('Failed to upload back document image');
        backImageUrl = uploadedBack;
      }

      // Call Dojah document analysis API directly
      const payload: any = {
        input_type: 'url',
        imagefrontside: frontImageUrl
      };

      if (backImageUrl) {
        payload.imagebackside = backImageUrl;
      }

      const analysisResponse = await fetch('https://api.dojah.io/api/v1/document/analysis', {
        method: 'POST',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Document analysis failed: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }

      const analysisData = await analysisResponse.json();
      console.log('Document analysis response:', {
        overall_status: analysisData.entity?.status?.overall_status,
        reason: analysisData.entity?.status?.reason,
        document_type: analysisData.entity?.document_type?.document_name
      });
      
      if (!analysisData.entity) {
        throw new Error('Invalid response from document analysis service');
      }

      if (analysisData.entity?.status?.overall_status !== 1) {
        throw new Error(`Document validation failed: ${analysisData.entity?.status?.reason || 'Invalid document'}`);
      }

      // Document analysis successful
      showToast('Document verified successfully!', 'success');

      // Persist document details AFTER successful verification
      try {
        const entity = analysisData.entity;
        const details: any = entity?.details || entity?.data || {};
        const extractedDocumentNumber = details.document_number || details.id_number || details.passport_number || details.number || null;

        await saveFormData({
          // Store full document_type object as JSON (column should be jsonb)
          document_type: entity?.document_type || null,
          document_number: extractedDocumentNumber || undefined,
          document_front_url: documentFrontImage || undefined,
          document_back_url: documentBackImage || undefined
        });
      } catch (persistError) {
        console.error('Error saving verified document data:', persistError);
        // Continue flow even if saving has issues; user can retry saving later
      }
      
      // Update progress with documents verified
      // After documents (Tier 2 complete), move to address (first step in Tier 3)
      const progressResult = await updateProgress({
        current_step: 'address_details', // Move to address details (Tier 3) after documents verification
        documents_verified: true
      });
      
      // Check if Tier 2 is complete (Tier 1 + Personal Info + Documents)
      if (progressResult) {
        await updateTier(); // Update tier after document verification
        const tierStatus = checkTierCompletion();
        if (tierStatus.tier2) {
          console.log('Tier 2 completed! User can now proceed to Tier 3.');
          showToast('Tier 2 completed! You can now deposit up to ₦100,000 monthly.', 'success');
        }
      }
      
      if (!progressResult) {
        showToast('Failed to update progress. Please try again.', 'error');
        return;
      }
      
      // Wait for toast to be visible before moving to next step
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Move to next incomplete step (skip if already verified)
      const nextStep = getNextIncompleteStep('documents_verification');
      setCurrentStep(nextStep);
      setTimeout(() => {
        setIsManualVerification(false);
      }, 1000);
      
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

  // const verifyDriversLicense = async (appId: string, privateKey: string) => {
  //   // Disabled: Driver's license verification is not supported. Use NIN only.
  // };

  const verifyNIN = async (appId: string, privateKey: string) => {
    try {
      if (!nin.trim()) {
        throw new Error('NIN is required');
      }

      if (!session?.user?.id) {
        throw new Error('User session not found');
      }

      // Get selfie image for verification from saved form data
      let selfieToUse = null;
      
      if (formData.selfie_url) {
        // Use the selfie URL directly (SafeHaven service will handle conversion)
        selfieToUse = formData.selfie_url;
      }
      
      if (!selfieToUse) {
        throw new Error('Selfie image is required for NIN verification. Please complete the liveness test first.');
      }

      // Get phone number and email for account creation
      const userPhoneNumber = phoneNumber?.trim() || '';
      const userEmail = session?.user?.email || '';
      
      if (!userPhoneNumber) {
        throw new Error('Phone number is required for NIN verification. Please enter your phone number in the personal information section.');
      }
      
      if (!userEmail) {
        throw new Error('Email address is required for NIN verification. Please ensure your email is verified.');
      }

      setIsLoading(true);
      setIsManualVerification(true);

      // Use SafeHaven service for NIN verification
      // Note: OTP is optional - if account creation fails with OTP error, we can handle it later
      const result = await safeHavenService.verifyNINAndCreateAccount(
        session.user.id,
        nin.trim(),
        userPhoneNumber,
        userEmail,
        selfieToUse
      );

      if (!result.success) {
        throw new Error(result.error || 'NIN verification failed');
      }

      const verificationData = result.data;
      
      // Check if verification was successful
      if (!verificationData || !verificationData.verified) {
        throw new Error('NIN verification failed. Please check your NIN and try again.');
      }

      // Get names from SafeHaven verification data
      const ninFirstName = verificationData.first_name || verificationData.firstName || '';
      const ninLastName = verificationData.last_name || verificationData.lastName || '';
      const ninMiddleName = verificationData.middle_name || verificationData.middleName || '';
      
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
        setDocumentsVerified(true);
        
        // Create a display name from NIN data
        const displayName = [ninFirstName, ninMiddleName, ninLastName]
          .filter(Boolean)
          .join(' ');
        
        // Create audit event for NIN verification (additional to what SafeHaven service already logged)
        if (result.auditLogId) {
          await supabase
            .from('kyc_audit_events')
            .insert({
              audit_log_id: result.auditLogId,
              user_id: session.user.id,
              event_type: 'verification_completed',
              event_data: {
                action: 'nin_verification_completed',
                nin: nin.substring(0, 4) + '****', // Partial NIN for security
                name_match_percentage: matchPercentage,
                matched_name: displayName,
                hasAccount: !!verificationData.account_number
              },
              severity: 'high'
            });

          // Create audit attachment for NIN document if available
          if (documentFrontImage) {
            await supabase
              .from('kyc_audit_attachments')
              .insert({
                audit_log_id: result.auditLogId,
                file_name: `nin-document-${Date.now()}.jpg`,
                file_type: 'image/jpeg',
                file_size: 0,
                file_hash: 'document-hash-placeholder',
                file_path: documentFrontImage,
                access_level: 'restricted',
                description: 'NIN document front image',
                tags: ['nin', 'document', 'kyc', 'id_verification', 'safehaven']
              });
          }
        }
        
        // Show success message
        let successMessage = `NIN verified! Name: ${displayName}`;
        if (verificationData.account_number) {
          successMessage += ` • Account created: ${verificationData.account_number.substring(0, 5)}****`;
        }
        showToast(successMessage, 'success');
        
        // Update progress with NIN verified
        // After NIN (Tier 1 complete), move to personal (first step in Tier 2)
        const progressResult = await updateProgress({
          current_step: 'personal', // Move to personal info (Tier 2) after NIN verification
          id_face_verified: true,
          nin_verified: true
        });
        
        // Check if Tier 1 is complete (Liveness + BVN + NIN)
        if (progressResult) {
          await updateTier(); // Update tier after NIN verification
          const tierStatus = checkTierCompletion();
          if (tierStatus.tier1) {
            console.log('Tier 1 completed! User can now proceed to Tier 2.');
            showToast('Tier 1 completed! You can now deposit up to ₦20,000 monthly.', 'success');
          }
        }
        
        if (!progressResult) {
          showToast('Failed to update progress. Please try again.', 'error');
          return;
        }
        
        // Wait for toast to be visible before moving to next step
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Move to next incomplete step (skip if already verified)
        const nextStep = getNextIncompleteStep('id_face_match');
        setCurrentStep(nextStep);
        setTimeout(() => {
          setIsManualVerification(false);
          setIsLoading(false);
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
      setIsLoading(false);
      throw error; // Re-throw to be handled by verifyDocuments
    }
  };
  
  const handlePreviousStep = async () => {
    try {
      // Get the previous incomplete step
      const previousStep = getPreviousIncompleteStep(currentStep);
      
      if (previousStep === null) {
        // No previous incomplete step, exit the flow
        router.back();
        return;
      }
      
      // Update progress to the previous incomplete step
      await updateProgress({ current_step: previousStep });
      setCurrentStep(previousStep);
    } catch (error) {
      console.error('Error in handlePreviousStep:', error);
      // Still allow navigation even if progress update fails
      const previousStep = getPreviousIncompleteStep(currentStep);
      if (previousStep) {
        setCurrentStep(previousStep);
      } else {
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

        // Create audit log for KYC completion
        const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'kyc_verified',
          p_verification_type: 'document',
          p_verification_provider: 'internal',
          p_request_data: {
            action: 'kyc_completion',
            all_steps_completed: true
          },
          p_response_data: {
            overall_completed: true,
            account_verified: true,
            completion_timestamp: new Date().toISOString()
          },
          p_status: 'success',
          p_result_message: 'KYC verification completed successfully',
          p_confidence_score: 100.0,
          p_metadata: {
            component: 'kyc-upgrade',
            verification_step: 'review',
            final_completion: true
          }
        });

        // Create audit event for KYC completion
        if (auditLogId) {
          await supabase
            .from('kyc_audit_events')
            .insert({
              audit_log_id: auditLogId,
              user_id: session.user.id,
              event_type: 'verification_completed',
              event_data: {
                action: 'kyc_verification_completed',
                all_steps_completed: true,
                account_verified: true
              },
              severity: 'high'
            });

          // Create audit summary for the KYC process
          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          await supabase
            .from('kyc_audit_summary')
            .upsert({
              user_id: session.user.id,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              period_type: 'monthly',
              total_verifications: 1,
              successful_verifications: 1,
              failed_verifications: 0,
              manual_reviews: 0,
              documents_uploaded: 1,
              documents_verified: 1,
              documents_rejected: 0,
              average_risk_score: 0.1,
              compliance_violations: 0,
              fraud_attempts: 0,
              provider_usage: {
                dojah: 1,
                internal: 1
              },
              total_cost: 0
            }, {
              onConflict: 'user_id,period_start,period_end,period_type'
            });
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
  
  // Date picker functions moved to DatePickerModal component

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
    setShowYearPicker(false);
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
    
    if (location.address) {
      const addressParts = [];
      
      // Extract house number if available
      if (location.address.house_number) {
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

  const handlePrevYear = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()));
  };

  const handleNextYear = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()));
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, currentMonth.getMonth(), 1);
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
      case 'liveness_verification': return 'Liveness Verification';
      case 'personal': return 'Personal Information';
      case 'bvn_verification': return 'BVN Verification';
      case 'id_face_match': return 'ID & Face Verification';
      case 'documents_verification': return 'Document Verification';
      case 'address_details': return 'Address Details';
      case 'review': return 'Review & Submit';
    }
  };
  
  const pickImage = async (setImageFunction: React.Dispatch<React.SetStateAction<string | null>>, type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          const uploadedUrl = await uploadDocumentToStorage(asset.uri, type === 'documentFront' ? 'front' : type === 'documentBack' ? 'back' : type);
          if (uploadedUrl) {
            setImageFunction(uploadedUrl);
            setErrors(prev => ({ ...prev, [type]: '' }));
          } else {
            showToast('Failed to upload image', 'error');
          }
        } else {
          showToast('No image selected', 'error');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  // Upload a selected/captured image to Supabase storage and return public URL
  const uploadDocumentToStorage = async (uri: string, part: 'front' | 'back' | 'house' | 'utility' | string): Promise<string | null> => {
    try {
      if (!session?.user?.id) {
        showToast('Authentication required', 'error');
        return null;
      }

      const fileExtensionGuess = uri.split('.').pop()?.toLowerCase();
      const ext = fileExtensionGuess && fileExtensionGuess.length <= 5 ? fileExtensionGuess : 'jpg';
      const fileName = `${part}-document-${Date.now()}.${ext}`;
      const filePath = `kyc-documents/${session.user.id}/${fileName}`;

      const file: any = {
        uri,
        name: fileName,
        type: 'image/jpeg',
      };

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        showToast('Upload failed. Please try again.', 'error');
        return null;
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      return urlData.publicUrl || null;
    } catch (e) {
      console.error('Upload exception:', e);
      return null;
    }
  };
  
  const takePicture = async (type: 'front' | 'back' | 'house' | 'utility') => {
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
            case 'house':
              setHouseUrl(imageData);
              setErrors(prev => ({ ...prev, houseUrl: '' }));
              break;
            case 'utility':
              setUtilityBill(imageData);
              setErrors(prev => ({ ...prev, utilityBill: '' }));
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
    }
  };


  // Helper function for numeric input handling
  const handleNumericInput = (
    text: string, 
    setter: (value: string) => void, 
    maxLength: number,
    errorKey: string
  ) => {
    // Remove all non-numeric characters
    const numericText = text.replace(/[^0-9]/g, '');
    
    // Only update if within length limit
    if (numericText.length <= maxLength) {
      setter(numericText);
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  
  // Handle camera permission request
  // Camera permission handling moved to CameraPermissionModal component
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'liveness_verification':
        // Skip rendering - modal will handle this step
        return null;
      case 'personal':
        return (
          <PersonalInfoStep
            firstName={firstName}
            lastName={lastName}
            middleName={middleName}
            dateOfBirth={dateOfBirth}
            phoneNumber={phoneNumber}
            address={address}
            addressNo={addressNo}
            errors={errors}
            onFirstNameChange={(text) => {
              setFirstName(text);
              setErrors(prev => ({ ...prev, firstName: '' }));
            }}
            onLastNameChange={(text) => {
              setLastName(text);
              setErrors(prev => ({ ...prev, lastName: '' }));
            }}
            onMiddleNameChange={setMiddleName}
            onDateOfBirthChange={(text) => {
              setDateOfBirth(text);
              setErrors(prev => ({ ...prev, dateOfBirth: '' }));
            }}
            onPhoneNumberChange={(text) => {
              setPhoneNumber(text);
              setErrors(prev => ({ ...prev, phoneNumber: '' }));
            }}
            onAddressChange={(text) => {
              setAddress(text);
              setErrors(prev => ({ ...prev, address: '' }));
            }}
            onAddressNoChange={(text) => {
              setAddressNo(text);
              setErrors(prev => ({ ...prev, addressNo: '' }));
            }}
            onDatePickerOpen={handleDatePickerOpen}
            onLocationSearchOpen={() => setShowLocationSearch(true)}
            lastNameInputRef={lastNameInputRef}
            middleNameInputRef={middleNameInputRef}
            phoneInputRef={phoneInputRef}
            addressInputRef={addressInputRef}
          />
        );
      case 'bvn_verification':
        return (
          <BVNVerificationStep
            bvn={bvn}
            errors={errors}
            bvnVerified={bvnVerified}
            bvnMatchedName={bvnMatchedName}
            isResolvingBvn={isResolvingBvn}
            onBvnChange={(text) => {
              setBvn(text);
              setErrors(prev => ({ ...prev, bvn: '' }));
            }}
            handleNumericInput={handleNumericInput}
            bvnInputRef={bvnInputRef}
          />
        );
      case 'id_face_match':
        return (
          <IDFaceMatchStep
            nin={nin}
            errors={errors}
            bvnVerified={bvnVerified}
            isVerifyingDocuments={isVerifyingDocuments}
            documentsVerified={documentsVerified}
            onNinChange={(text) => {
              setNin(text);
              setErrors(prev => ({ ...prev, nin: '' }));
            }}
          />
        );
      case 'documents_verification':
        return (
          <DocumentsVerificationStep
            selectedIdentityType={selectedIdentityType}
            documentFrontImage={documentFrontImage}
            documentBackImage={documentBackImage}
            errors={errors}
            onIdentityTypeChange={setSelectedIdentityType}
            onDocumentFrontImageChange={(uri) => {
              setDocumentFrontImage(uri);
              setErrors(prev => ({ ...prev, documentFront: '' }));
            }}
            onDocumentBackImageChange={(uri) => {
              setDocumentBackImage(uri);
              setErrors(prev => ({ ...prev, documentBack: '' }));
            }}
            onPickImage={async (setImageFunction, type) => {
              await pickImage(setImageFunction as React.Dispatch<React.SetStateAction<string | null>>, type);
            }}
            onTakePicture={takePicture}
          />
        );
      case 'address_details':
        return (
          <AddressDetailsStep
            addressNo={addressNo}
            address={address}
            lga={lga}
            state={state}
            houseUrl={houseUrl}
            utilityBill={utilityBill}
            errors={errors}
            onAddressNoChange={(text) => {
              setAddressNo(text);
              setErrors(prev => ({ ...prev, addressNo: '' }));
            }}
            onAddressChange={(text) => {
              setAddress(text);
              setErrors(prev => ({ ...prev, address: '' }));
            }}
            onLgaChange={(text) => {
              setLga(text);
              setErrors(prev => ({ ...prev, lga: '' }));
            }}
            onStateChange={(text) => {
              setState(text);
              setErrors(prev => ({ ...prev, state: '' }));
            }}
            onHouseUrlChange={(uri) => {
              setHouseUrl(uri);
              setErrors(prev => ({ ...prev, houseUrl: '' }));
            }}
            onUtilityBillChange={(uri) => {
              setUtilityBill(uri);
              setErrors(prev => ({ ...prev, utilityBill: '' }));
            }}
            onLocationSearchOpen={() => setShowLocationSearch(true)}
            onPickImage={async (setImageFunction, type) => {
              await pickImage(setImageFunction as React.Dispatch<React.SetStateAction<string | null>>, type);
            }}
            onTakePicture={takePicture}
            addressInputRef={addressInputRef}
          />
        );
      case 'review':
        return (
          <ReviewStep
            firstName={firstName}
            lastName={lastName}
            middleName={middleName}
            dateOfBirth={dateOfBirth}
            phoneNumber={phoneNumber}
            addressNo={addressNo}
            address={address}
            lga={lga}
            state={state}
            bvn={bvn}
            bvnVerified={bvnVerified}
            selectedIdentityType={selectedIdentityType}
            nin={nin}
            passportNumber={passportNumber}
            documentsVerified={documentsVerified}
            houseUrl={houseUrl}
            utilityBill={utilityBill}
          />
        );
    }
  };

  // Date picker modal moved to DatePickerModal component
  
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
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: headerPadding,
      paddingVertical: headerPadding,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
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
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      zIndex: 1,
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
      borderWidth: 0.5,
      borderColor: colors.border,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      height: inputHeight,
    },
    inputError: {
      borderColor: colors.error,
    },
    resolvedInput: {
      borderColor: colors.success,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
      marginLeft: 12,
    },
    calendarIconButton: {
      padding: 4,
      borderRadius: 6,
    },
    dateInputContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dateInputText: {
      fontSize: 18,
      color: colors.text,
      marginLeft: 12,
    },
    dateInputPlaceholder: {
      color: colors.textTertiary,
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
    livenessButton: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
      borderColor: colors.success,
    },
    focusButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 6,
      marginLeft: 8,
    },
    focusButtonText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
    inputHelpText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
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
      alignSelf: 'center',
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
    datePickerCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      position: 'relative',
    },
    navigationButton: {
      width: 40,
      height: 40,
      padding: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
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
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '500',
      color: colors.text,
    },
    yearPickerContainer: {
      maxHeight: 400,
      marginBottom: 24,
    },
    yearPickerContent: {
      paddingBottom: 8,
    },
    yearPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
    yearItem: {
      width: `${100/4}%`,
      aspectRatio: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
    },
    yearItemSelected: {
      backgroundColor: colors.primary,
    },
    yearItemText: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.text,
      fontWeight: '500',
    },
    yearItemTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    yearItemTextCurrent: {
      color: colors.primary,
    },
    calendarContainer: {
      width: '100%',
      alignSelf: 'center',
    },
    weekDays: {
      flexDirection: 'row',
      marginBottom: 8,
      width: '100%',
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      minHeight: 32,
    },
    weekDayText: {
      fontSize: isSmallScreen ? 11 : 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    daysGridContainer: {
      width: '100%',
      marginBottom: 24,
    },
    weekRow: {
      flexDirection: 'row',
      width: '100%',
      marginBottom: 4,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 2,
      minHeight: 40,
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
      height: 55,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 100,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      height: 55,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 100,
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
    identityTypeContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    identityTypeOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    identityTypeSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    },
    identityTypeText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    identityTypeTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    imageUploadContainer: {
      height: 200,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
      marginTop: 8,
      overflow: 'hidden',
    },
    uploadedImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    uploadPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    uploadText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    // Permission modal styles
    permissionModal: {
      width: '90%',
      maxWidth: 400,
      borderRadius: 16,
      padding: 24,
      alignSelf: 'center',
    },
    permissionModalHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    permissionIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    permissionDeniedIconContainer: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
    },
    permissionModalTitle: {
      fontSize: isSmallScreen ? 20 : 24,
      fontWeight: '600',
      textAlign: 'center',
    },
    permissionModalContent: {
      marginBottom: 24,
    },
    permissionModalText: {
      fontSize: isSmallScreen ? 14 : 16,
      lineHeight: isSmallScreen ? 20 : 24,
      textAlign: 'center',
      marginBottom: 20,
    },
    permissionModalSubtext: {
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
      textAlign: 'center',
      marginTop: 16,
    },
    permissionInfoList: {
      gap: 12,
      marginTop: 8,
    },
    permissionInfoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    permissionInfoText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
    },
    permissionWarningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 16,
    },
    permissionWarningText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      lineHeight: isSmallScreen ? 18 : 20,
      fontWeight: '500',
    },
    permissionModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    permissionModalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionModalButtonPrimary: {
      // backgroundColor set inline
    },
    permissionModalButtonSecondary: {
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    permissionModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    permissionModalButtonTextPrimary: {
      color: '#FFFFFF',
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
        {/* <Pressable onPress={handlePreviousStep} style={styles.backButton}>
          <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable> */}
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Account Verification</Text>
        </View>
        
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <X size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
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
            (progressLoading && currentStep !== 'liveness_verification') || // Allow liveness step even if progress is loading
            isResolvingBvn || 
            isVerifyingDocuments || 
            (currentStep === 'bvn_verification' && bvnVerified) ||
            (currentStep === 'id_face_match' && documentsVerified)
          }
          loading={isLoading || formDataLoading || (progressLoading && currentStep !== 'liveness_verification') || isResolvingBvn || isVerifyingDocuments}
        />
      )}
      
      <DatePickerModal
        visible={isDatePickerVisible}
        selectedDate={selectedDate}
        currentMonth={currentMonth}
        showYearPicker={showYearPicker}
        onClose={handleDatePickerClose}
        onDateSelect={handleDateSelect}
        onDateConfirm={handleDateConfirm}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
        onYearSelect={handleYearSelect}
        onShowYearPicker={setShowYearPicker}
      />
      
      <LocationSearchModal
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelectLocation={handleLocationSelect}
        placeholder="Search for your address..."
      />
      
      <LivenessTestEnhanced 
        isVisible={showLivenessTest}
        onClose={handleLivenessClose}
        onComplete={handleLivenessComplete}
      />
      
      <CameraPermissionModal
        isVisible={showCameraPermissionModal}
        onClose={() => {
          setShowCameraPermissionModal(false);
          router.back();
        }}
        onComplete={(selfieUrl: string) => {
          // Handle liveness completion if needed
          handleLivenessComplete(selfieUrl);
        }}
      />
    </SafeAreaView>
  );
}