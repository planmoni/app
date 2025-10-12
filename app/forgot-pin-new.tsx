import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable , Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

export default function ForgotPinNewScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const verified = params.verified as string;
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const styles = createStyles(colors, isDark);

  // Redirect if not verified
  useEffect(() => {
    if (verified !== 'true') {
      router.replace('/forgot-pin');
    }
  }, [verified]);

  const handlePinChange = (digit: string) => {
    if (pin.length < 4) {
      if (Platform.OS !== 'web') {
        haptics.selection();
      }
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      
      // Auto-continue when PIN reaches 4 digits
      if (newPin.length === 4) {
        setTimeout(() => {
          handleContinue(newPin);
        }, 300);
      }
    }
  };

  const handlePinDelete = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleContinue = (pinToUse?: string) => {
    const currentPin = pinToUse || pin;
    
    if (currentPin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      return;
    }

    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    // Navigate to confirm PIN screen
    router.push({
      pathname: '/forgot-pin-confirm',
      params: {
        email: email,
        newPin: currentPin,
        verified: 'true'
      }
    });
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
        <Text style={styles.headerTitle}>Create New PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Lock size={48} color={colors.primary} />
        </View>

        <Text style={styles.description}>
          Choose a new 4-digit PIN that's easy to remember but secure.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.pinSection}>
          <PinDisplay length={4} value={pin} />
        </View>

        <PinKeypad
          onKeyPress={handlePinChange}
          onDelete={handlePinDelete}
          disabled={false}
        />

        
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
  securityTips: {
    marginTop: 32,
    padding: 20,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
}); 