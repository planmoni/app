import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, Link } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(email.trim().length > 0 && /\S+@\S+\.\S+/.test(email));
  }, [email]);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your email address');
      showToast('Please enter your email address', 'error');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      setError('Please enter a valid email address');
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email: normalizedEmail,
          purpose: 'password_recovery',
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send verification code');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      haptics.notification(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/forgot-password-reset',
        params: { email: normalizedEmail },
      });
    } catch (err) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            if (!isLoading) router.back();
          }} 
          style={styles.backButton}
          disabled={isLoading}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a verification code to reset your password.
          </Text>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={[
              styles.inputContainer,
              email.trim() !== '' && styles.inputContainerFilled,
              error && styles.inputContainerError,
            ]}>
              <TextInput
                ref={emailInputRef}
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleResetPassword}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Remember your password? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable onPress={() => haptics.lightImpact()} disabled={isLoading}>
                <Text style={styles.signInLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isLoading ? "Sending..." : "Send Verification Code"}
        onPress={handleResetPassword}
        disabled={!isButtonEnabled || isLoading}
        loading={isLoading}
        icon={ArrowRight}
        hapticType="success"
      />
      
      <SafeFooter />
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
    justifyContent: 'space-between',
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
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBackground || colors.background,
  },
  inputContainerError: {
    borderColor: colors.error || '#DC2626',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  signInText: {
    fontSize: 14,
    color: colors.text,
  },
  signInLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontWeight: '600',
    color: colors.text,
  },
  successSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  successActions: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  backToSignInButton: {
    width: '100%',
  },
  resendText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});