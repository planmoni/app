import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import PinKeypad from '@/components/PinKeypad';

const PIN_LENGTH = 4;

export default function SetupPin() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { setupAppLockPin } = usePin();
  const haptics = useHaptics();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  const currentPin = step === 'setup' ? pin : confirmPin;

  const shakeDots = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const savePin = async (value: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const success = await setupAppLockPin(value);
      if (success) {
        haptics.success();
        router.push('/settings/pin-setup-success');
      } else {
        Alert.alert('Error', 'Failed to setup PIN. Please try again.');
        setConfirmPin('');
      }
    } catch {
      Alert.alert('Error', 'Failed to setup PIN. Please try again.');
      setConfirmPin('');
    } finally {
      setSaving(false);
    }
  };

  const handlePinEnter = (digit: string) => {
    if (saving) return;
    setError(null);

    if (step === 'setup') {
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setStep('confirm'), 160);
      }
      return;
    }

    if (confirmPin.length >= PIN_LENGTH) return;
    const next = confirmPin + digit;
    setConfirmPin(next);
    if (next.length === PIN_LENGTH) {
      if (next === pin) {
        void savePin(next);
      } else {
        haptics.error();
        setError('Those PINs don’t match. Try again.');
        shakeDots();
        setTimeout(() => setConfirmPin(''), 420);
      }
    }
  };

  const handleDelete = () => {
    if (saving) return;
    setError(null);
    if (step === 'setup') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleBack = () => {
    haptics.lightImpact();
    if (step === 'confirm') {
      setStep('setup');
      setPin('');
      setConfirmPin('');
      setError(null);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.steps}>
          <View style={[styles.stepBar, { backgroundColor: colors.primary }]} />
          <View
            style={[
              styles.stepBar,
              { backgroundColor: step === 'confirm' ? colors.primary : isDark ? '#334155' : '#E2E8F0' },
            ]}
          />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {step === 'setup' ? 'Set up App PIN' : 'Confirm App PIN'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 'setup'
            ? 'Choose a 4-digit PIN to unlock Planmoni.'
            : 'Enter the same PIN again to finish setup.'}
        </Text>

        <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => {
            const filled = index < currentPin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    borderColor: error ? colors.error : filled ? colors.primary : isDark ? '#334155' : '#CBD5E1',
                    backgroundColor: filled ? (error ? colors.error : colors.primary) : 'transparent',
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        <Text style={[styles.error, { color: colors.error }]}>{error ?? ' '}</Text>
      </View>

      <View style={styles.keypad}>
        <PinKeypad onKeyPress={handlePinEnter} onDelete={handleDelete} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    height: 48,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  steps: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  stepBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 36,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  error: {
    marginTop: 16,
    minHeight: 20,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  keypad: {
    paddingBottom: 12,
    alignItems: 'center',
  },
});
