import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { CreditCard, Info } from 'lucide-react-native';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';

export default function BVNScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  
  const [bvn, setBvn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus the input field when the component mounts
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    if (bvn && bvn.length !== 11) {
      setError('BVN must be 11 digits');
      return;
    }
    
    router.push({
      pathname: '/onboarding/app-lock',
      params: { firstName, lastName, email, password, bvn }
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding/app-lock',
      params: { firstName, lastName, email, password }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnboardingProgress step={7} totalSteps={8} />
      
      <KeyboardAvoidingWrapper disableDismissKeyboard={true}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Enter your BVN</Text>
            <Text style={styles.subtitle}>Bank Verification Number (Optional)</Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <CreditCard size={20} color={colors.textSecondary} style={styles.icon} />
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Enter your 11-digit BVN"
                placeholderTextColor={colors.textTertiary}
                value={bvn}
                onChangeText={(text) => {
                  // Only allow numbers and limit to 11 digits
                  if (/^\d*$/.test(text) && text.length <= 11) {
                    setBvn(text);
                    if (error) setError(null);
                  }
                }}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={handleContinue}
              />
            </View>
          </View>

          <View style={styles.infoContainer}>
            <Info size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Your BVN helps us verify your identity and increases your transaction limits. We do not store your BVN after verification.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <View style={styles.buttonContainer}>
        <FloatingButton 
          title="Continue"
          onPress={handleContinue}
          disabled={bvn.length > 0 && bvn.length !== 11}
        />
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'flex-start',
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
    textAlign: 'left',
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 24,
    gap: 16,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
});