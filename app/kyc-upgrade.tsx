import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Image, Modal, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, User, Calendar, Info, ChevronRight, Check, CreditCard, Camera, Upload, MapPin, ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import LocationSearchModal from '@/components/LocationSearchModal';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress, KYCStep } from '@/hooks/useKYCProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import LivenessTest from '@/components/LivenessTest';

type IdentityType = 'bvn' | 'nin' | 'passport';

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
  const [bvnVerified, setBvnVerified] = useState(false);
  const [documentsVerified, setDocumentsVerified] = useState(false);
  
  // LivenessTest integration
  const [showLivenessTest, setShowLivenessTest] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [livenessInitiated, setLivenessInitiated] = useState(false);
  const [livenessManuallyClosed, setLivenessManuallyClosed] = useState(false);
  
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
  const dobInputRef = useRef<TextInput>(null);
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
      
      // Check if selfie is required and we're on the right step
      if (!formData.selfie_url && progress?.current_step === 'bvn_verification' && !livenessInitiated && !showLivenessTest && !livenessManuallyClosed) {
        console.log('No selfie found and on BVN verification step, initiating liveness test...');
        setShowLivenessTest(true);
        setLivenessInitiated(true);
      }
    }
  }, [formData, livenessInitiated, progress?.current_step, showLivenessTest, livenessManuallyClosed]);

  // Update current step when progress changes
  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.current_step);
      setBvnVerified(progress.bvn_verified);
      setDocumentsVerified(progress.documents_verified);
      
      // Verification status is handled by individual flags
      // Set verification status without showing toasts on initial load
      // if (progress.overall_completed) {
      //   setVerificationStatus('fully_verified');
      //   // Don't show toast on initial load - only show when user completes verification
      // } else if (progress.bvn_verified && progress.documents_verified) {
      //   setVerificationStatus('partially_verified');
      //   // showToast('Your identity is verified. Please complete address details', 'info');
      // } else if (progress.bvn_verified) {
      //   setVerificationStatus('partially_verified');
      // } else {
      //   setVerificationStatus('unverified');
      // }
    }
  }, [progress, showToast, isManualVerification]);

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
    }
    
    if (!documentFrontImage) {
      newErrors.documentFront = 'Front of document is required';
    }
    
    if (selectedIdentityType === 'passport' && !documentBackImage) {
      newErrors.documentBack = 'Back of document is required';
    }
    
    if (!selfieImage && !capturedSelfie) {
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
      // Upload and validation states removed
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
              
              // Check if selfie is required and initialize LivenessTest
              if (!formData.selfie_url) {
                console.log('No selfie found in database, initiating liveness test...');
                setShowLivenessTest(true);
                setLivenessInitiated(true);
                setLivenessManuallyClosed(false); // Reset the manually closed flag
                // Don't proceed to next step yet, wait for liveness completion
                return;
              } else {
                console.log('Selfie already exists in database, proceeding to BVN verification');
                // Proceed to BVN verification step
                setCurrentStep('bvn_verification');
                setTimeout(() => {
                  setIsManualVerification(false);
                }, 1000);
              }
              
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
        case 'id_face_match':
          if (validateIdFaceMatch()) {
            setIsLoading(true);
            
            // Save identity and document data
            const saveResult = await saveFormData({
              nin: nin,
              document_type: selectedIdentityType,
              document_number: selectedIdentityType === 'nin' ? nin : 
                             selectedIdentityType === 'passport' ? passportNumber : '',
              document_front_url: documentFrontImage || undefined,
              document_back_url: documentBackImage || undefined,
              selfie_url: selfieImage || capturedSelfie || undefined
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
  
  // Upload selfie image to Supabase storage with retry logic
  const uploadSelfieImage = async (imagePath: string, retryCount = 0): Promise<string | null> => {
    try {
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      console.log('Starting selfie upload, attempt:', retryCount + 1);

      // Read the image file with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      console.log('Reading image from path:', imagePath);
      
      // Handle different image path formats
      let imageUrl = imagePath;
      if (imagePath.startsWith('file://')) {
        imageUrl = imagePath;
      } else if (!imagePath.startsWith('http')) {
        imageUrl = `file://${imagePath}`;
      }
      
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'image/jpeg',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to read image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Image blob size:', blob.size);
      console.log('Image blob:', blob);
      
      // Check if blob is too small (might be corrupted)
      if (blob.size < 10000) { // Less than 10KB is suspicious
        console.warn('Image blob size is very small, might be corrupted:', blob.size);
        throw new Error('Image file appears to be corrupted or too small');
      }
      
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `liveness-selfie-${session.user.id}-${timestamp}.jpg`;
      const filePath = `kyc-documents/${fileName}`; // Removed 'documents/' prefix

      console.log('Uploading to path:', filePath);

      // Upload to Supabase storage
      console.log('Attempting to upload to Supabase storage...');
      console.log('Upload details:', {
        filePath,
        blobSize: blob.size,
        blobType: blob.type,
        bucket: 'documents'
      });
      
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      const { error: testError } = await supabase.storage
        .from('documents')
        .list('kyc-documents', { limit: 1 });
      
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        console.log('Trying to create kyc-documents folder...');
        
        // Try to create a dummy file to create the folder
        const dummyBlob = new Blob(['dummy'], { type: 'text/plain' });
        const { error: createError } = await supabase.storage
          .from('documents')
          .upload('kyc-documents/.gitkeep', dummyBlob, {
            contentType: 'text/plain',
            upsert: true
          });
        
        if (createError) {
          console.error('Failed to create kyc-documents folder:', createError);
          throw new Error(`Supabase connection failed: ${testError.message}`);
        } else {
          console.log('kyc-documents folder created successfully');
        }
      } else {
        console.log('Supabase connection test successful');
      }
      
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error details:', {
          error,
          message: error.message,
          statusCode: error.statusCode,
          filePath,
          blobSize: blob.size,
          errorName: error.name,
          errorStack: error.stack
        });
        
        // Try uploading to root of documents bucket if kyc-documents folder fails
        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          console.log('Trying fallback upload to root of documents bucket...');
          const fallbackPath = fileName;
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('documents')
            .upload(fallbackPath, blob, {
              contentType: 'image/jpeg',
              upsert: false
            });
          
          if (fallbackError) {
            console.error('Fallback upload also failed:', fallbackError);
            throw error; // Throw original error
          } else {
            console.log('Fallback upload successful:', fallbackData);
            // Update filePath for URL generation
            const { data: urlData } = supabase.storage
              .from('documents')
              .getPublicUrl(fallbackPath);
            return urlData.publicUrl;
          }
        }
        
        // Try alternative upload method with different parameters
        console.log('Trying alternative upload method...');
        try {
          const { data: altData, error: altError } = await supabase.storage
            .from('documents')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true // Try with upsert true
            });
          
          if (altError) {
            console.error('Alternative upload also failed:', altError);
            throw error; // Throw original error
          } else {
            console.log('Alternative upload successful:', altData);
            const { data: urlData } = supabase.storage
              .from('documents')
              .getPublicUrl(filePath);
            return urlData.publicUrl;
          }
        } catch (altError) {
          console.error('Alternative upload method failed:', altError);
          throw error; // Throw original error
        }
      }

      console.log('Upload successful, data:', data);

      // Get the public URL
      const { data: urlData, error: urlError } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (urlError) {
        console.error('Error getting public URL:', urlError);
        throw urlError;
      }

      console.log('Generated public URL:', urlData.publicUrl);
      
      // Verify the file exists in the bucket
      const { data: verifyData, error: verifyError } = await supabase.storage
        .from('documents')
        .list('kyc-documents', {
          search: fileName
        });
      
      if (verifyError) {
        console.error('Error verifying file in bucket:', verifyError);
      } else {
        console.log('File verification in bucket:', verifyData);
        if (verifyData && verifyData.length > 0) {
          console.log('File confirmed to exist in bucket');
        } else {
          console.warn('File not found in bucket after upload');
        }
      }
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading selfie image (attempt', retryCount + 1, '):', error);
      
      // Retry logic for network errors
      if (retryCount < 2 && (error instanceof TypeError || (error as any)?.name === 'AbortError')) {
        console.log('Retrying upload in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return uploadSelfieImage(imagePath, retryCount + 1);
      }
      
      return null;
    }
  };

  // Convert image URL to base64 for API calls
  const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove the data URL prefix to get just the base64 string
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

  // Handle LivenessTest completion
  const handleLivenessComplete = async (capturedImage: string) => {
    try {
      console.log('Liveness test completed, processing image:', capturedImage);
      setCapturedSelfie(capturedImage);
      
      // Show loading state
      showToast('Processing selfie image...', 'info');
      
      // Upload selfie to Supabase storage
      const selfieUrl = await uploadSelfieImage(capturedImage);
      
      if (selfieUrl) {
        console.log('Selfie uploaded successfully, URL:', selfieUrl);
        console.log('Saving selfie URL to database...');
        
        // Save selfie URL to database
        const saveResult = await saveFormData({
          selfie_url: selfieUrl
        });
        
        console.log('Database save result:', saveResult);
        
        if (saveResult) {
          console.log('Selfie URL saved to database successfully');
          
          // Verify the save by checking formData
          console.log('Current formData after save:', formData);
          
          // Additional verification: query the database directly
          try {
            if (session?.user?.id) {
              const { data: verifyDbData, error: verifyDbError } = await supabase
                .from('kyc_data')
                .select('selfie_url')
                .eq('user_id', session.user.id)
                .single();
            
              if (verifyDbError) {
                console.error('Error verifying database save:', verifyDbError);
              } else {
                console.log('Database verification - selfie_url:', verifyDbData?.selfie_url);
              }
            }
          } catch (verifyError) {
            console.error('Error during database verification:', verifyError);
          }
          
          showToast('Selfie captured and saved successfully', 'success');
          
          // Liveness completed
          setShowLivenessTest(false);
          setLivenessInitiated(false);
          setLivenessManuallyClosed(false); // Reset the manually closed flag
          
          // Proceed to BVN verification step
          setCurrentStep('bvn_verification');
          setTimeout(() => {
            setIsManualVerification(false);
          }, 1000);
        } else {
          console.error('Failed to save selfie URL to database');
          showToast('Selfie captured but failed to save to database', 'error');
          setShowLivenessTest(false);
          setLivenessInitiated(false);
        }
      } else {
        console.error('Failed to upload selfie image');
        showToast('Failed to upload selfie image. Please try again.', 'error');
        setShowLivenessTest(false);
        setLivenessInitiated(false);
      }
    } catch (error) {
      console.error('Error handling liveness completion:', error);
      showToast('Failed to process selfie image. Please try again.', 'error');
      setShowLivenessTest(false);
      setLivenessInitiated(false);
    }
  };
  
  const handleLivenessClose = () => {
    setShowLivenessTest(false);
    setLivenessInitiated(false);
    setLivenessManuallyClosed(true);
    // Navigate to home when liveness test is closed
    router.push('/(tabs)');
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
      
      // Get selfie image for verification
      let selfieImage = capturedSelfie;
      
      // If no captured selfie, try to get from saved form data
      if (!selfieImage && formData.selfie_url) {
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
        
        // BVN verification successful with Dojah
        showToast(`BVN verified! Name: ${displayName}`, 'success');
        
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

      // if (documentBackImage) {
      //   const backImageValidation = validateImage(documentBackImage);
      //   if (!backImageValidation.isValid) {
      //     throw new Error(backImageValidation.error);
      //   }
      // }

      // Verify based on document type first (before saving anything )
      // if (selectedIdentityType === 'drivers_license') {
      //   await verifyDriversLicense(appId, privateKey);
      // } else 
      if (selectedIdentityType === 'nin') {
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

  // const verifyDriversLicense = async (appId: string, privateKey: string) => {
  //   // Disabled: Driver's license verification is not supported. Use NIN only.
  // };

  const verifyNIN = async (appId: string, privateKey: string) => {
    try {
      if (!nin.trim()) {
        throw new Error('NIN is required');
      }

      // Get selfie image for verification
      let selfieToUse = capturedSelfie || selfieImage;
      
      // If no captured selfie, try to get from saved form data
      if (!selfieToUse && formData.selfie_url) {
        const base64Image = await convertImageToBase64(formData.selfie_url);
        if (base64Image) {
          selfieToUse = `data:image/jpeg;base64,${base64Image}`;
        }
      }
      
      if (!selfieToUse) {
        throw new Error('Selfie image is required for NIN verification. Please complete the liveness test first.');
      }
      
      // Convert selfie image to base64 (remove data:image/jpeg;base64, prefix)
      const selfieBase64 = selfieToUse.split(',')[1];

      // Make Dojah API call for NIN verification
      const response = await fetch('https://api.dojah.io/api/v1/kyc/nin/verify', {
        method: 'POST',
        headers: {
          'AppId': appId,
          'Authorization': privateKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selfie_image: `data:image/jpeg;base64,${selfieBase64}`,
          nin: parseInt(nin)
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
          Please enter your Bank Verification Number (BVN) for identity verification.
        </Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bank Verification Number (BVN)</Text>
          <View style={[styles.inputContainer, errors.bvn && styles.inputError]}>
            <CreditCard size={20} color={colors.textSecondary} />
            <TextInput
              ref={bvnInputRef}
              style={styles.input}
              placeholder="Enter your 11-digit BVN"
              placeholderTextColor={colors.textTertiary}
              value={bvn}
              onChangeText={(text) => handleNumericInput(text, setBvn, 11, 'bvn')}
              keyboardType="numeric"
              maxLength={11}
              editable={!isResolvingBvn && !bvnVerified}
              autoCorrect={false}
              autoCapitalize="none"
              selectTextOnFocus={true}
              blurOnSubmit={false}
              returnKeyType="done"
              textContentType="none"
              autoComplete="off"
              importantForAutofill="no"
              spellCheck={false}
            />
            {/* {!bvn && !isResolvingBvn && !bvnVerified && (
              <Pressable
                style={styles.focusButton}
                onPress={() => forceFocusInput(bvnInputRef)}
              >
                <Text style={styles.focusButtonText}>Tap to focus</Text>
              </Pressable>
            )} */}
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
          {/* {!bvn && (
            <Text style={styles.inputHelpText}>
              💡 Having trouble typing? Tap the &quot;Tap to focus&quot; button above
            </Text>
          )} */}
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
            Your BVN is used for verification purposes only. This helps us confirm your identity and protect your account.
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
                selectedIdentityType === 'passport' ? 'passport' : 'document'
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
          
          {selectedIdentityType === 'passport' && (
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
              Complete the liveness test to capture a secure selfie for verification. This advanced security feature ensures your identity is verified through facial recognition and prevents fraud.
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
                  onPress={() => {
                    setSelfieImage(null);
                    setShowLivenessTest(true);
                    haptics.lightImpact();
                  }}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Text style={styles.retakeButtonText}>Retake with Liveness Test</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.documentActions}>
                <Pressable 
                  style={[styles.documentButton, styles.livenessButton, { flex: 1 }]}
                  onPress={() => {
                    setShowLivenessTest(true);
                    haptics.lightImpact();
                  }}
                  disabled={isVerifyingDocuments || documentsVerified}
                >
                  <Shield size={16} color={colors.primary} />
                  <Text style={styles.documentButtonText}>Start Liveness Test</Text>
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
                 'Not provided'}
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
              <Pressable onPress={handleDatePickerClose} style={styles.datePickerCloseButton}>
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
    resolvedInput: {
      borderColor: colors.success,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
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
      
      
      <LivenessTest 
        isVisible={showLivenessTest}
        onClose={handleLivenessClose}
        onComplete={handleLivenessComplete}
      />
    </SafeAreaView>
  );
}