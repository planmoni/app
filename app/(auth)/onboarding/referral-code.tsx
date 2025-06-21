import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Gift } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';

export default function ReferralCodeScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const bvn = params.bvn as string;
  const pin = params.pin as string;
  const pinLength = params.pinLength as string;

  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validReferrer, setValidReferrer] = useState<{id: string, name: string} | null>(null);
  const referralInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      referralInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const validateReferralCode = async (code: string) => {
    if (!code) return;
    
    setIsValidating(true);
    setError(null);
    
    try {
      // Check if the referral code exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('referral_code', code.toUpperCase())
        .single();
      
      if (error || !data) {
        setError('Invalid referral code');
        setValidReferrer(null);
        return false;
      }
      
      setValidReferrer({
        id: data.id,
        name: `${data.first_name} ${data.last_name}`
      });
      return true;
    } catch (err) {
      console.error('Error validating referral code:', err);
      setError('Failed to validate referral code');
      setValidReferrer(null);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = async () => {
    haptics.mediumImpact();
    
    if (referralCode) {
      // Validate the code before continuing
      const isValid = await validateReferralCode(referralCode);
      if (!isValid) {
        haptics.error();
        return;
      }
    }
    
    router.push({
      pathname: '/onboarding/success',
      params: {
        firstName,
        lastName,
        email,
        password,
        bvn,
        pin,
        pinLength,
        referralCode: referralCode.trim().toUpperCase(),
      },
    });
  };

  const handleSkip = () => {
    haptics.lightImpact();
    router.push({
      pathname: '/onboarding/success',
      params: {
        firstName,
        lastName,
        email,
        password,
        bvn,
        pin,
        pinLength,
        referralCode: '', // Explicitly pass empty string if skipped
      },
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <OnboardingProgress currentStep={9} totalSteps={10} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Got a referral code?</Text>
          <Text style={styles.subtitle}>Enter it below to get a bonus!</Text>

          <View style={styles.formContainer}>
            <Text style={styles.question}>Enter referral code (optional)</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            {validReferrer && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>
                  Valid code! You were referred by {validReferrer.name}
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Gift size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={referralInputRef}
                style={styles.input}
                placeholder="e.g., PLANMONI123"
                placeholderTextColor={colors.textTertiary}
                value={referralCode}
                onChangeText={(text) => {
                  setReferralCode(text);
                  setError(null);
                  setValidReferrer(null);
                }}
                onBlur={() => {
                  if (referralCode) {
                    validateReferralCode(referralCode);
                  }
                }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                editable={!isValidating}
              />
              {isValidating && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Validating...</Text>
                </View>
              )}
            </View>

            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
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
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
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
    fontSize: 20,
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
  successContainer: {
    backgroundColor: colors.successLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: colors.success,
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
  loadingContainer: {
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: 32,
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
});