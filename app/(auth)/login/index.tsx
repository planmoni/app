import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, Link } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import SafeFooter from '@/components/SafeFooter';
import OnboardingProgress from '@/components/OnboardingProgress';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

export default function LoginEmailScreen() {
  const { colors } = useTheme();
  const { checkUserExists } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
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

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsCheckingEmail(true);
    
    try {
      // Check if this email is in the verification cache
      const { data: verificationData, error: verificationError } = await supabase
        .from('email_verification_cache')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('verified', true)
        .single();
      
      if (verificationData && !verificationError) {
        // Email is verified but user hasn't completed signup
        // Redirect to password creation
        router.push({
          pathname: '/onboarding/create-password',
          params: { 
            firstName: verificationData.first_name,
            lastName: verificationData.last_name,
            email: email.trim().toLowerCase(),
            emailVerified: 'true'
          }
        });
        return;
      }
      
      // Check if user exists using the improved method
      const { exists, error: checkError } = await checkUserExists(email.trim().toLowerCase());
      
      if (checkError) {
        console.warn('Error checking user existence:', checkError);
        // Default to password screen if there's an error
        router.push({
          pathname: '/login/password',
          params: { email: email.trim().toLowerCase() }
        });
        return;
      }
      
      if (exists) {
        // User exists, proceed to password screen
        router.push({
          pathname: '/login/password',
          params: { email: email.trim().toLowerCase() }
        });
      } else {
        // User doesn't exist, start onboarding
        router.push({
          pathname: '/onboarding/first-name',
          params: { email: email.trim().toLowerCase() }
        });
      }
    } catch (error) {
      console.error('Error checking email:', error);
      // Default to password screen if there's an error
      router.push({
        pathname: '/login/password',
        params: { email: email.trim().toLowerCase() }
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/onboarding/first-name')} style={styles.signUpButton}>
          <Text style={styles.signUpText}>Sign up instead</Text>
        </Pressable>
      </View>

      <OnboardingProgress currentStep={1} totalSteps={2} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Planmoni account</Text>

          <View style={styles.formContainer}>
            <Text style={styles.question}>What's your email address?</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.textSecondary} style={styles.inputIcon} />
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
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={handleContinue}
                editable={!isCheckingEmail}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isCheckingEmail ? "Checking..." : "Continue"}
        onPress={handleContinue}
        disabled={!isButtonEnabled || isCheckingEmail}
        icon={ArrowRight}
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
  signUpButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
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
});