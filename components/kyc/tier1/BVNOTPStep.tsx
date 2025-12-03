import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import ProgressBar from './ProgressBar';
import { useTier1KYC } from '@/hooks/useTier1KYC';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { safeHavenService } from '@/lib/safehaven-service';
import Button from '@/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';

interface BVNOTPStepProps {
  onComplete: () => void;
  bvn: string;
  identityId?: string;
  otpMessage?: string;
  onSwitchToNIN?: () => void;
}

export default function BVNOTPStep({ onComplete, bvn, identityId: initialIdentityId, otpMessage: initialOtpMessage, onSwitchToNIN }: BVNOTPStepProps) {
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
  const [identityId, setIdentityId] = useState<string | null>(initialIdentityId || null);
  const [otpMessage, setOtpMessage] = useState<string | null>(initialOtpMessage || null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Initialize BVN verification when component mounts if identityId is not provided
  useEffect(() => {
    const initializeBVN = async () => {
      if (identityId) {
        // Already initialized, just focus OTP input
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 300);
        return;
      }

      if (!session?.user?.id || !session?.user?.email) {
        showToast('Authentication required', 'error');
        return;
      }

      if (!bvn || bvn.length !== 11) {
        showToast('BVN is required', 'error');
        return;
      }

      setIsInitializing(true);
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
          
          setIdentityId(newIdentityId);
          setOtpMessage(newOtpMessage);
          showToast(newOtpMessage, 'success');
          
          // Auto-focus OTP input after initialization
          setTimeout(() => {
            otpInputRef.current?.focus();
          }, 300);
        } else {
          setError(result.error || 'Failed to initialize BVN verification');
          showToast(result.error || 'Failed to initialize BVN verification', 'error');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize BVN verification';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeBVN();
  }, [bvn, session?.user?.id, session?.user?.email]); // Run when bvn or session changes

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

    if (!identityId) {
      showToast('BVN verification not initialized. Please wait...', 'error');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Use SafeHaven service to verify BVN and create account with OTP
      const result = await safeHavenService.verifyBVNAndCreateAccount(
        session.user.id,
        bvn,
        phoneNumber,
        session.user.email,
        otp,
        identityId!
      );

      if (!result.success) {
        setError(result.error || 'BVN verification failed');
        showToast(result.error || 'BVN verification failed', 'error');
        return;
      }

      const verificationData = result.data;
      
      if (!verificationData || !verificationData.verified) {
        setError('BVN verification failed. Please check your BVN and try again.');
        showToast('BVN verification failed. Please check your BVN and try again.', 'error');
        return;
      }

      // Extract account information
      const accountNumber = verificationData.account_number;
      const accountName = verificationData.account_name || `${verificationData.first_name} ${verificationData.last_name}`.trim();
      
      // Save phone number to form data
      await saveFormData({ phone_number: phoneNumber });

      // Update progress - mark id_face_verified as true (same as NIN verification)
      await updateProgress({
        current_step: 'review',
        id_face_verified: true
      });

      // Ensure tier is updated in database after BVN verification
      await updateTier();
      await loadProgress();

      // Show success message
      if (accountNumber) {
        showToast(`BVN verified! Account created: ${accountNumber.substring(0, 5)}****`, 'success');
      } else {
        showToast('BVN verified! Account creation in progress', 'success');
      }
      
      // Navigate to success screen
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
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
            <Text style={styles.description}>
              {isInitializing 
                ? 'Initializing BVN verification...' 
                : otpMessage || 'An OTP has been sent to the phone number linked to your BVN. Please enter the 6-digit code and your phone number for account creation.'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Enter OTP</Text>
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
                <Text style={styles.completedText}>✓ BVN verified successfully</Text>
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
                title={isInitializing ? 'Sending OTP...' : 'Verify BVN'}
                onPress={handleVerify}
                disabled={isVerifying || isInitializing || !identityId || !otp || otp.length !== 6 || !phoneNumber || phoneNumber.length < 10}
                isLoading={isVerifying || isInitializing}
                style={styles.mainButton}
                variant="primary"
                textColor="#fff"
                textStyle={styles.buttonText}
              />
              
              {onSwitchToNIN && (
                <Pressable
                  onPress={onSwitchToNIN}
                  disabled={isVerifying || isInitializing}
                  style={styles.switchToNINLink}
                >
                </Pressable>
              )}
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
      marginBottom: 12, // Space between main button and link
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
    switchToNINLink: {
      paddingVertical: 3,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    switchToNINText: {
      fontSize: 14,
      fontWeight: '500',
      textDecorationLine: 'underline',
    },
  });
}

