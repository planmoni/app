import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Info, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';
import { IdentityType } from './types';
import NINVerificationStep from './NINVerificationStep';

interface IDFaceMatchStepProps {
  nin: string;
  phoneNumber: string;
  otp: string;
  ninIdentityId: string | null;
  bvnIdentityId: string | null;
  otpMessage: string | null;
  selectedIdentityType: IdentityType;
  errors: Record<string, string>;
  bvnVerified: boolean;
  isVerifyingDocuments: boolean;
  documentsVerified: boolean;
  isLoading: boolean;
  showBvnOption: boolean;
  bvn: string;
  formDataBvn?: string;
  onNinChange: (text: string) => void;
  onPhoneNumberChange: (text: string) => void;
  onOtpChange: (text: string) => void;
  onIdentityTypeChange: (type: IdentityType) => void;
  onUseBvnInstead: () => void;
  onSaveFormData?: (data: { phone_number: string }) => Promise<void>;
  phoneInputRef?: React.RefObject<TextInput | null>;
}

export default function IDFaceMatchStep({
  nin,
  phoneNumber,
  otp,
  ninIdentityId,
  bvnIdentityId,
  otpMessage,
  selectedIdentityType,
  errors,
  bvnVerified,
  isVerifyingDocuments,
  documentsVerified,
  isLoading,
  showBvnOption,
  bvn,
  formDataBvn,
  onNinChange,
  onPhoneNumberChange,
  onOtpChange,
  onIdentityTypeChange,
  onUseBvnInstead,
  onSaveFormData,
  phoneInputRef,
}: IDFaceMatchStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  // If NIN is selected, show NIN verification step
  if (selectedIdentityType === 'nin') {
    return (
      <NINVerificationStep
        nin={nin}
        phoneNumber={phoneNumber}
        otp={otp}
        ninIdentityId={ninIdentityId}
        otpMessage={otpMessage}
        errors={errors}
        bvnVerified={bvnVerified}
        isVerifyingDocuments={isVerifyingDocuments}
        documentsVerified={documentsVerified}
        isLoading={isLoading}
        showBvnOption={showBvnOption}
        onNinChange={onNinChange}
        onPhoneNumberChange={onPhoneNumberChange}
        onOtpChange={onOtpChange}
        onUseBvnInstead={onUseBvnInstead}
        onSaveFormData={onSaveFormData}
        phoneInputRef={phoneInputRef}
      />
    );
  }

  // BVN verification step
  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>BVN Verification</Text>
      <Text style={styles.sectionDescription}>
        Please verify your Bank Verification Number (BVN) to proceed.
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
              selectedIdentityType === 'nin' && styles.selectedIdOption,
              (selectedIdentityType === 'bvn' || bvnIdentityId) && styles.disabledOption
            ]}
            onPress={() => {
              onIdentityTypeChange('nin');
              // Clear errors when switching
              // errors will be cleared by parent component
            }}
            disabled={isVerifyingDocuments || documentsVerified || selectedIdentityType === 'bvn' || !!bvnIdentityId}
          >
            <Text style={[
              styles.idOptionText,
              selectedIdentityType === 'nin' && styles.selectedIdOptionText,
              (selectedIdentityType === 'bvn' || bvnIdentityId) && styles.disabledOptionText
            ]}>NIN</Text>
          </Pressable>
          
          {showBvnOption && (
            <Pressable
              style={[
                styles.idOption,
                selectedIdentityType === 'bvn' && styles.selectedIdOption,
                (selectedIdentityType === 'nin' || ninIdentityId) && styles.disabledOption
              ]}
              onPress={() => {
                onIdentityTypeChange('bvn');
              }}
              disabled={isVerifyingDocuments || documentsVerified || selectedIdentityType === 'nin' || !!ninIdentityId}
            >
              <Text style={[
                styles.idOptionText,
                selectedIdentityType === 'bvn' && styles.selectedIdOptionText,
                (selectedIdentityType === 'nin' || ninIdentityId) && styles.disabledOptionText
              ]}>BVN</Text>
            </Pressable>
          )}
        </View>
      </View>
      
      {selectedIdentityType === 'bvn' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Verification Number (BVN)</Text>
            <View style={[styles.inputContainer, errors.bvn && styles.inputError]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your 11-digit BVN"
                placeholderTextColor={colors.textTertiary}
                value={bvn || formDataBvn || ''}
                editable={false}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>
            {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
          </View>
          
          {bvnIdentityId && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <Text style={styles.sectionDescription}>
                  {otpMessage || 'Enter the phone number linked to your BVN. This is required for BVN verification.'}
                </Text>
                <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.input}
                    placeholder="Enter your phone number"
                    placeholderTextColor={colors.textTertiary}
                    value={phoneNumber}
                    onChangeText={(text) => {
                      // Only allow numbers
                      const numericText = text.replace(/[^0-9]/g, '');
                      if (numericText.length <= 11) {
                        onPhoneNumberChange(numericText);
                        // Save to kyc_data when phone number is entered
                        if (numericText.length >= 10 && onSaveFormData) {
                          onSaveFormData({ phone_number: numericText }).catch(err => {
                            console.error('[KYC] Error saving phone number:', err);
                          });
                        }
                      }
                    }}
                    keyboardType="phone-pad"
                    maxLength={11}
                    editable={!isVerifyingDocuments && !documentsVerified}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.helperText}>
                  Use the same phone number you registered your BVN with. One-Time Passwords can only be sent to that line.
                </Text>
                {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Enter OTP</Text>
                <Text style={styles.sectionDescription}>
                  Enter the 6-digit OTP code sent to your phone number.
                </Text>
                <View style={[styles.inputContainer, errors.otp && styles.inputError]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={colors.textTertiary}
                    value={otp}
                    onChangeText={(text) => {
                      // Only allow numbers and limit to 6 digits
                      const numericText = text.replace(/[^0-9]/g, '');
                      if (numericText.length <= 6) {
                        onOtpChange(numericText);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!isLoading && !documentsVerified}
                    autoFocus={true}
                  />
                </View>
                {errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}
              </View>
            </>
          )}
        </>
      )}
      
      {errors.documentVerification && (
        <View style={styles.warningContainer}>
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
}

