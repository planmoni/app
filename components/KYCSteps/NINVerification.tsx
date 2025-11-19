import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { Info, Shield, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useKYCStyles } from './sharedStyles';
import { supabase } from '@/lib/supabase';
import { safeHavenService } from '@/lib/safehaven-service';
import SafeHavenOTPModal from '@/components/SafeHavenOTPModal';

export interface NINVerificationHandle {
  initialize: () => Promise<boolean>;
  verify: () => Promise<boolean>;
  isValid: () => boolean;
}

interface NINVerificationProps {
  onComplete?: () => void;
  onError?: (error: string) => void;
  initialNin?: string;
  initialPhoneNumber?: string;
  bvnVerified?: boolean;
}

const normalizeBoolean = (value: any): boolean => {
  return value === true || value === 1 || value === 'true';
};

const NINVerification = forwardRef<NINVerificationHandle, NINVerificationProps>(
  ({ onComplete, onError, initialNin = '', initialPhoneNumber = '', bvnVerified = false }, ref) => {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const { session } = useAuth();
    const { formData, saveFormData } = useKYCData();
    const { progress, updateProgress, updateTier, checkTierCompletion } = useKYCProgress();
    const styles = useKYCStyles();
    
    const [nin, setNin] = useState(initialNin);
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
    const [ninIdentityId, setNinIdentityId] = useState<string | null>(null);
    const [otpMessage, setOtpMessage] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [isBvnVerified, setIsBvnVerified] = useState(normalizeBoolean(bvnVerified));
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [pendingOtp, setPendingOtp] = useState('');
    const phoneInputRef = useRef<TextInput>(null);

    // Load data from form data and progress updates
    useEffect(() => {
      if (formData?.nin) {
        setNin(formData.nin);
      }
      if (formData?.phone_number) {
        setPhoneNumber(formData.phone_number);
      }
      if (progress?.id_face_verified) {
        setVerified(true);
      }
      const progressBvn = normalizeBoolean(progress?.bvn_verified);
      setIsBvnVerified(normalizeBoolean(bvnVerified) || progressBvn);
    }, [formData, progress, bvnVerified]);

    const handleNinChange = (text: string) => {
      const numericText = text.replace(/[^0-9]/g, '');
      if (numericText.length <= 11) {
        setNin(numericText);
        setErrors(prev => ({ ...prev, nin: '' }));
      }
    };

    const handlePhoneNumberChange = async (text: string) => {
      const numericText = text.replace(/[^0-9]/g, '');
      if (numericText.length <= 11) {
        setPhoneNumber(numericText);
        setErrors(prev => ({ ...prev, phoneNumber: '' }));
        
        // Auto-save phone number when valid length
        if (numericText.length >= 10) {
          try {
            await saveFormData({ phone_number: numericText });
          } catch (err) {
            console.error('[NINVerification] Error saving phone number:', err);
          }
        }
      }
    };

    const validateNIN = (): boolean => {
      const newErrors: Record<string, string> = {};

      if (!nin.trim()) {
        newErrors.nin = 'NIN is required';
      } else if (nin.length !== 11 || !/^\d+$/.test(nin)) {
        newErrors.nin = 'NIN must be 11 digits';
      }

      if (!phoneNumber.trim()) {
        newErrors.phoneNumber = 'Phone number is required for NIN verification';
      } else if (phoneNumber.length < 10 || !/^\d+$/.test(phoneNumber)) {
        newErrors.phoneNumber = 'Phone number must be at least 10 digits';
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        const firstError = Object.values(newErrors)[0];
        showToast(firstError, 'error');
        return false;
      }

      return true;
    };

    const validateOTP = (value: string): boolean => {
      const newErrors: Record<string, string> = {};

      if (!value.trim()) {
        newErrors.otp = 'OTP is required';
      } else if (value.length !== 6 || !/^\d+$/.test(value)) {
        newErrors.otp = 'OTP must be 6 digits';
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        const firstError = Object.values(newErrors)[0];
        showToast(firstError, 'error');
        return false;
      }

      return true;
    };

    const initializeNINVerification = async (): Promise<boolean> => {
      if (!validateNIN()) return false;

      try {
        if (!session?.user?.id) {
          throw new Error('User session not found');
        }

        setIsInitializing(true);
        setErrors({});

        // Use SafeHaven service to initialize NIN verification
        const result = await safeHavenService.verifyNINAndCreateAccount(
          session.user.id,
          nin.trim(),
          phoneNumber.trim(),
          session.user.email || '',
          undefined // otp - not provided for initialization
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to initialize NIN verification');
        }

        const identityId = result.data?.identityId;
        const message = result.data?.otpMessage;

        if (!identityId) {
          throw new Error('Identity ID not found in response');
        }

        setNinIdentityId(identityId);
        setOtpMessage(message || null);

        // Save NIN and phone number
        await saveFormData({
          nin: nin.trim(),
          phone_number: phoneNumber.trim()
        });

        showToast('OTP sent to phone number linked to your NIN', 'success');
        
        // Automatically prompt for OTP entry
        setPendingOtp('');
        setShowOtpModal(true);

        return true;
      } catch (error) {
        console.error('NIN verification initialization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize NIN verification';
        showToast(errorMessage, 'error');
        setErrors({ nin: errorMessage });
        if (onError) {
          onError(errorMessage);
        }
        return false;
      } finally {
        setIsInitializing(false);
      }
    };

    const verifyNIN = async (otpValue?: string): Promise<boolean> => {
      if (!ninIdentityId) {
        // If not initialized, initialize first
        const initialized = await initializeNINVerification();
        if (!initialized) return false;
        // Return false to indicate we need OTP input
        return false;
      }

      const currentOtp = otpValue ?? pendingOtp;
      if (!validateOTP(currentOtp)) return false;
      setPendingOtp(currentOtp);

      try {
        if (!session?.user?.id) {
          throw new Error('User session not found');
        }

        setIsVerifying(true);
        setErrors({});

        // Create audit log
        const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'nin_verification',
          p_verification_type: 'nin',
          p_verification_provider: 'safehaven',
          p_request_data: {
            action: 'verify_nin_with_otp',
            nin: nin.substring(0, 4) + '****',
            has_otp: true,
            timestamp: new Date().toISOString()
          },
          p_response_data: null,
          p_status: 'pending',
          p_result_message: 'NIN verification with OTP initiated',
          p_metadata: {
            component: 'NINVerification',
            action: 'nin_verification_verify',
            step: 'id_face_match',
            provider: 'safehaven'
          }
        });

        // Use SafeHaven service to verify with OTP
        const result = await safeHavenService.verifyNINAndCreateAccount(
          session.user.id,
          nin.trim(),
          phoneNumber.trim(),
          session.user.email || '',
          currentOtp.trim(),
          ninIdentityId
        );

        if (!result.success) {
          throw new Error(result.error || 'Account creation failed');
        }

        const verificationData = result.data;

        if (!verificationData || !verificationData.verified) {
          throw new Error('NIN verification failed. Please check your NIN and try again.');
        }

        const accountNumber = verificationData.account_number;
        const accountName = verificationData.account_name || 
          `${verificationData.first_name} ${verificationData.last_name}`.trim();

        const displayName = accountName;

        // Update audit log with success
        if (auditLogId) {
          await supabase
            .from('kyc_audit_logs')
            .update({
              status: 'success',
              response_data: {
                verified: true,
                nin: nin.substring(0, 4) + '****',
                matched_name: displayName,
                hasAccount: !!accountNumber,
                account_number: accountNumber ? accountNumber.substring(0, 5) + '****' : null
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', auditLogId);

          await supabase
            .from('kyc_audit_events')
            .insert({
              audit_log_id: auditLogId,
              user_id: session.user.id,
              event_type: 'verification_completed',
              event_data: {
                action: 'nin_verification_completed',
                nin: nin.substring(0, 4) + '****',
                matched_name: displayName,
                hasAccount: !!accountNumber,
                account_number: accountNumber ? accountNumber.substring(0, 5) + '****' : null,
                provider: 'safehaven'
              },
              severity: 'high'
            });
        }

        // Show success message
        if (accountNumber) {
          showToast(`NIN verified! Name: ${displayName} • Account created: ${accountNumber.substring(0, 5)}****`, 'success');
        } else {
          showToast(`NIN verified! Name: ${displayName} • Account creation in progress`, 'success');
        }

        setVerified(true);

        // Update progress
        const progressResult = await updateProgress({
          current_step: 'personal',
          id_face_verified: true
        });

        if (progressResult) {
          await updateTier();
          const tierStatus = checkTierCompletion();
          if (tierStatus.tier1) {
            showToast('Tier 1 completed! You can now deposit up to ₦2,000,000 monthly.', 'success');
          }
        }

        if (onComplete) {
          onComplete();
        }

        return true;
      } catch (error) {
        console.error('NIN verification error:', error);
        const errorMessage = error instanceof Error ? error.message : 'NIN verification failed';
        showToast(errorMessage, 'error');
        setErrors({ otp: errorMessage });
        if (onError) {
          onError(errorMessage);
        }
        return false;
      } finally {
        setIsVerifying(false);
      }
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      initialize: initializeNINVerification,
      verify: verifyNIN,
      isValid: () => verified && !isLoading
    }));

    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>NIN Verification</Text>
        <Text style={styles.sectionDescription}>
          Please provide your National Identification Number (NIN) for verification.
        </Text>

        {!isBvnVerified && (
          <View style={styles.warningContainer}>
            <Info size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              You must complete BVN verification before proceeding with NIN verification.
            </Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>National Identification Number (NIN)</Text>
          <View style={[styles.inputContainer, errors.nin && styles.inputError, verified && styles.resolvedInput]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your 11-digit NIN"
              placeholderTextColor={colors.textTertiary}
              value={nin}
              onChangeText={handleNinChange}
              keyboardType="numeric"
              maxLength={11}
              editable={!isLoading && !verified && !ninIdentityId}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {verified && (
              <View style={styles.verifiedBadge}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <Text style={styles.sectionDescription}>
            Enter the phone number linked to your NIN. This is required for NIN verification.
          </Text>
          <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
            <TextInput
              ref={phoneInputRef}
              style={styles.input}
              placeholder="Enter your phone number (e.g., 08012345678)"
              placeholderTextColor={colors.textTertiary}
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              maxLength={11}
              editable={!isLoading && !verified}
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={true}
              returnKeyType="done"
              onSubmitEditing={() => {
                // Dismiss keyboard when Done is pressed
                phoneInputRef.current?.blur();
              }}
            />
          </View>
          {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
        </View>

        {/* {ninIdentityId && !verified && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {otpMessage || 'An OTP has been sent to the phone number linked to your NIN.'}
            </Text>
            <Pressable
              onPress={() => setShowOtpModal(true)}
              style={[styles.button, isVerifying && styles.buttonDisabled]}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Enter OTP</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => initializeNINVerification()}
              disabled={isInitializing}
              style={[
                styles.button,
                { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
                isInitializing && styles.buttonDisabled,
              ]}
            >
              {isInitializing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primary }]}>Resend OTP</Text>
              )}
            </Pressable>
          </View>
        )} */}

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            An OTP will be sent to the phone number linked to your NIN for verification.
          </Text>
        </View>
        <SafeHavenOTPModal
          isVisible={showOtpModal}
          onClose={() => setShowOtpModal(false)}
          phoneNumber={phoneNumber}
          onVerify={async (code) => {
            const success = await verifyNIN(code);
            if (success) {
              setShowOtpModal(false);
            }
          }}
          onResend={
            ninIdentityId && !verified
              ? async () => {
                  await initializeNINVerification();
                }
              : undefined
          }
        />
      </View>
    );
  }
);

NINVerification.displayName = 'NINVerification';

export default NINVerification;

