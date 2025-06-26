import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { useAppLock } from '@/contexts/AppLockContext';
import { useHaptics } from '@/hooks/useHaptics';

export default function ConfirmPinScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const { setAppLockPin } = useAppLock();
  
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const bvn = params.bvn as string;
  const originalPin = params.pin as string;
  const pinLength = parseInt(params.pinLength as string) as 4 | 6;
  
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setError(null);
  }, [confirmPin]);

  const handlePinChange = (digit: string) => {
    if (confirmPin.length < pinLength && !isProcessing) {
      haptics.selection();
      setConfirmPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinDelete = () => {
    if (!isProcessing) {
      haptics.lightImpact();
      setConfirmPin(prev => prev.slice(0, -1));
      setError(null);
    }
  };

  const handleContinue = async () => {
    if (isProcessing) return;
    if (confirmPin.length !== pinLength) {
      haptics.error();
      setError(`Please enter a ${pinLength}-digit PIN`);
      return;
    }
    setIsProcessing(true);
    if (confirmPin === originalPin) {
      try {
        await setAppLockPin(originalPin);
        haptics.success();
        console.log('[OnboardingConfirmPin] PIN confirmed and saved. Navigating to next step.');
        // Navigate to next onboarding step or dashboard
        // router.push(...)
      } catch (error) {
        console.error('Error saving PIN:', error);
        setError('Failed to save PIN. Please try again.');
        haptics.error();
        setConfirmPin('');
      }
    } else {
      setError('PINs do not match. Please try again.');
      haptics.error();
      setConfirmPin('');
    }
    setIsProcessing(false);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={isProcessing ? () => {} : () => {
            haptics.lightImpact();
            router.back();
          }} 
          style={styles.backButton}
          disabled={isProcessing}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <OnboardingProgress currentStep={9} totalSteps={10} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer} disableScrollView={true}>
        <View style={styles.content}>
          <Text style={styles.title}>Confirm your PIN</Text>
          <Text style={styles.subtitle}>Enter your PIN again to confirm</Text>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.pinContainer}>
              <PinDisplay 
                length={pinLength}
                value={confirmPin}
              />
              
              <PinKeypad 
                onKeyPress={isProcessing ? () => {} : handlePinChange}
                onDelete={isProcessing ? () => {} : handlePinDelete}
                disabled={isProcessing || confirmPin.length >= pinLength}
              />
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <ShieldCheck size={20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                Make sure you remember this PIN. You'll need it to access your account and authorize transactions.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={confirmPin.length !== pinLength}
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
    paddingTop: 24,
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
  pinContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  securityIconContainer: {
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});