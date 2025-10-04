import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams, Link } from 'expo-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import OnboardingProgress from '@/components/OnboardingProgress';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export default function LoginPasswordScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => passwordInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(password.length >= 6);
  }, [password]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Poll Supabase for a session (up to timeoutMs)
  async function waitForSupabaseSession(timeoutMs = 1500, stepMs = 100) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      await sleep(stepMs);
    }
    return false;
  }

  const handleLogin = async () => {
    if (!password) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your password');
      showToast('Please enter your password', 'error');
      return;
    }
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      // Perform sign in first
      const result = await signIn(email, password);

      if (!result.success) {
        // If sign in fails, show error on current screen
        haptics.notification(Haptics.NotificationFeedbackType.Error);
        setError(result.error || 'Invalid email or password. Please check your credentials and try again.');
        showToast(result.error || 'Invalid email or password. Please check your credentials and try again.', 'error');
        setSubmitting(false);
        return;
      }

      // Only navigate to success screen if sign-in is successful
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      router.replace('/login-success');
    } catch (error) {
      // Handle any unexpected errors
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setSubmitting(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    haptics.selection();
    setShowPassword((v) => !v);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            if (!submitting) router.back();
          }}
          style={styles.backButton}
          disabled={submitting}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            if (!submitting) router.push('/(auth)/onboarding/first-name');
          }}
          style={styles.signUpButton}
          disabled={submitting}
        >
          <Text style={styles.signUpText}>Sign up instead</Text>
        </Pressable>
      </View>

      <OnboardingProgress currentStep={2} totalSteps={2} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Enter your password</Text>
          <Text style={styles.subtitle}>Please enter your password to continue</Text>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={[styles.inputContainer, error && { borderColor: colors.error }]}>
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!submitting}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={handleTogglePasswordVisibility}
                disabled={submitting}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>

            <View style={styles.forgotPasswordContainer}>
              <Link href="/(auth)/forgot-password" asChild>
                <Pressable onPress={() => haptics.lightImpact()} disabled={submitting}>
                  <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Sign In"
        onPress={handleLogin}
        disabled={!isButtonEnabled || submitting}
        loading={false} // Remove loading state
        icon={ArrowRight}
        hapticType="success"
        keyboardGap={Platform.OS === 'android' ? -220 : -20}
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
    signUpButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
    },
    signUpText: {
      fontSize: 14,
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
    emailDisplay: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.primary,
      marginBottom: 24,
      padding: 12,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
      overflow: 'hidden',
      textAlign: 'center',
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      height: 56,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      height: '100%',
    },
    eyeButton: {
      padding: 8,
    },
    forgotPasswordContainer: {
      alignItems: 'flex-end',
      marginTop: 16,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
  });
