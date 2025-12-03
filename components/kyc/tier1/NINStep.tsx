import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { User } from 'lucide-react-native';
import ProgressBar from './ProgressBar';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { initializeNINVerification, verifyNIN, validateNIN } from '@/utils/kyc-verification';
import FloatingButton from '@/components/FloatingButton';

interface NINStepProps {
  onComplete: () => void;
}

export default function NINStep({ onComplete }: NINStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier1KYC();
  
  const [nin, setNin] = useState(formData?.nin || '');
  const [phoneNumber, setPhoneNumber] = useState(formData?.phone_number || '');
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const handleInitialize = async () => {
    // Validate NIN
    const validation = validateNIN(nin);
    if (!validation.isValid) {
      setError(validation.error);
      showToast(validation.error || 'Invalid NIN', 'error');
      return;
    }

    if (!session?.user?.id || !session?.user?.email) {
      showToast('Authentication required', 'error');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const result = await initializeNINVerification(
        nin,
        session.user.id,
        session.user.email
      );

      if (result.success && result.identityId) {
        setIdentityId(result.identityId);
        setOtpMessage(result.otpMessage || null);
        showToast(result.otpMessage || 'OTP sent to phone number linked to your NIN', 'success');
        
        // Save NIN to form data
        await saveFormData({ nin: nin });
        
        // Auto-focus OTP input
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 300);
      } else {
        setError(result.error || 'Failed to initialize NIN verification');
        showToast(result.error || 'Failed to initialize NIN verification', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize NIN verification';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleVerify = async () => {
    if (!identityId) {
      // If not initialized, initialize first
      await handleInitialize();
      return;
    }

    // Validate OTP and phone number
    if (!otp || otp.length !== 6) {
      setError('Valid 6-digit OTP is required');
      showToast('Please enter a valid 6-digit OTP', 'error');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Phone number is required');
      showToast('Please enter your phone number', 'error');
      return;
    }

    if (!session?.user?.id || !session?.user?.email) {
      showToast('Authentication required', 'error');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyNIN(
        nin,
        phoneNumber,
        otp,
        identityId,
        session.user.id,
        session.user.email,
        async (updates) => {
          return await updateProgress(updates);
        }
      );

      if (result.success) {
        // Save phone number to form data
        await saveFormData({ phone_number: phoneNumber });
        
        if (result.accountNumber) {
          showToast(`NIN verified! Account created: ${result.accountNumber.substring(0, 5)}****`, 'success');
        } else {
          showToast('NIN verified! Account creation in progress', 'success');
        }
        
        // Navigate to success screen
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(result.error || 'NIN verification failed');
        showToast(result.error || 'NIN verification failed', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'NIN verification failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNumericInput = (text: string, maxLength: number, setter: (value: string) => void) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= maxLength) {
      setter(numericText);
      setError(null);
    }
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();
  const isVerified = progress?.id_face_verified || false;
  const showOTPFields = identityId !== null;

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={3} />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <User size={48} color={colors.primary} />
        </View>
        
        <Text style={styles.title}>NIN Verification</Text>
        <Text style={styles.description}>
          Verify your National Identification Number (NIN) to complete your Tier 1 verification. An OTP will be sent to the phone number linked to your NIN.
        </Text>

        {!showOTPFields && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>National Identification Number (NIN)</Text>
            <View style={[styles.inputContainer, error && styles.inputError]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your 11-digit NIN"
                placeholderTextColor={colors.textTertiary}
                value={nin}
                onChangeText={(text) => handleNumericInput(text, 11, setNin)}
                keyboardType="numeric"
                maxLength={11}
                editable={!isInitializing && !isVerified}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        )}

        {showOTPFields && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Enter OTP</Text>
              {otpMessage && (
                <Text style={styles.helperText}>{otpMessage}</Text>
              )}
              <View style={[styles.inputContainer, error && styles.inputError]}>
                <TextInput
                  ref={otpInputRef}
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={colors.textTertiary}
                  value={otp}
                  onChangeText={(text) => handleNumericInput(text, 6, setOtp)}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!isVerifying && !isVerified}
                  autoFocus={true}
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.helperText}>
                Enter your phone number for account creation
              </Text>
              <View style={[styles.inputContainer, error && styles.inputError]}>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.input}
                  placeholder="Enter your phone number"
                  placeholderTextColor={colors.textTertiary}
                  value={phoneNumber}
                  onChangeText={(text) => handleNumericInput(text, 11, setPhoneNumber)}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!isVerifying && !isVerified}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          </>
        )}

        {isVerified && (
          <View style={styles.completedContainer}>
            <Text style={styles.completedText}>✓ NIN verified successfully</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your NIN is used for verification purposes only. This helps us confirm your identity and create your account.
          </Text>
        </View>
      </View>

      {!isVerified && (
        <FloatingButton
          title={showOTPFields ? "Verify NIN" : "Continue"}
          onPress={handleVerify}
          disabled={isInitializing || isVerifying || (showOTPFields ? (!otp || otp.length !== 6 || !phoneNumber || phoneNumber.length < 10) : (!nin || nin.length !== 11))}
          loading={isInitializing || isVerifying}
        />
      )}
    </View>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 24,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      alignSelf: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      lineHeight: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      height: 60,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    completedContainer: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#F0FDF4',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success,
      marginBottom: 20,
    },
    completedText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.success,
    },
    infoContainer: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      padding: 16,
      borderRadius: 12,
      marginTop: 'auto',
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}

