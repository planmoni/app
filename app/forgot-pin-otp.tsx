import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import FloatingButton from '@/components/FloatingButton';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPinOTPScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const email = params.email as string;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const styles = createStyles(colors, isDark);

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
      setTimer(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    
    setIsResending(true);
    
    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      // Resend OTP via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email: email,
          purpose: 'pin_recovery'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to resend verification code');
      }

      showToast('Verification code resent', 'success');
      setTimer(60);
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend verification code';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      
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
      // Verify OTP via Supabase function
      const { data, error: verifyError } = await supabase.rpc('verify_otp', {
        p_email: email.trim().toLowerCase(),
        p_otp: otpValue
      });
      
      if (verifyError) {
        throw new Error(verifyError.message || 'Failed to verify code');
      }
      
      if (!data) {
        throw new Error('Invalid or expired verification code');
      }
      
      showToast('Email verified successfully', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
      
      // Navigate to new PIN setup screen
      router.push({
        pathname: '/forgot-pin-new',
        params: {
          email: email,
          verified: 'true'
        }
      });
      
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

  const handleBackPress = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify Email</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={48} color={colors.primary} />
        </View>

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.description}>
          We've sent a 6-digit verification code to {email}. Enter the code below to continue with your PIN reset.
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
              ref={(el) => setInputRef(el, index)}
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
                error && styles.otpInputError
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text.slice(-1), index)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        <Pressable
          style={[styles.resendButton, timer > 0 && styles.resendButtonDisabled]}
          onPress={handleResendOtp}
          disabled={timer > 0 || isResending}
        >
          <Text style={[styles.resendText, timer > 0 && styles.resendTextDisabled]}>
            {timer > 0 ? `Resend code in ${timer}s` : isResending ? 'Resending...' : 'Resend code'}
          </Text>
        </Pressable>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title={isLoading ? "Verifying..." : "Verify Code"}
        onPress={handleVerify}
        disabled={!isButtonEnabled || isLoading}
        loading={isLoading}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  otpInputError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  resendButton: {
    alignItems: 'center',
    padding: 16,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: colors.textSecondary,
  },
}); 