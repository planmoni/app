import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';

export default function AppLockSetupScreen() {
  const { colors } = useTheme();
  const [pinLength] = useState<number>(6);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [pin]);

  const handlePinChange = (digit: string) => {
    if (pin.length < pinLength) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleContinue = () => {
    if (pin.length !== pinLength) {
      setError(`Please enter a ${pinLength}-digit PIN`);
      return;
    }
    
    router.push({
      pathname: '/app-lock-setup/confirm',
      params: { pin }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>App Lock</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer} disableScrollView={true}>
        <View style={styles.content}>
          <Text style={styles.title}>Set up app lock</Text>
          <Text style={styles.subtitle}>Create a PIN to secure your account</Text>

          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Enter a 6-digit PIN</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.pinContainer}>
              <PinDisplay 
                length={pinLength}
                value={pin}
              />
              
              <PinKeypad 
                onKeyPress={handlePinChange}
                onDelete={handlePinDelete}
                disabled={pin.length >= pinLength}
              />
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <Lock size={20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                This PIN will be used to unlock the app and authorize transactions
              </Text>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40,
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
  instruction: {
    fontSize: 18,
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