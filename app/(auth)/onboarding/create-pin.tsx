import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';
import OnScreenKeypad from '@/components/OnScreenKeypad';

export default function CreatePinScreen() {
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
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);

  useEffect(() => {
    setIsButtonEnabled(pin.length === pinLength);
  }, [pin, pinLength]);

  const handleKeyPress = (key: string) => {
    if (pin.length < pinLength) {
      setPin(prev => prev + key);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleContinue = () => {
    if (pin.length !== pinLength) {
      setError(`Please enter a ${pinLength}-digit PIN`);
      return;
    }
    
    router.push({
      pathname: '/onboarding/confirm-pin',
      params: { 
        firstName,
        lastName,
        email,
        password,
        bvn,
        pin
      }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <OnboardingProgress currentStep={7} totalSteps={9} />

      <View style={styles.content}>
        <Text style={styles.title}>Set up app lock</Text>
        <Text style={styles.subtitle}>Create a PIN to secure your account</Text>

        <View style={styles.formContainer}>
          <Text style={styles.question}>Choose a PIN length</Text>
          
          <View style={styles.pinLengthContainer}>
            <Pressable 
              style={[
                styles.pinLengthOption,
                pinLength === 4 && styles.activePinLength
              ]}
              onPress={() => {
                setPinLength(4);
                setPin('');
              }}
            >
              <Text style={[
                styles.pinLengthText,
                pinLength === 4 && styles.activePinLengthText
              ]}>4 digits</Text>
            </Pressable>
            
            <Pressable 
              style={[
                styles.pinLengthOption,
                pinLength === 6 && styles.activePinLength
              ]}
              onPress={() => {
                setPinLength(6);
                setPin('');
              }}
            >
              <Text style={[
                styles.pinLengthText,
                pinLength === 6 && styles.activePinLengthText
              ]}>6 digits</Text>
            </Pressable>
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <View style={styles.pinDisplayContainer}>
            <View style={styles.pinDotsContainer}>
              {Array.from({ length: pinLength }).map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.pinDot,
                    index < pin.length && styles.pinDotFilled
                  ]}
                />
              ))}
            </View>
          </View>
          
          <View style={styles.securityInfo}>
            <View style={styles.securityIconContainer}>
              <Shield size={20} color={colors.primary} />
            </View>
            <Text style={styles.securityText}>
              This PIN will be used to unlock the app and authorize transactions
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <FloatingButton 
            title="Continue"
            onPress={handleContinue}
            disabled={!isButtonEnabled}
            icon={ArrowRight}
          />
        </View>
      </View>

      <OnScreenKeypad
        onKeyPress={handleKeyPress}
        onDelete={handleDelete}
        onClear={handleClear}
        disabled={pin.length >= pinLength}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 60,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
  },
  pinLengthContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pinLengthOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  activePinLength: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  pinLengthText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activePinLengthText: {
    color: colors.primary,
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
  pinDisplayContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
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
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 16,
  },
});