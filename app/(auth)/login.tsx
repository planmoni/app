import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, Image } from 'react-native';
import { router, Link } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react-native';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { signIn, isLoading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{email?: string; password?: string}>({});
  const [loginError, setLoginError] = useState<string | null>(null);

  const validateForm = () => {
    const errors: {email?: string; password?: string} = {};
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoginError(null);
    
    const result = await signIn(email.toLowerCase().trim(), password);
    
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setLoginError(result.error || 'Failed to sign in');
    }
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={isDark 
              ? require('@/assets/images/PlanmoniDarkMode.png')
              : require('@/assets/images/Planmoni.png')
            }
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Planmoni account</Text>
        </View>

        <View style={styles.form}>
          {(loginError || authError) && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{loginError || authError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[
              styles.inputContainer,
              formErrors.email && styles.inputError
            ]}>
              <Mail size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (formErrors.email) {
                    setFormErrors(prev => ({ ...prev, email: undefined }));
                  }
                  if (loginError) {
                    setLoginError(null);
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>
            {formErrors.email && (
              <Text style={styles.fieldError}>{formErrors.email}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Link href="/(auth)/forgot-password" asChild>
                <Pressable>
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </Pressable>
              </Link>
            </View>
            <View style={[
              styles.inputContainer,
              formErrors.password && styles.inputError
            ]}>
              <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (formErrors.password) {
                    setFormErrors(prev => ({ ...prev, password: undefined }));
                  }
                  if (loginError) {
                    setLoginError(null);
                  }
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
            {formErrors.password && (
              <Text style={styles.fieldError}>{formErrors.password}</Text>
            )}
          </View>

          <Button
            title="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            style={styles.signInButton}
            icon={ArrowRight}
          />

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Link href="/" asChild>
              <Pressable>
                <Text style={styles.signUpLink}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: 24,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: isDark ? colors.backgroundTertiary : colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  inputError: {
    borderColor: colors.error,
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
  fieldError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  signInButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signUpText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signUpLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});