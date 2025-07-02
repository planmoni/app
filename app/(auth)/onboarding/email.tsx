import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function EmailScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(email.trim().length > 0);
  }, [email]);

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      showToast('Please enter your email address', 'error');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      showToast('Please enter a valid email address', 'error');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }
    
    setIsLoading(true);
    
    try {
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
      
      showToast('Verification code sent to your email', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
      
      // Navigate to OTP verification screen
      router.push({
        pathname: '/onboarding/otp',
        params: { 
          firstName,
          lastName,
          email: email.trim().toLowerCase()
        }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
      showToast('An error occurred. Please try again.', 'error');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
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
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.push('/login');
          }} 
          style={styles.signInButton}
        >
          <Text style={styles.signInText}>Sign in instead</Text>
        </Pressable>
      </View>

      <OnboardingProgress currentStep={3} totalSteps={10} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Almost there, {firstName}</Text>
          <Text style={styles.subtitle}>Let's verify your identity</Text>

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
                editable={!isLoading}
              />
            </View>
            
            <Text style={styles.helperText}>
              We'll use this email for account verification and communication
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isLoading ? "Processing..." : "Continue"}
        onPress={handleContinue}
        disabled={!isButtonEnabled || isLoading}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
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
  signInButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
  },
  signInText: {
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
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
});