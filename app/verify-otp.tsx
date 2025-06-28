import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';
import { sendOtpEmail, verifyOtp } from '@/lib/email-service';

export default function VerifyOTPScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { session } = useAuth();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const email = params.email as string || session?.user?.email;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Callback ref for setting inputRefs
  const setInputRef = useCallback((el: TextInput | null, index: number) => {
    inputRefs.current[index] = el;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(otp.every(digit => digit !== ''));
  }, [otp]);

  useEffect(() => {
    if (timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

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

  const handleResendOtp = async () => {
    if (timer > 0) return;
    
    setIsResending(true);
    setError(null);
    
    try {
      // Use the email service to send OTP directly
      await sendOtpEmail(email.trim().toLowerCase());
      
      // Reset timer
      setTimer(60);
      
      showToast('Verification code sent to your email', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
    } catch (err) {
      setError(err instanceof Error ? error.message : 'Failed to send verification code');
      showToast('Failed to send verification code', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setError('Please enter the complete verification code');
      showToast('Please enter the complete verification code', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the email service to verify OTP directly
      const isValid = await verifyOtp(email.trim().toLowerCase(), otpValue);
      
      if (!isValid) {
        throw new Error('Invalid or expired verification code');
      }
      
      // Update profile in database
      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('id', session.user.id);
      }
      
      setIsVerified(true);
      showToast('Email verified successfully', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
      showToast('Failed to verify code', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    router.back();
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify Email</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          {isVerified ? (
            <View style={styles.verifiedContainer}>
              <View style={styles.verifiedIconContainer}>
                <Check size={40} color={colors.success} />
              </View>
              <Text style={styles.title}>Email Verified!</Text>
              <Text style={styles.subtitle}>
                Your email address <Text style={styles.emailText}>{email}</Text> has been successfully verified.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Enter Verification Code</Text>
              <Text style={styles.subtitle}>
                We've sent a verification code to <Text style={styles.emailText}>{email}</Text>
              </Text>

              <View style={styles.formContainer}>
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
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!isLoading && !isVerified}
                    />
                  ))}
                </View>
                
                <View style={styles.resendContainer}>
                  {timer > 0 ? (
                    <Text style={styles.timerText}>
                      Resend code in {timer} seconds
                    </Text>
                  ) : (
                    <Pressable 
                      onPress={handleResendOtp}
                      disabled={isResending || isVerified}
                    >
                      <Text style={[
                        styles.resendText,
                        isVerified && styles.disabledText
                      ]}>
                        {isResending ? 'Sending...' : 'Resend verification code'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isVerified ? "Continue" : isLoading ? "Verifying..." : "Verify"}
        onPress={isVerified ? handleContinue : handleVerify}
        disabled={(!isButtonEnabled && !isVerified) || isLoading}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: colors.text,
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  disabledText: {
    color: colors.textTertiary,
  },
  verifiedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  verifiedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
});