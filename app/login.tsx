import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { supabase } from '@/lib/supabase';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { checkUserExists } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [email, setEmail] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);

  useEffect(() => {
    setIsButtonEnabled(email.trim().length > 0 && /\S+@\S+\.\S+/.test(email));
  }, [email]);

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
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
        .maybeSingle();
      
      if (verificationData && !verificationError) {
        // Email is verified but user hasn't completed signup
        // Redirect to password creation
        if (Platform.OS !== 'web') {
          haptics.mediumImpact();
        }
        router.push({
          pathname: '/onboarding/create-password',
          params: { 
            firstName: verificationData.first_name || '',
            lastName: verificationData.last_name || '',
            email: email.trim().toLowerCase(),
            emailVerified: 'true'
          }
        });
        return;
      }
      
      // Check if user exists in auth system
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: 'dummy-password-for-check'
        });
        
        // If no error about invalid credentials, user exists
        if (!signInError || !signInError.message.includes('Invalid login credentials')) {
          // User exists, proceed to password screen
          if (Platform.OS !== 'web') {
            haptics.mediumImpact();
          }
          router.push({
            pathname: '/login/password',
            params: { email: email.trim().toLowerCase() }
          });
        } else {
          // User doesn't exist, start onboarding
          if (Platform.OS !== 'web') {
            haptics.mediumImpact();
          }
          router.push({
            pathname: '/onboarding/first-name',
            params: { email: email.trim().toLowerCase() }
          });
        }
      } catch (signInError) {
        console.error('Error checking user existence:', signInError);
        // Default to password screen if there's an error
        if (Platform.OS !== 'web') {
          haptics.mediumImpact();
        }
        router.push({
          pathname: '/login/password',
          params: { email: email.trim().toLowerCase() }
        });
      }
    } catch (error) {
      console.error('Error checking email:', error);
      // Default to password screen if there's an error
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
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

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to Planmoni</Text>
          <Text style={styles.subtitle}>Enter your email to continue</Text>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
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
            
            <Text style={styles.helperText}>
              We'll check if you have an account or help you create one
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isCheckingEmail ? "Checking..." : "Continue"}
        onPress={handleContinue}
        disabled={!isButtonEnabled || isCheckingEmail}
        icon={ArrowRight}
        hapticType="medium"
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
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
    marginBottom: 16,
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
    textAlign: 'center',
  },
});