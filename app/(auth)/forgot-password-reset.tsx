import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import FloatingButton from '@/components/FloatingButton';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import SafeFooter from '@/components/SafeFooter';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordResetScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const email = (params.email as string) || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timer, setTimer] = useState(60);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const styles = createStyles(colors);

  const setInputRef = useCallback((el: TextInput | null, index: number) => {
    inputRefs.current[index] = el;
  }, []);

  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/forgot-password');
    }
  }, [email]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError(null);
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validateForm = () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      return 'Please enter the complete verification code';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return 'Password must contain uppercase, lowercase, and a number';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleResendOtp = async () => {
    if (timer > 0 || !email) return;

    setIsResending(true);
    try {
      if (Platform.OS !== 'web') haptics.mediumImpact();

      const { data, error: resendError } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email,
          purpose: 'password_recovery',
        },
      });

      if (resendError) {
        throw new Error(resendError.message || 'Failed to resend verification code');
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      showToast('Verification code resent', 'success');
      setTimer(60);
      if (Platform.OS !== 'web') haptics.success();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification code';
      setError(message);
      showToast(message, 'error');
      if (Platform.OS !== 'web') haptics.error();
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPassword = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      showToast(validationError, 'error');
      if (Platform.OS !== 'web') haptics.error();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS !== 'web') haptics.mediumImpact();

      const { data, error: resetError } = await supabase.functions.invoke('reset-password-with-otp', {
        body: {
          email,
          otp: otp.join(''),
          newPassword: password,
        },
      });

      if (resetError) {
        throw new Error(resetError.message || 'Failed to reset password');
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      showToast('Password reset successfully', 'success');
      if (Platform.OS !== 'web') haptics.success();
      router.replace({
        pathname: '/(auth)/login/password',
        params: { email },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      showToast(message, 'error');
      if (Platform.OS !== 'web') haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Mail size={40} color={colors.primary} />
        </View>

        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
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
              style={[styles.otpInput, digit && styles.otpInputFilled, error && styles.otpInputError]}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputContainer}>
            <Lock size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              editable={!isLoading}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.inputContainer}>
            <Lock size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              editable={!isLoading}
            />
            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              {showConfirmPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title={isLoading ? 'Resetting...' : 'Reset Password'}
        onPress={handleResetPassword}
        disabled={isLoading}
        loading={isLoading}
        hapticType="success"
      />

      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      paddingBottom: 24,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    emailText: {
      fontWeight: '600',
      color: colors.text,
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
      textAlign: 'center',
    },
    otpContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 16,
    },
    otpInput: {
      width: 44,
      height: 52,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
    },
    otpInputFilled: {
      borderColor: colors.primary,
    },
    otpInputError: {
      borderColor: colors.error,
    },
    resendButton: {
      alignItems: 'center',
      paddingVertical: 8,
      marginBottom: 28,
    },
    resendButtonDisabled: {
      opacity: 0.6,
    },
    resendText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    resendTextDisabled: {
      color: colors.textSecondary,
    },
    inputGroup: {
      marginBottom: 16,
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      height: 56,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      height: '100%',
    },
  });
