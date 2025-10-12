import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert , Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { usePin } from '@/contexts/PinContext';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

export default function ForgotPinConfirmScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { updateAppLockPin } = usePin();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const newPin = params.newPin as string;
  const verified = params.verified as string;
  
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const styles = createStyles(colors, isDark);

  // Redirect if not verified or no new PIN
  useEffect(() => {
    if (verified !== 'true' || !newPin) {
      router.replace('/forgot-pin');
    }
  }, [verified, newPin]);

  const handlePinChange = (digit: string) => {
    if (confirmPin.length < 4) {
      if (Platform.OS !== 'web') {
        haptics.selection();
      }
      const newConfirmPin = confirmPin + digit;
      setConfirmPin(newConfirmPin);
      setError(null);
      
      // Auto-continue when PIN reaches 4 digits
      if (newConfirmPin.length === 4) {
        setTimeout(() => {
          handleConfirm(newConfirmPin);
        }, 300);
      }
    }
  };

  const handlePinDelete = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    setConfirmPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleConfirm = async (pinToConfirm?: string) => {
    const currentConfirmPin = pinToConfirm || confirmPin;
    
    if (currentConfirmPin.length !== 4) {
      setError('Please enter the complete PIN');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    if (newPin !== currentConfirmPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    setIsProcessing(true);
    
    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      // Update the app lock PIN
      const success = await updateAppLockPin(newPin);
      
      if (success) {
        showToast('PIN updated successfully', 'success');
        
        if (Platform.OS !== 'web') {
          haptics.success();
        }

        // Navigate to success screen
        router.push('/forgot-pin-success');
      } else {
        throw new Error('Failed to update PIN');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update PIN';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackPress = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Confirm PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <CheckCircle size={48} color={colors.primary} />
        </View>

        <Text style={styles.description}>
          Enter your new PIN again to confirm it.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.pinSection}>
          <PinDisplay length={4} value={confirmPin} />
        </View>

        <PinKeypad
          onKeyPress={handlePinChange}
          onDelete={handlePinDelete}
          disabled={isProcessing}
        />

        {isProcessing && (
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>Updating your PIN...</Text>
          </View>
        )}
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  errorContainer: {
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '500',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pinLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 24,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 32,
    padding: 20,
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  processingText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
}); 