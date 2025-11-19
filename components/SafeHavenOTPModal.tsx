import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';

interface SafeHavenOTPModalProps {
  isVisible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  phoneNumber?: string;
  onResend?: () => Promise<void>;
}

export default function SafeHavenOTPModal({
  isVisible,
  onClose,
  onVerify,
  phoneNumber,
  onResend,
}: SafeHavenOTPModalProps) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const verifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const setInputRef = useCallback((el: TextInput | null, index: number) => {
    inputRefs.current[index] = el;
  }, []);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset OTP when modal opens
  useEffect(() => {
    if (isVisible) {
      setOtp(['', '', '', '', '', '']);
      setError(null);
      setTimer(60);
      setIsLoading(false);
      setIsResending(false);
      
      // Clear any existing timeouts
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
      }
      
      // Focus first input after a short delay
      focusTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isVisible) {
          inputRefs.current[0]?.focus();
        }
      }, 300);
    } else {
      // Clean up when modal closes
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Blur all inputs when modal closes
      inputRefs.current.forEach((ref) => ref?.blur());
      // Reset timer
      setTimer(60);
    }

    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isVisible]);

  // OTP Timer - fixed to not recreate interval on every timer change
  useEffect(() => {
    if (!isVisible) {
      // Clear timer interval when modal closes
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current || !isVisible) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        return;
      }
      
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isVisible]); // Only depend on isVisible, not timer

  const handleOtpChange = (text: string, index: number) => {
    if (!isMountedRef.current || !isVisible) return;
    
    // Handle pasting - if text length > 1, it's likely a paste operation
    if (text.length > 1) {
      // Extract only digits from pasted text
      const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
      
      if (digits.length > 0) {
        const newOtp = ['', '', '', '', '', ''];
        
        // Fill OTP fields with pasted digits
        for (let i = 0; i < digits.length && i < 6; i++) {
          newOtp[i] = digits[i];
        }
        
        setOtp(newOtp);
        setError(null);
        
        // Focus the next empty field or the last field if all are filled
        const nextIndex = Math.min(digits.length, 5);
        setTimeout(() => {
          if (isMountedRef.current && isVisible) {
            inputRefs.current[nextIndex]?.focus();
            
            // Auto-verify if all 6 digits are pasted
            if (digits.length === 6 && newOtp.every((digit) => digit !== '')) {
              // Clear any existing verify timeout
              if (verifyTimeoutRef.current) {
                clearTimeout(verifyTimeoutRef.current);
              }
              
              verifyTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current && isVisible) {
                  // Use the pasted OTP value directly
                  const otpValue = newOtp.join('');
                  if (otpValue.length === 6 && /^\d{6}$/.test(otpValue)) {
                    handleVerifyWithOtp(otpValue);
                  }
                }
              }, 300);
            }
          }
        }, 0);
        
        return;
      }
    }

    // Handle single character input
    const digit = text.replace(/[^0-9]/g, '').charAt(0);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (digit !== '' && index < 5 && isMountedRef.current && isVisible) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered (check after state update)
    if (newOtp.every((d) => d !== '')) {
      // Clear any existing verify timeout
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
      }
      
      verifyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isVisible) {
          // Use the newOtp value directly instead of reading from state
          const otpValue = newOtp.join('');
          if (otpValue.length === 6 && /^\d{6}$/.test(otpValue)) {
            handleVerifyWithOtp(otpValue);
          }
        }
      }, 300);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1]?.focus();

      // Update the value to remove the previous digit
      if (index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleVerify = async () => {
    const otpValue = otp.join('');
    await handleVerifyWithOtp(otpValue);
  };

  const handleVerifyWithOtp = async (otpValue: string) => {
    if (!isMountedRef.current || !isVisible) return;

    if (otpValue.length !== 6) {
      if (isMountedRef.current) {
        setError('Please enter the complete 6-digit OTP');
        showToast('Please enter the complete 6-digit OTP', 'error');
      }
      return;
    }

    if (!/^\d{6}$/.test(otpValue)) {
      if (isMountedRef.current) {
        setError('OTP must contain only numbers');
        showToast('OTP must contain only numbers', 'error');
      }
      return;
    }

    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS !== 'web' && isMountedRef.current) {
        haptics.mediumImpact();
      }

      await onVerify(otpValue);

      if (Platform.OS !== 'web' && isMountedRef.current) {
        haptics.success();
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'OTP verification failed';
        setError(errorMessage);
        showToast(errorMessage, 'error');

        if (Platform.OS !== 'web') {
          haptics.error();
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    if (!isMountedRef.current || !isVisible || timer > 0 || !onResend) return;

    setIsResending(true);
    setError(null);

    try {
      if (Platform.OS !== 'web' && isMountedRef.current) {
        haptics.mediumImpact();
      }

      await onResend();

      if (isMountedRef.current) {
        showToast('OTP resent successfully', 'success');
        setTimer(60);

        if (Platform.OS !== 'web') {
          haptics.success();
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to resend OTP';
        setError(errorMessage);
        showToast(errorMessage, 'error');

        if (Platform.OS !== 'web') {
          haptics.error();
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsResending(false);
      }
    }
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={styles.title}>Enter Verification Code</Text>
                <Text style={styles.subtitle}>
                  An OTP has been sent to the phone number linked to your NIN
                  {phoneNumber && (
                    <Text style={styles.phoneText}> ({phoneNumber.substring(0, 3)}***{phoneNumber.substring(phoneNumber.length - 3)})</Text>
                  )}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.content}>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => setInputRef(el, index)}
                    style={[
                      styles.otpInput,
                      digit !== '' && styles.otpInputFilled,
                      error && styles.otpInputError,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isLoading}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <View style={styles.resendContainer}>
                {timer > 0 ? (
                  <View style={styles.timerContainer}>
                    <Clock size={16} color={colors.textSecondary} />
                    <Text style={styles.timerText}>
                      Resend code in {timer} seconds
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleResendOtp}
                    disabled={isResending || !onResend}
                    style={styles.resendButton}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        (isResending || !onResend) && styles.resendTextDisabled,
                      ]}
                    >
                      {isResending ? 'Sending...' : 'Resend verification code'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                style={[
                  styles.verifyButton,
                  isLoading && styles.verifyButtonDisabled,
                ]}
                onPress={handleVerify}
                disabled={isLoading || otp.some((digit) => digit === '')}
              >
                <Text style={styles.verifyButtonText}>
                  {isLoading ? 'Verifying...' : 'Verify OTP'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    keyboardAvoidingView: {
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 20,
      paddingBottom: isSmallScreen ? 20 : 40,
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      fontSize: isSmallScreen ? 20 : 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    phoneText: {
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    errorContainer: {
      backgroundColor: colors.errorBackground || '#FEE2E2',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: 14,
      textAlign: 'center',
    },
    otpContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
      gap: 12,
    },
    otpInput: {
      flex: 1,
      height: isSmallScreen ? 56 : 64,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      textAlign: 'center',
      fontSize: isSmallScreen ? 24 : 28,
      fontWeight: '600',
      color: colors.text,
    },
    otpInputFilled: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBackground || colors.background,
    },
    otpInputError: {
      borderColor: colors.error || '#DC2626',
    },
    resendContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    resendButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    resendText: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: '600',
    },
    resendTextDisabled: {
      color: colors.textTertiary,
    },
    verifyButton: {
      backgroundColor: colors.primary,
      paddingVertical: isSmallScreen ? 14 : 16,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifyButtonDisabled: {
      opacity: 0.5,
    },
    verifyButtonText: {
      color: colors.accent,
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
    },
  });

