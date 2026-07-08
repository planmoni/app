import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';

export default function WelcomeBackScreen() {
  const { colors } = useTheme();
  const { signIn, sessionRecovery, clearSessionRecovery } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const passwordInputRef = useRef<TextInput>(null);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const email = sessionRecovery?.email ?? '';
  const firstName = useMemo(
    () => sessionRecovery?.firstName?.trim() || 'there',
    [sessionRecovery?.firstName]
  );

  useEffect(() => {
    if (!sessionRecovery?.email) {
      router.replace('/(auth)/login');
      return;
    }

    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, [sessionRecovery?.email]);

  const handleFullLogin = async () => {
    await clearSessionRecovery();
    router.replace('/(auth)/login');
  };

  const handleLogin = async () => {
    if (!password) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      const message = 'Please enter your password';
      setError(message);
      showToast(message, 'error');
      return;
    }

    if (!email || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await signIn(email, password);
      if (result.success) {
        await clearSessionRecovery();
        haptics.notification(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
        return;
      }

      haptics.notification(Haptics.NotificationFeedbackType.Error);
      const message = result.error || 'Failed to sign in';
      setError(message);
      showToast(message, 'error');
      setSubmitting(false);
    } catch (loginError) {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      const message = loginError instanceof Error ? loginError.message : 'An unexpected error occurred';
      setError(message);
      showToast(message, 'error');
      setSubmitting(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            if (!submitting) {
              void handleFullLogin();
            }
          }}
          style={styles.backButton}
          disabled={submitting}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome back, {firstName}</Text>
          <Text style={styles.subtitle}>
            Your session expired while you were away. Enter your password to refresh your account and load the latest data.
          </Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Account</Text>
            <View style={styles.emailPill}>
              <Text style={styles.emailText}>{email}</Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, error ? styles.inputContainerError : null]}>
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
                onPress={() => {
                  haptics.selection();
                  setShowPassword((prev) => !prev);
                }}
                disabled={submitting}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                haptics.lightImpact();
                void handleFullLogin();
              }}
              disabled={submitting}
            >
              <Text style={styles.switchAccountText}>Use a different account instead</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleLogin}
        disabled={password.length < 6 || submitting}
        loading={submitting}
        icon={ArrowRight}
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
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 36,
      lineHeight: 24,
    },
    formContainer: {
      width: '100%',
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    emailPill: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
    },
    emailText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      borderRadius: 8,
      padding: 12,
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
    inputContainerError: {
      borderColor: colors.error || '#DC2626',
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
    switchAccountText: {
      marginTop: 8,
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
