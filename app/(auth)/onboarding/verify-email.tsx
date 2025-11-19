import { View, Text, StyleSheet, Pressable, TextInput, Alert , Platform, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

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
          inputRefs.current[nextIndex]?.focus();
        }, 0);
        
        return;
      }
    }
    
    // Handle single character input - take only the first character
    const digit = text.replace(/[^0-9]/g, '').charAt(0);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);
    
    // Auto-focus next input
    if (digit !== '' && index < 5) {
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

  const sendOTP = async () => {
    try {
      setIsResending(true);
      setError(null);
      
      // Call the Edge Function to send OTP
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error from Edge Function:', data);
        throw new Error(data.error || 'Failed to send verification code');
      }
      
      // Reset timer
      setTimer(60);
      
      // Show success toast
      showToast('Verification code sent to your email', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send OTP');
      showToast('Failed to send verification code', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = async () => {
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
      // Call the Edge Function to verify OTP
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          otp: otpValue
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error from Edge Function:', data);
        throw new Error(data.error || 'Failed to verify OTP');
      }
      
      if (!data.success) {
        throw new Error('Invalid or expired verification code');
      }
      
      // Show success toast
      showToast('Email verified successfully', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
      
      // Navigate to the next screen with emailVerified flag
      router.push({
        pathname: '/onboarding/create-password',
        params: { 
          firstName,
          lastName,
          email,
          emailVerified: 'true'
        }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to verify OTP');
      showToast('Failed to verify code', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (timer > 0) return;
    sendOTP();
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

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
      </View>

      <OnboardingProgress currentStep={4} totalSteps={6} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We've sent a verification code to {email}
          </Text>

          <View style={styles.formContainer}>
            <Text style={styles.question}>Enter the verification code</Text>
            
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
                  disabled={isResending}
                  style={styles.resendButton}
                >
                  <Text style={[styles.resendText, isResending && styles.resendTextDisabled]}>
                    {isResending ? 'Sending...' : 'Resend verification code'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isLoading ? "Verifying..." : "Continue"}
        onPress={handleContinue}
        disabled={!isButtonEnabled || isLoading}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
    textAlign: 'left',
  },
  formContainer: {
    width: '100%',
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'left',
  },
  errorContainer: {
    backgroundColor: colors.errorBackground || '#FEE2E2',
    borderRadius: 8,
    padding: 12,
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
    marginTop: 16,
    marginBottom: 16,
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
});