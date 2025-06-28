import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { verifyOtp } from '@/lib/email-service';

export default function OTPScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
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
    // Send OTP when component mounts
    sendOTP();
  }, []);

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

  const sendOTP = async () => {
    try {
      setIsResending(true);
      setError(null);
      
      // Call the Supabase function to send OTP
      const { data, error: otpError } = await supabase.rpc('send_otp_email', {
        p_email: email.trim().toLowerCase()
      });
      
      if (otpError) {
        throw new Error(otpError.message || 'Failed to send verification code');
      }
      
      if (!data) {
        throw new Error('Failed to send verification code');
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
      // Verify the OTP
      const isValid = await verifyOtp(email.trim().toLowerCase(), otpValue);
      
      if (!isValid) {
        throw new Error('Invalid or expired verification code');
      }
      
      // Check if user already exists in the database
      const { data: existingUser, error: userError } = await supabase.auth
        .signInWithPassword({
          email: email.trim().toLowerCase(),
          password: 'dummy-password-for-check'
        });
      
      // If user exists (no error about invalid credentials), redirect to login
      if (existingUser && existingUser.user) {
        showToast('This email is already registered. Please sign in.', 'info');
        
        if (Platform.OS !== 'web') {
          haptics.notification();
        }
        
        router.replace('/login');
        return;
      }
      
      // Store the verified email in the database for later retrieval
      try {
        const { error: storageError } = await supabase
          .from('email_verification_cache')
          .upsert([
            { 
              email: email.trim().toLowerCase(),
              first_name: firstName,
              last_name: lastName,
              verified: true,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
            }
          ]);
          
        if (storageError) {
          console.error('Error storing verification data:', storageError);
          // Continue anyway as this is not critical
        }
      } catch (storageError) {
        console.error('Error storing verification data:', storageError);
        // Continue anyway as this is not critical
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
      </View>

      <OnboardingProgress currentStep={4} totalSteps={7} />

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
            
            <View style={styles.resendContainer}>
              {timer > 0 ? (
                <Text style={styles.timerText}>
                  Resend code in {timer} seconds
                </Text>
              ) : (
                <Pressable 
                  onPress={handleResendOtp}
                  disabled={isResending}
                >
                  <Text style={styles.resendText}>
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

const createStyles = (colors: any) => StyleSheet.create({
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
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
});