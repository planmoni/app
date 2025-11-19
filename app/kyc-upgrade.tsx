import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, useWindowDimensions, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import LocationSearchModal from '@/components/LocationSearchModal';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { supabase } from '@/lib/supabase';
import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import CameraPermissionModal from '@/components/CameraPermissionModal';
import KYCVerificationModal from '@/components/KYCVerificationModal';
import Tier1CompletionModal from '@/components/Tier1CompletionModal';
import Tier2CompletionModal from '@/components/Tier2CompletionModal';
import Tier3CompletionModal from '@/components/Tier3CompletionModal';
// Hooks
import { useKYCFormState } from '@/hooks/useKYCFormState';
import { useKYCNavigation } from '@/hooks/useKYCNavigation';
import { useKYCLiveness } from '@/hooks/useKYCLiveness';
import { useKYCDatePicker } from '@/hooks/useKYCDatePicker';
// KYC Step Components (UI only)
import PersonalInfoStep from '@/components/KYCSteps/PersonalInfoStep';
import AddressDetailsStep from '@/components/KYCSteps/AddressDetailsStep';
import ReviewStep from '@/components/KYCSteps/ReviewStep';
// Self-contained verification components
import BVNVerification, { BVNVerificationHandle } from '@/components/KYCSteps/BVNVerification';
import NINVerification, { NINVerificationHandle } from '@/components/KYCSteps/NINVerification';
import DocumentVerification, { DocumentVerificationHandle } from '@/components/KYCSteps/DocumentVerification';
import { IdentityType } from '@/components/KYCSteps/types';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Custom hooks for KYC data and progress
  const { formData, loading: formDataLoading, saveFormData } = useKYCData();
  const { progress, loading: progressLoading, updateProgress, updateTier, checkTierCompletion } = useKYCProgress();
  
  const normalizeBooleanFlag = (value: any) =>
    value === true || value === 'true' || value === 1 || value === '1';

  // Use custom hooks for state management
  const formState = useKYCFormState();
  const navigation = useKYCNavigation();
  const liveness = useKYCLiveness(navigation.currentStep);
  const datePicker = useKYCDatePicker(formState.dateOfBirth);
  
  // Refs for verification components
  const bvnVerificationRef = useRef<BVNVerificationHandle>(null);
  const ninVerificationRef = useRef<NINVerificationHandle>(null);
  const documentVerificationRef = useRef<DocumentVerificationHandle>(null);
  
  // Local UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showTier1CompletionModal, setShowTier1CompletionModal] = useState(false);
  const [showTier2CompletionModal, setShowTier2CompletionModal] = useState(false);
  const [showTier3CompletionModal, setShowTier3CompletionModal] = useState(false);
  const [selectedIdentityType, setSelectedIdentityType] = useState<IdentityType>('nin');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [processingExternalLiveness, setProcessingExternalLiveness] = useState(false);
  const hasProcessedSelfieParamRef = useRef(false);
  
  // Verification status (for UI display)
  const [bvnVerified, setBvnVerified] = useState(false);
  const [documentsVerified, setDocumentsVerified] = useState(false);

  // Check for route params to show CameraPermissionModal
  useEffect(() => {
    if (params.showCameraPermission === 'true' && navigation.currentStep === 'bvn_verification' && !progress?.liveness_test_completed) {
      console.log('[KYC] Route param detected, showing CameraPermissionModal');
      liveness.setShowCameraPermissionModal(true);
      liveness.setLivenessInitiated(true);
      router.setParams({ showCameraPermission: undefined });
    }
  }, [params.showCameraPermission, navigation.currentStep, progress?.liveness_test_completed]);

  const selfieUrlParam = Array.isArray(params.selfieUrl) ? params.selfieUrl[0] : params.selfieUrl;

  useEffect(() => {
    const selfieUrl = typeof selfieUrlParam === 'string' ? selfieUrlParam : undefined;
    if (!selfieUrl) {
      hasProcessedSelfieParamRef.current = false;
      return;
    }

    if (hasProcessedSelfieParamRef.current) return;
    hasProcessedSelfieParamRef.current = true;
    let isMounted = true;

    const processExternalLiveness = async () => {
      try {
        console.log('[KYC] Processing external liveness selfieUrl param');
        setProcessingExternalLiveness(true);
        await handleLivenessCompleteWrapper(selfieUrl);
        if (isMounted) {
          router.setParams({ selfieUrl: undefined });
        }
      } catch (error) {
        console.error('[KYC] Failed to process liveness selfieUrl param:', error);
        showToast('Failed to process liveness verification. Please try again.', 'error');
      } finally {
        if (isMounted) {
          setProcessingExternalLiveness(false);
        }
      }
    };

    processExternalLiveness();

    return () => {
      isMounted = false;
    };
  }, [selfieUrlParam]);

  // Update verification status when progress changes
  useEffect(() => {
    if (progress) {
      setBvnVerified(normalizeBooleanFlag(progress.bvn_verified));
      setDocumentsVerified(normalizeBooleanFlag(progress.documents_verified));
      
      // Load document type
      if (formData?.document_type) {
        setSelectedIdentityType(formData.document_type as IdentityType);
      }
    }
  }, [progress, formData]);
  

  
  const validatePersonalInfo = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formState.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formState.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!datePicker.dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formState.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formState.address.trim()) newErrors.address = 'Address is required';
    
    // Validate date format (DD/MM/YYYY)
    if (datePicker.dateOfBirth && !/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(datePicker.dateOfBirth)) {
      newErrors.dateOfBirth = 'Please enter a valid date (DD/MM/YYYY)';
    }
    
    // Validate phone number (Nigerian format)
    if (formState.phoneNumber && !/^0[789][01]\d{8}$/.test(formState.phoneNumber)) {
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
  
  const validateAddressDetails = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formState.address.trim()) newErrors.address = 'Address is required';
    if (!formState.lga.trim()) newErrors.lga = 'Local Government Area is required';
    if (!formState.state.trim()) newErrors.state = 'State is required';
    if (!formState.houseUrl) newErrors.houseUrl = 'House photo is required';
    
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
    const userAddress = formState.addressNo || '';

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
    if (!formState.utilityBill || !session?.user?.id) {
      showToast('Please select a utility bill image first.', 'error');
      return;
    }

    // Upload and validation states removed

    try {
      // Upload image to Supabase storage
      showToast('Uploading utility bill...', 'info');
      
      // Get file extension from URI
      const fileExtension = formState.utilityBill.split('.').pop() || 'jpg';
      const fileName = `utility-bill.${fileExtension}`;
      const filePath = `${session.user.id}/${fileName}`;

      // Convert image to blob for upload
      const response = await fetch(formState.utilityBill);
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
    console.log('[KYC] handleNextStep called, currentStep:', navigation.currentStep);
    try {
      setIsLoading(true);
      
      switch (navigation.currentStep) {
        case 'bvn_verification':
          if (bvnVerificationRef.current) {
            const success = await bvnVerificationRef.current.verify();
            if (success) {
              await navigation.goToNextStep('bvn_verification');
            }
          }
          break;

        case 'id_face_match':
          if (ninVerificationRef.current) {
            // Check if initialized - if not, initialize first
            if (!ninVerificationRef.current.isValid()) {
              const initialized = await ninVerificationRef.current.initialize();
              if (!initialized) {
                setIsLoading(false);
                return; // Wait for OTP input
              }
            }
            // Then verify
            const success = await ninVerificationRef.current.verify();
            if (success) {
              await navigation.goToNextStep('id_face_match');
              // Check for Tier 1 completion
              const tierStatus = checkTierCompletion();
              if (tierStatus.tier1) {
                setTimeout(() => {
                  setShowTier1CompletionModal(true);
                }, 300);
              }
            }
          }
          break;

        case 'personal':
          if (validatePersonalInfo()) {
            const saveResult = await saveFormData({
              first_name: formState.firstName,
              last_name: formState.lastName,
              middle_name: formState.middleName,
              date_of_birth: datePicker.dateOfBirth,
              phone_number: formState.phoneNumber,
              address: formState.address,
              house_url: formState.houseUrl || undefined,
              address_lat: formState.addressLat,
              address_lon: formState.addressLon,
              address_place_id: formState.addressPlaceId,
              address_no: formState.addressNo
            });
            
            if (!saveResult) {
              showToast('Failed to save personal information. Please try again.', 'error');
              setIsLoading(false);
              return;
            }
            
            await updateProgress({
              current_step: 'documents_verification',
              personal_info_completed: true
            });
            
            await navigation.goToNextStep('personal');
          }
          break;

        case 'documents_verification':
          if (documentVerificationRef.current) {
            const success = await documentVerificationRef.current.verify();
            if (success) {
              await navigation.goToNextStep('documents_verification');
              const tierStatus = checkTierCompletion();
              if (tierStatus.tier2) {
                setTimeout(() => {
                  setShowTier2CompletionModal(true);
                }, 300);
              }
            }
          }
          break;

        case 'address_details':
          if (validateAddressDetails()) {
            if (formState.utilityBill) {
              await uploadUtilityBill();
            }
            
            const saveResult = await saveFormData({
              address_no: formState.addressNo,
              lga: formState.lga,
              state: formState.state,
              house_url: formState.houseUrl || undefined,
              utility_bill_url: formState.utilityBill || undefined,
              utility_bill_validated: validationResult?.isValid || false,
              utility_bill_validation_result: validationResult || undefined,
            });
            
            if (!saveResult) {
              showToast('Failed to save address details. Please try again.', 'error');
              setIsLoading(false);
              return;
            }
            
            const utilityBillVerified = formState.utilityBill && validationResult?.isValid;
            
            await updateProgress({
              current_step: 'review',
              address_completed: true,
              utility_bill_verified: utilityBillVerified || false
            });
            
            await updateTier();
            const tierStatus = checkTierCompletion();
            if (tierStatus.tier3) {
              setTimeout(() => {
                setShowTier3CompletionModal(true);
              }, 300);
            }
            
            await navigation.goToNextStep('address_details');
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
  

  // Handle liveness completion - update progress and close modals
  const handleLivenessCompleteWrapper = async (selfieUrl: string) => {
    const success = await liveness.handleLivenessComplete(selfieUrl);
    if (success) {
      await updateProgress({
        current_step: 'bvn_verification',
        liveness_test_completed: true
      });
      // Close modals after delay
      setTimeout(() => {
        liveness.setShowLivenessTest(false);
        liveness.setShowCameraPermissionModal(false);
      }, 800);
    }
  };

  // Handle Tier1CompletionModal actions
  const handleTier1GoToDashboard = () => {
    router.push('/(tabs)');
  };

  const handleTier1UpgradeToTier2 = () => {
    navigation.goToStep('personal');
  };

  // Handle Tier2CompletionModal actions
  const handleTier2GoToDashboard = () => {
    router.push('/(tabs)');
  };

  const handleTier2UpgradeToTier3 = () => {
    navigation.goToStep('address_details');
  };

  // Handle Tier3CompletionModal actions
  const handleTier3GoToDashboard = () => {
    router.push('/(tabs)');
  };
  
  const handleLocationSelect = (location: any) => {
    let detailedAddress = location.display_name;
    
    if (location.address) {
      const addressParts = [];
      
      if (location.address.house_number) {
        addressParts.push(location.address.house_number);
      }
      
      if (location.address.road) {
        addressParts.push(location.address.road);
      }
      
      if (location.address.suburb) {
        addressParts.push(location.address.suburb);
      }
      
      if (location.address.city) {
        addressParts.push(location.address.city);
      }
      
      if (location.address.state) {
        addressParts.push(location.address.state);
      }
      
      if (addressParts.length > 0) {
        detailedAddress = addressParts.join(', ');
      }
    }
    
    formState.setAddress(detailedAddress);
    formState.setAddressLat(location.lat);
    formState.setAddressLon(location.lon);
    formState.setAddressPlaceId(location.place_id.toString());
    
    if (location.address) {
      if (location.address.city) {
        formState.setLga(location.address.city);
      }
      if (location.address.state) {
        formState.setState(location.address.state);
      }
    }
    
    setErrors(prev => ({ ...prev, address: '' }));
    
    saveFormData({
      address: detailedAddress,
      address_lat: location.lat,
      address_lon: location.lon,
      address_place_id: location.place_id.toString(),
      lga: location.address?.city || '',
      state: location.address?.state || ''
    });
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
          const uploadedUrl = await uploadDocumentToStorage(imageData, type);
          if (uploadedUrl) {
            switch (type) {
              case 'front':
                formState.setDocumentFrontImage(uploadedUrl);
                setErrors(prev => ({ ...prev, documentFront: '' }));
                break;
              case 'back':
                formState.setDocumentBackImage(uploadedUrl);
                setErrors(prev => ({ ...prev, documentBack: '' }));
                break;
              case 'house':
                formState.setHouseUrl(uploadedUrl);
                setErrors(prev => ({ ...prev, houseUrl: '' }));
                break;
              case 'utility':
                formState.setUtilityBill(uploadedUrl);
                setErrors(prev => ({ ...prev, utilityBill: '' }));
                break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showToast('Failed to capture image', 'error');
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
  
  // Date picker functions are now provided by useKYCDatePicker hook
  
  const getStepTitle = () => {
    switch (navigation.currentStep) {
      case 'personal': return 'Personal Information';
      case 'bvn_verification': return 'BVN Verification';
      case 'id_face_match': return 'ID & Face Verification';
      case 'documents_verification': return 'Document Verification';
      case 'address_details': return 'Address Details';
      case 'review': return 'Review & Submit';
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


  const renderCurrentStep = () => {
    switch (navigation.currentStep) {
      case 'personal':
        return (
          <PersonalInfoStep
            firstName={formState.firstName}
            lastName={formState.lastName}
            middleName={formState.middleName}
            dateOfBirth={datePicker.dateOfBirth}
            phoneNumber={formState.phoneNumber}
            address={formState.address}
            addressNo={formState.addressNo}
            errors={errors}
            onFirstNameChange={(text) => {
              formState.setFirstName(text);
              setErrors(prev => ({ ...prev, firstName: '' }));
            }}
            onLastNameChange={(text) => {
              formState.setLastName(text);
              setErrors(prev => ({ ...prev, lastName: '' }));
            }}
            onMiddleNameChange={formState.setMiddleName}
            onDateOfBirthChange={datePicker.setDateOfBirth}
            onPhoneNumberChange={(text) => {
              formState.setPhoneNumber(text);
              setErrors(prev => ({ ...prev, phoneNumber: '' }));
            }}
            onAddressChange={(text) => {
              formState.setAddress(text);
              setErrors(prev => ({ ...prev, address: '' }));
            }}
            onAddressNoChange={(text) => {
              formState.setAddressNo(text);
              setErrors(prev => ({ ...prev, addressNo: '' }));
            }}
            onDatePickerOpen={datePicker.handleDatePickerOpen}
            onLocationSearchOpen={() => setShowLocationSearch(true)}
            lastNameInputRef={formState.lastNameInputRef}
            middleNameInputRef={formState.middleNameInputRef}
            phoneInputRef={formState.phoneInputRef}
            addressInputRef={formState.addressInputRef}
            hasKYCNameData={!!(formData?.first_name && formData?.last_name)}
          />
        );
      case 'bvn_verification':
        return (
          <BVNVerification
            ref={bvnVerificationRef}
            onComplete={() => navigation.goToNextStep('bvn_verification')}
            onError={(msg) => showToast(msg, 'error')}
            initialBvn={formState.bvn}
          />
        );
      case 'id_face_match':
        return (
          <NINVerification
            ref={ninVerificationRef}
            onComplete={() => {
              navigation.goToNextStep('id_face_match');
              const tierStatus = checkTierCompletion();
              if (tierStatus.tier1) {
                setTimeout(() => {
                  setShowTier1CompletionModal(true);
                }, 300);
              }
            }}
            onError={(msg) => showToast(msg, 'error')}
            initialNin={formState.nin}
            initialPhoneNumber={formState.phoneNumber}
            bvnVerified={bvnVerified}
          />
        );
      case 'documents_verification':
        return (
          <DocumentVerification
            ref={documentVerificationRef}
            onComplete={() => {
              navigation.goToNextStep('documents_verification');
            }}
            onError={(msg) => showToast(msg, 'error')}
            initialDocumentType={selectedIdentityType}
            initialFrontImage={formState.documentFrontImage}
            initialBackImage={formState.documentBackImage}
          />
        );
      case 'address_details':
        return (
          <AddressDetailsStep
            addressNo={formState.addressNo}
            address={formState.address}
            lga={formState.lga}
            state={formState.state}
            houseUrl={formState.houseUrl}
            utilityBill={formState.utilityBill}
            errors={errors}
            onAddressNoChange={(text) => {
              formState.setAddressNo(text);
              setErrors(prev => ({ ...prev, addressNo: '' }));
            }}
            onAddressChange={(text) => {
              formState.setAddress(text);
              setErrors(prev => ({ ...prev, address: '' }));
            }}
            onLgaChange={(text) => {
              formState.setLga(text);
              setErrors(prev => ({ ...prev, lga: '' }));
            }}
            onStateChange={(text) => {
              formState.setState(text);
              setErrors(prev => ({ ...prev, state: '' }));
            }}
            onHouseUrlChange={formState.setHouseUrl}
            onUtilityBillChange={formState.setUtilityBill}
            onLocationSearchOpen={() => setShowLocationSearch(true)}
            onPickImage={pickImage}
            onTakePicture={takePicture}
            addressInputRef={formState.addressInputRef}
          />
        );
      case 'review':
        return (
          <ReviewStep
            firstName={formState.firstName}
            lastName={formState.lastName}
            middleName={formState.middleName}
            dateOfBirth={datePicker.dateOfBirth}
            phoneNumber={formState.phoneNumber}
            addressNo={formState.addressNo}
            address={formState.address}
            lga={formState.lga}
            state={formState.state}
            bvn={formState.bvn}
            bvnVerified={bvnVerified}
            selectedIdentityType={selectedIdentityType}
            nin={formState.nin}
            passportNumber={formState.passportNumber}
            documentsVerified={documentsVerified}
            houseUrl={formState.houseUrl}
            utilityBill={formState.utilityBill}
          />
        );
    }
  };

  const renderDatePickerModal = () => {
    const daysInMonth = datePicker.getDaysInMonth(datePicker.currentMonth);
    const firstDayOffset = datePicker.getFirstDayOfMonth(datePicker.currentMonth);

    return (
      <Modal
        visible={datePicker.isDatePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={datePicker.handleDatePickerClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
              <Pressable onPress={datePicker.handleDatePickerClose} style={styles.datePickerCloseButton}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              {!datePicker.showYearPicker ? (
                <>
                  <Pressable onPress={datePicker.handlePrevMonth} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Pressable 
                      onPress={() => datePicker.setShowYearPicker(true)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {datePicker.MONTHS[datePicker.currentMonth.getMonth()]} {datePicker.currentMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={datePicker.handleNextMonth} style={styles.navigationButton}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={datePicker.handlePrevYear} style={styles.navigationButton}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.monthYearContainer}>
                    <Pressable 
                      onPress={() => datePicker.setShowYearPicker(false)}
                      style={styles.monthYearPressable}
                    >
                      <Text style={styles.monthYearText}>
                        {datePicker.currentMonth.getFullYear()}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={datePicker.handleNextYear} style={styles.navigationButton}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </Pressable>
                </>
              )}
            </View>

            {datePicker.showYearPicker ? (
              <ScrollView style={styles.yearPickerContainer} contentContainerStyle={styles.yearPickerContent}>
                <View style={styles.yearPickerGrid}>
                  {datePicker.getAvailableYears().map((year) => {
                    const isSelected = year === datePicker.currentMonth.getFullYear();
                    const isCurrentYear = year === new Date().getFullYear();
                    return (
                      <Pressable
                        key={year}
                        style={[
                          styles.yearItem,
                          isSelected && styles.yearItemSelected,
                        ]}
                        onPress={() => datePicker.handleYearSelect(year)}
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
                    {datePicker.DAYS.map(day => (
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
                      
                      // Build array of all cells (null for empty, number for day)
                      const allCells = [];
                      for (let i = 0; i < firstDayOffset; i++) {
                        allCells.push(null);
                      }
                      for (let day = 1; day <= daysInMonth; day++) {
                        allCells.push(day);
                      }
                      const remainingCells = totalRows * 7 - allCells.length;
                      for (let i = 0; i < remainingCells; i++) {
                        allCells.push(null);
                      }
                      
                      // Split into weeks (rows of 7)
                      for (let row = 0; row < totalRows; row++) {
                        const week = allCells.slice(row * 7, (row + 1) * 7);
                        weeks.push(week);
                      }
                      
                      return weeks.map((week, weekIndex) => (
                        <View key={`week-${weekIndex}`} style={styles.weekRow}>
                          {week.map((day, dayIndex) => {
                            if (day === null) {
                              return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                            }
                            
                            const date = new Date(datePicker.currentMonth.getFullYear(), datePicker.currentMonth.getMonth(), day);
                            const isSelectable = datePicker.isDateSelectable(date);
                            const isSelected = datePicker.selectedDate && 
                              date.getDate() === datePicker.selectedDate.getDate() &&
                              date.getMonth() === datePicker.selectedDate.getMonth() &&
                              date.getFullYear() === datePicker.selectedDate.getFullYear();

                            return (
                              <Pressable
                                key={`day-${weekIndex}-${dayIndex}-${day}`}
                                style={[
                                  styles.dayCell,
                                  isSelected && styles.selectedDay,
                                  !isSelectable && styles.disabledDay,
                                ]}
                                onPress={() => isSelectable && datePicker.handleDateSelect(date)}
                                disabled={!isSelectable}
                              >
                                <Text style={[
                                  styles.dayText,
                                  isSelected && styles.selectedDayText,
                                  !isSelectable && styles.disabledDayText,
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
              </>
            )}

            <View style={styles.datePickerActions}>
              <Pressable 
                style={[styles.datePickerButton, styles.cancelButton]}
                onPress={datePicker.handleDatePickerClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.datePickerButton, styles.confirmButton]}
                onPress={datePicker.handleDateConfirm}
                disabled={!datePicker.selectedDate}
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
  });
  
  if ((formDataLoading || progressLoading || processingExternalLiveness) && !navigation.currentStep) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => {
            // Navigate to tabs and refresh the page
            router.replace('/(tabs)');
          }} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
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
        
        <Pressable onPress={() => {
          // Navigate to tabs and refresh the page
          router.replace('/(tabs)');
        }} style={styles.closeButton}>
          <X size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
      </View>
      
      
      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        {renderCurrentStep()}
      </KeyboardAvoidingWrapper>
      
      {!(navigation.currentStep === 'review' && progress?.overall_completed) && (
        <FloatingButton 
          title={navigation.currentStep === 'review' ? "Submit Verification" : "Continue"}
          onPress={handleNextStep}
          disabled={
            isLoading || 
            formDataLoading ||
            progressLoading ||
            (navigation.currentStep === 'bvn_verification' && bvnVerified) ||
            (navigation.currentStep === 'id_face_match' && documentsVerified)
          }
          loading={isLoading || formDataLoading || progressLoading}
        />
      )}
      
      {renderDatePickerModal()}
      
      <LocationSearchModal
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelectLocation={handleLocationSelect}
        placeholder="Search for your address..."
      />
      
      
      {/* KYCVerificationModal is no longer needed - liveness is auto-triggered on BVN step */}
      
      <Tier1CompletionModal
        isVisible={showTier1CompletionModal}
        onClose={() => setShowTier1CompletionModal(false)}
        onGoToDashboard={handleTier1GoToDashboard}
        onUpgradeToTier2={handleTier1UpgradeToTier2}
      />
      
      <Tier2CompletionModal
        isVisible={showTier2CompletionModal}
        onClose={() => setShowTier2CompletionModal(false)}
        onGoToDashboard={handleTier2GoToDashboard}
        onUpgradeToTier3={handleTier2UpgradeToTier3}
      />
      
      <Tier3CompletionModal
        isVisible={showTier3CompletionModal}
        onClose={() => setShowTier3CompletionModal(false)}
        onGoToDashboard={handleTier3GoToDashboard}
      />
      
      <CameraPermissionModal
        isVisible={liveness.showCameraPermissionModal}
        onClose={liveness.handleCameraPermissionClose}
        onComplete={liveness.handleCameraPermissionComplete}
      />
      
      <LivenessTestEnhanced 
        isVisible={liveness.showLivenessTest}
        onClose={liveness.handleLivenessClose}
        onComplete={handleLivenessCompleteWrapper}
      />
    </SafeAreaView>
  );
}