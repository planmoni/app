import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import ProgressBar from './ProgressBar';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { verifyNIN } from '@/utils/kyc-verification';
import { safeHavenService } from '@/lib/safehaven-service';
import Button from '@/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
import { BlurView } from 'expo-blur';

interface OTPStepProps {
  onComplete: () => void;
  nin: string;
  identityId: string;
  otpMessage?: string;
  onSwitchToBVN?: () => void;
}

export default function OTPStep({ onComplete, nin, identityId, otpMessage, onSwitchToBVN }: OTPStepProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData, saveFormData } = useKYCData();
  const { progress, updateProgress, updateTier, loadProgress } = useKYCProgress();
  const { getProgressPercentage, getCurrentStepNumber } = useTier1KYC();
  const insets = useSafeAreaInsets();
  
  // Keyboard offset for floating button
  const { bottomOffset } = useFabKeyboardOffset({
    gap: Platform.OS === 'android' ? -180 : -20,
    tabBarHeight: 0,
  });
  
  const [phoneNumber, setPhoneNumber] = useState(formData?.phone_number || '');
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingToBVN, setIsSendingToBVN] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Auto-focus OTP input when component mounts
  useEffect(() => {
    setTimeout(() => {
      otpInputRef.current?.focus();
    }, 300);
  }, []);

  const handleVerify = async () => {
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
        
        // Ensure tier is updated in database after NIN verification
        await updateTier();
        await loadProgress();
        
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

  const handleSendToBVN = async () => {
    if (!session?.user?.id || !session?.user?.email) {
      showToast('Authentication required', 'error');
      return;
    }

    const bvn = formData?.bvn;
    if (!bvn || bvn.length !== 11) {
      showToast('BVN not found. Please complete BVN verification first.', 'error');
      return;
    }

    setIsSendingToBVN(true);
    setError(null);

    try {
      const result = await safeHavenService.initializeBVNVerification(
        session.user.id,
        bvn,
        session.user.email
      );

      if (result.success && result.data?.identityId) {
        const newIdentityId = result.data.identityId;
        const newOtpMessage = result.data?.otpMessage || 'OTP sent to phone number linked to your BVN';
        
        showToast(newOtpMessage, 'success');
        
        // Navigate to BVN OTP step
        if (onSwitchToBVN) {
          onSwitchToBVN();
        }
      } else {
        setError(result.error || 'Failed to send OTP to BVN number');
        showToast(result.error || 'Failed to send OTP to BVN number', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP to BVN number';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSendingToBVN(false);
    }
  };

  const styles = createStyles(colors, isDark);
  const percentage = getProgressPercentage();
  const stepNumber = getCurrentStepNumber();
  const isVerified = progress?.id_face_verified || false;

  return (
    <View style={styles.container}>
      <ProgressBar percentage={percentage} currentStep={stepNumber} totalSteps={4} />
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={false}
        >
          <View style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Enter OTP</Text>
              <Text style={styles.description}>
              {otpMessage ? `${otpMessage} Or Send OTP to your BVN Number` : 'An OTP has been sent to the phone number linked to your NIN. Or Send OTP to your BVN Number. Please enter the 6-digit code and your phone number for account creation.'}
            </Text>
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
                  placeholder="080XXXXXXXX"
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

            {isVerified && (
              <View style={styles.completedContainer}>
                <Text style={styles.completedText}>✓ NIN verified successfully</Text>
              </View>
            )}

            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                Your phone number will be used to create your SafeHaven microfinance account.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!isVerified && (
        <View 
          style={[
            styles.floatingButtonContainer,
            { 
              bottom: Platform.OS === 'android' 
                ? insets.bottom 
                : bottomOffset 
            }
          ]}
          pointerEvents="box-none"
        >
          {/* Blurred underlay */}
          <BlurView
            intensity={Platform.OS === 'android' ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurUnderlay}
            pointerEvents="none"
          />
          
          {/* Main blur background */}
          <BlurView
            intensity={Platform.OS === 'android' ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurBackground}
            pointerEvents="none"
          />
          
          {/* Content overlay */}
          <View style={[
            styles.buttonContentOverlay,
            Platform.OS === 'android' && styles.androidButtonContentOverlay
          ]}>
            <View style={styles.buttonWrapper}>
              <Button
                title="Verify NIN"
                onPress={handleVerify}
                disabled={isVerifying || isSendingToBVN || !otp || otp.length !== 6 || !phoneNumber || phoneNumber.length < 10}
                isLoading={isVerifying}
                style={styles.mainButton}
                variant="primary"
                textColor="#fff"
                textStyle={styles.buttonText}
              />
              
              <Pressable
                onPress={handleSendToBVN}
                disabled={isVerifying || isSendingToBVN}
                style={styles.sendToBVNLink}
              >
                <Text style={[styles.sendToBVNText, { color: colors.primary }]}>
                  {isSendingToBVN ? 'Sending...' : 'Send to BVN Instead'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 250, // Extra padding to ensure content is scrollable above FloatingButton
    },
    content: {
      padding: 24,
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
      marginTop: 20,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    floatingButtonContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    blurUnderlay: {
      position: 'absolute',
      top: -1,
      left: 0,
      right: 0,
      bottom: 0,
      height: 200,
    },
    blurBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    buttonContentOverlay: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    androidButtonContentOverlay: {
      borderTopWidth: 0,
      backgroundColor: 'transparent',
      paddingTop: 4,
      paddingBottom: 4,
    },
    buttonWrapper: {
      width: '100%',
    },
    mainButton: {
      width: '100%',
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
    sendToBVNLink: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    sendToBVNText: {
      fontSize: 14,
      fontWeight: '500',
      textDecorationLine: 'underline',
    },
  });
}

