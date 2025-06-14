import { Modal, View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

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
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (isVisible) {
      // Reset OTP when modal opens
      setOtp(['', '', '', '', '', '']);
      setError(null);
      
      // Focus first input after a short delay
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
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

  const styles = createStyles(colors, isDark);

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
              <Text style={styles.timerText}>
                Resend code in 00:59
              </Text>
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
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
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
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 24,
  },
  referenceText: {
    fontSize: 14,
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
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    fontSize: 20,
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  verifyButton: {
    backgroundColor: colors.primary,
  },
});