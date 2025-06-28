import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info, CreditCard } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useHaptics } from '@/hooks/useHaptics';

export default function BVNScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const emailVerified = params.emailVerified === 'true';
  
  const [bvn, setBvn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const bvnInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      bvnInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsButtonEnabled(bvn.length === 11 || bvn.length === 0);
  }, [bvn]);

  const handleContinue = () => {
    if (bvn && bvn.length !== 11) {
      haptics.error();
      setError('BVN must be 11 digits');
      return;
    }
    
    haptics.mediumImpact();
    router.push({
      pathname: '/onboarding/referral-code',
      params: { 
        firstName,
        lastName,
        email,
        password,
        bvn: bvn || 'skipped',
        emailVerified: emailVerified ? 'true' : 'false'
      }
    });
  };

  const handleSkip = () => {
    haptics.lightImpact();
    router.push({
      pathname: '/onboarding/referral-code',
      params: { 
        firstName,
        lastName,
        email,
        password,
        bvn: 'skipped',
        emailVerified: emailVerified ? 'true' : 'false'
      }
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

      <OnboardingProgress currentStep={6} totalSteps={7} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.subtitle}>This helps us keep your account secure</Text>

          <View style={styles.formContainer}>
            <Text style={styles.question}>What's your BVN?</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <CreditCard size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={bvnInputRef}
                style={styles.input}
                placeholder="Enter your 11-digit BVN"
                placeholderTextColor={colors.textTertiary}
                value={bvn}
                onChangeText={(text) => {
                  // Only allow numbers
                  const numericText = text.replace(/[^0-9]/g, '');
                  if (numericText.length <= 11) {
                    setBvn(numericText);
                    setError(null);
                  }
                }}
                keyboardType="number-pad"
              />
            </View>
            
            <View style={styles.infoContainer}>
              <Info size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Your BVN is not stored and is only used for verification purposes.
              </Text>
            </View>
            
            <Pressable 
              onPress={handleSkip} 
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={!isButtonEnabled}
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
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
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