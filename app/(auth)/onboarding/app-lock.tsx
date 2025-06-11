import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Lock, Fingerprint } from 'lucide-react-native';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import PinInput from '@/components/PinInput';

export default function AppLockScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const bvn = params.bvn as string;
  
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePinChange = (value: string) => {
    setPin(value);
    if (error) setError(null);
  };

  const handleContinue = () => {
    if (pin.length !== pinLength) {
      setError(`Please enter a ${pinLength}-digit PIN`);
      return;
    }
    
    router.push({
      pathname: '/onboarding/success',
      params: { firstName, lastName, email, password, bvn, pin }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnboardingProgress step={8} totalSteps={8} />
      
      <KeyboardAvoidingWrapper disableDismissKeyboard={true}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Set up app lock</Text>
            <Text style={styles.subtitle}>Create a PIN to secure your account</Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.pinContainer}>
            <PinInput
              length={pinLength}
              value={pin}
              onChange={handlePinChange}
              autoFocus
            />
          </View>

          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>PIN Length</Text>
            <View style={styles.optionsButtons}>
              <Pressable
                style={[
                  styles.optionButton,
                  pinLength === 4 && styles.optionButtonActive
                ]}
                onPress={() => setPinLength(4)}
              >
                <Text style={[
                  styles.optionButtonText,
                  pinLength === 4 && styles.optionButtonTextActive
                ]}>4 Digits</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  pinLength === 6 && styles.optionButtonActive
                ]}
                onPress={() => setPinLength(6)}
              >
                <Text style={[
                  styles.optionButtonText,
                  pinLength === 6 && styles.optionButtonTextActive
                ]}>6 Digits</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.biometricsContainer}>
            <View style={styles.biometricsHeader}>
              <Fingerprint size={24} color={colors.primary} />
              <Text style={styles.biometricsTitle}>Enable Biometric Authentication</Text>
            </View>
            <Text style={styles.biometricsDescription}>
              Use your fingerprint or face recognition to quickly access your account
            </Text>
            <Pressable style={styles.biometricsButton}>
              <Text style={styles.biometricsButtonText}>Enable Biometrics</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={pin.length !== pinLength}
      />
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
  pinContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  optionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  optionButtonTextActive: {
    color: colors.primary,
  },
  biometricsContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  biometricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  biometricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  biometricsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  biometricsButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  biometricsButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});