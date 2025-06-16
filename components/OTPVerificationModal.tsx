import { Modal, View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OTPVerificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  reference: string;
  isLoading?: boolean;
}

export default function OTPVerificationModal({ 
  isVisible, 
  onClose, 
  onVerify,
  reference,
  isLoading = false
}: OTPVerificationModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(59);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (isVisible) {
      // Reset OTP when modal opens
      setOtp(['', '', '', '', '', '']);
      setError(null);
      setTimer(59);
      
      // Focus first input after a short delay
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
      
      // Start countdown timer
      const interval = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text[text.length - 1];
    }
    
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError(null);
    
    // Auto-focus next input
    if (text !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
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
    
    if (otpValue.length !== 6) {
      setError('Please enter the complete verification code');
      haptics.error();
      return;
    }
    
    try {
      await onVerify(otpValue);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to verify OTP');
      haptics.error();
    }
  };

  const handleResendOtp = () => {
    if (timer === 0) {
      haptics.selection();
      setOtp(['', '', '', '', '', '']);
      setTimer(59);
      inputRefs.current[0]?.focus();
      // In a real app, you would call an API to resend the OTP
    }
  };

  const styles = createStyles(colors, isDark, isSmallScreen, insets);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {
        if (!isLoading) {
          haptics.lightImpact();
          onClose();
        }
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Enter OTP</Text>
              <Pressable 
                style={styles.closeButton} 
                onPress={() => {
                  if (!isLoading) {
                    haptics.lightImpact();
                    onClose();
                  }
                }}
                disabled={isLoading}
              >
                <X size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <View style={styles.content}>
              <Text style={styles.description}>
                Please enter the one-time password sent to your mobile number or email to verify your card.
              </Text>
              
              <Text style={styles.referenceText}>
                Reference: {reference}
              </Text>
              
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => inputRefs.current[index] = el}
                    style={styles.otpInput}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!isLoading}
                  />
                ))}
              </View>
              
              <View style={styles.timerContainer}>
                <Pressable 
                  onPress={handleResendOtp}
                  disabled={timer > 0 || isLoading}
                >
                  <Text style={[
                    styles.timerText,
                    timer === 0 && styles.resendActive
                  ]}>
                    {timer > 0 
                      ? `Resend code in 00:${timer.toString().padStart(2, '0')}`
                      : 'Resend verification code'
                    }
                  </Text>
                </Pressable>
              </View>
            </View>
            
            <View style={styles.footer}>
              <Button
                title="Verify"
                onPress={handleVerify}
                isLoading={isLoading}
                style={styles.verifyButton}
                disabled={otp.join('').length !== 6 || isLoading}
                hapticType="success"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, insets: any) => StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.border : 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: isSmallScreen ? 16 : 20,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: isSmallScreen ? 20 : 24,
  },
  referenceText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: isSmallScreen ? 40 : 50,
    height: isSmallScreen ? 48 : 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.backgroundTertiary,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    padding: isSmallScreen ? 16 : 20,
    paddingBottom: Math.max(isSmallScreen ? 16 : 20, insets.bottom),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  verifyButton: {
    backgroundColor: colors.primary,
  },
});