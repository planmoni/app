import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Info, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useKYCStyles } from './sharedStyles';

interface NINVerificationStepProps {
  nin: string;
  phoneNumber: string;
  otp: string;
  ninIdentityId: string | null;
  otpMessage: string | null;
  errors: Record<string, string>;
  bvnVerified: boolean;
  isVerifyingDocuments: boolean;
  documentsVerified: boolean;
  isLoading: boolean;
  showBvnOption: boolean;
  onNinChange: (text: string) => void;
  onPhoneNumberChange: (text: string) => void;
  onOtpChange: (text: string) => void;
  onUseBvnInstead: () => void;
  onSaveFormData?: (data: { phone_number: string }) => Promise<void>;
  phoneInputRef?: React.RefObject<TextInput | null>;
}

export default function NINVerificationStep({
  nin,
  phoneNumber,
  otp,
  ninIdentityId,
  otpMessage,
  errors,
  bvnVerified,
  isVerifyingDocuments,
  documentsVerified,
  isLoading,
  showBvnOption,
  onNinChange,
  onPhoneNumberChange,
  onOtpChange,
  onUseBvnInstead,
  onSaveFormData,
  phoneInputRef,
}: NINVerificationStepProps) {
  const { colors } = useTheme();
  const styles = useKYCStyles();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>NIN Verification</Text>
      <Text style={styles.sectionDescription}>
        Please provide a government-issued ID number.
      </Text>
      
      {!bvnVerified && (
        <View style={styles.warningContainer}>
          <Info size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            You must complete BVN verification before proceeding with ID verification.
          </Text>
        </View>
      )}
      
      {!ninIdentityId && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>National Identification Number (NIN)</Text>
          <View style={[styles.inputContainer, errors.nin && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your 11-digit NIN"
              placeholderTextColor={colors.textTertiary}
              value={nin}
              onChangeText={(text) => {
                // Only allow numbers and limit to 11 digits
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 11) {
                  onNinChange(numericText);
                }
              }}
              keyboardType="numeric"
              maxLength={11}
              editable={!isVerifyingDocuments && !documentsVerified && !ninIdentityId}
            />
          </View>
          {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
        </View>
      )}
      
      {ninIdentityId && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Enter OTP</Text>
            
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
            <Text style={styles.sectionDescription}>
              {otpMessage || 'Enter the phone number linked to your NIN. This is required for NIN verification.'}
            </Text>
            {errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}
            {showBvnOption && (
              <View style={styles.otpNoteContainer}>
                <Text style={styles.helperText}>
                  Didn&apos;t receive the OTP? Confirm you&apos;re using the NIN registration number. If it still doesn&apos;t arrive, let&apos;s use your BVN instead.
                </Text>
                <Pressable onPress={onUseBvnInstead} style={styles.linkButton}>
                  <Text style={styles.linkButtonText}>Use BVN instead</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
              <TextInput
                ref={phoneInputRef}
                style={styles.input}
                placeholder="Enter your phone number (e.g., 08012345678)"
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
            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
            <Text style={styles.helperText}>
              Confirm the phone number linked to your NIN. This is required for account creation.
            </Text>
          </View>
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
          This is the last step required to get a SafeHaven Microfinance Bank account.
        </Text>
      </View>
    </View>
  );
}

