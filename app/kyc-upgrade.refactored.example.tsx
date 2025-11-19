/**
 * REFACTORED KYC UPGRADE SCREEN - EXAMPLE
 * 
 * This is an example of how the refactored kyc-upgrade.tsx should look.
 * It uses all the new hooks and self-contained verification components.
 * 
 * The main file is now a coordinator that:
 * - Manages step navigation
 * - Renders the appropriate step component
 * - Handles modals and UI state
 * - Coordinates between components
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import LocationSearchModal from '@/components/LocationSearchModal';
import Tier1CompletionModal from '@/components/Tier1CompletionModal';
import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import CameraPermissionModal from '@/components/CameraPermissionModal';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCFormState } from '@/hooks/useKYCFormState';
import { useKYCNavigation } from '@/hooks/useKYCNavigation';
import { useKYCLiveness } from '@/hooks/useKYCLiveness';
import { useKYCDatePicker } from '@/hooks/useKYCDatePicker';
import { useKYCData } from '@/hooks/useKYCData';

// Import self-contained verification components
import BVNVerification, { BVNVerificationHandle } from '@/components/KYCSteps/BVNVerification';
import NINVerification, { NINVerificationHandle } from '@/components/KYCSteps/NINVerification';
import DocumentVerification, { DocumentVerificationHandle } from '@/components/KYCSteps/DocumentVerification';

// Import UI step components (these are just for display)
import PersonalInfoStep from '@/components/KYCSteps/PersonalInfoStep';
import AddressDetailsStep from '@/components/KYCSteps/AddressDetailsStep';
import ReviewStep from '@/components/KYCSteps/ReviewStep';

export default function KYCUpgradeScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { progress, loading: progressLoading, updateProgress } = useKYCProgress();
  const { formData, loading: formDataLoading, saveFormData } = useKYCData();
  const isSmallScreen = width < 380 || height < 700;

  // Use custom hooks
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
  const [selectedIdentityType, setSelectedIdentityType] = useState<'nin' | 'passport'>('nin');

  // Handle step completion
  const handleNextStep = async () => {
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
            // Check if initialized
            if (!ninVerificationRef.current.isValid()) {
              // Initialize first
              const initialized = await ninVerificationRef.current.initialize();
              if (!initialized) return;
            }
            // Then verify
            const success = await ninVerificationRef.current.verify();
            if (success) {
              await navigation.goToNextStep('id_face_match');
            }
          }
          break;

        case 'personal':
          // Validate and save personal info
          if (validatePersonalInfo()) {
            await saveFormData({
              first_name: formState.firstName,
              last_name: formState.lastName,
              middle_name: formState.middleName,
              date_of_birth: datePicker.dateOfBirth,
              phone_number: formState.phoneNumber,
              address: formState.address,
              address_no: formState.addressNo,
              address_lat: formState.addressLat,
              address_lon: formState.addressLon,
              address_place_id: formState.addressPlaceId,
            });
            
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
            }
          }
          break;

        case 'address_details':
          // Validate and save address details
          if (validateAddressDetails()) {
            await saveFormData({
              address_no: formState.addressNo,
              lga: formState.lga,
              state: formState.state,
              house_url: formState.houseUrl || undefined,
              utility_bill_url: formState.utilityBill || undefined,
            });
            
            await updateProgress({
              current_step: 'review',
              address_completed: true
            });
            
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

  const validatePersonalInfo = () => {
    // Validation logic
    const newErrors: Record<string, string> = {};
    if (!formState.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formState.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!datePicker.dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formState.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formState.address.trim()) newErrors.address = 'Address is required';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showToast(firstError, 'error');
      return false;
    }
    return true;
  };

  const validateAddressDetails = () => {
    // Validation logic
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

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await updateProgress({ overall_completed: true });
      showToast('Verification completed successfully!', 'success');
      router.replace('/(tabs)');
    } catch (error) {
      showToast('Failed to complete verification. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCurrentStep = () => {
    switch (navigation.currentStep) {
      case 'bvn_verification':
        return (
          <BVNVerification
            ref={bvnVerificationRef}
            initialBvn={formState.bvn}
            onComplete={() => {
              navigation.goToNextStep('bvn_verification');
            }}
            onError={(error) => {
              showToast(error, 'error');
            }}
          />
        );

      case 'id_face_match':
        return (
          <NINVerification
            ref={ninVerificationRef}
            initialNin={formState.nin}
            initialPhoneNumber={formState.phoneNumber}
            bvnVerified={progress?.bvn_verified || false}
            onComplete={() => {
              navigation.goToNextStep('id_face_match');
            }}
            onError={(error) => {
              showToast(error, 'error');
            }}
          />
        );

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
            onDateOfBirthChange={datePicker.handleDateChange}
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
          />
        );

      case 'documents_verification':
        return (
          <DocumentVerification
            ref={documentVerificationRef}
            initialDocumentType={selectedIdentityType}
            initialFrontImage={formState.documentFrontImage}
            initialBackImage={formState.documentBackImage}
            onComplete={() => {
              navigation.goToNextStep('documents_verification');
            }}
            onError={(error) => {
              showToast(error, 'error');
            }}
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
            onPickImage={async (setImageFunction, type) => {
              // Image picker logic
            }}
            onTakePicture={async (type) => {
              // Camera logic
            }}
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
            bvnVerified={progress?.bvn_verified || false}
            selectedIdentityType={selectedIdentityType}
            nin={formState.nin}
            passportNumber={formState.passportNumber}
            documentsVerified={progress?.documents_verified || false}
            houseUrl={formState.houseUrl}
            utilityBill={formState.utilityBill}
          />
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (navigation.currentStep) {
      case 'personal': return 'Personal Information';
      case 'bvn_verification': return 'BVN Verification';
      case 'id_face_match': return 'NIN Verification';
      case 'documents_verification': return 'Document Verification';
      case 'address_details': return 'Address Details';
      case 'review': return 'Review & Submit';
      default: return 'Account Verification';
    }
  };

  if ((formDataLoading || progressLoading) && !navigation.currentStep) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.closeButton}>
            <X size={24} color={colors.text} />
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Account Verification</Text>
        </View>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.closeButton}>
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
          disabled={isLoading || formDataLoading || progressLoading}
          loading={isLoading || formDataLoading || progressLoading}
        />
      )}
      
      {/* Modals */}
      <LocationSearchModal
        visible={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelectLocation={(location) => {
          // Handle location selection
          setShowLocationSearch(false);
        }}
        placeholder="Search for your address..."
      />
      
      <Tier1CompletionModal
        isVisible={showTier1CompletionModal}
        onClose={() => setShowTier1CompletionModal(false)}
        onGoToDashboard={() => router.push('/(tabs)')}
        onUpgradeToTier2={() => {
          setShowTier1CompletionModal(false);
          navigation.goToStep('personal');
        }}
      />
      
      <CameraPermissionModal
        isVisible={liveness.showCameraPermissionModal}
        onClose={liveness.handleCameraPermissionClose}
        onComplete={liveness.handleCameraPermissionComplete}
      />
      
      <LivenessTestEnhanced 
        isVisible={liveness.showLivenessTest}
        onClose={liveness.handleLivenessClose}
        onComplete={async (selfieUrl) => {
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
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Styles would go here - same as before
});

