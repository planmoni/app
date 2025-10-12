import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { BiometricService } from '@/lib/biometrics';
import { useHaptics } from '@/hooks/useHaptics';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';

export default function AppLockScreen() {
  const { colors, isDark } = useTheme();
  const { hasAppLockPin, verifyAppLockPin, biometricEnabled, checkBiometricSupport } = usePin();
  const { unlockApp, getLastActivePage } = useAppLock();
  const router = useRouter();
  const haptics = useHaptics();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    checkBiometrics();
    
    // Auto-trigger biometric if enabled, but only after a longer delay
    // This prevents accidental triggering when the component is briefly rendered
    if (biometricEnabled && hasAppLockPin) {
      const timer = setTimeout(() => {
        // Only auto-trigger if the component is still mounted and visible
        // and we actually have an app lock PIN set up
        handleBiometricUnlock();
      }, 2000); // Increased delay to prevent accidental triggering
      
      return () => clearTimeout(timer);
    }
  }, [biometricEnabled, hasAppLockPin]);

  const checkBiometrics = async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
      setShowBiometricOption(biometricEnabled && support.isAvailable && support.isEnrolled);
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  };

  const handlePinChange = (digit: string) => {
    if (pin.length < 4 && !isVerifying) {
      haptics.selection();
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      
      // Auto-verify when PIN is complete
      if (newPin.length === 4) {
        setTimeout(() => {
          verifyPin(newPin);
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    if (!isVerifying) {
      haptics.lightImpact();
      setPin(prev => prev.slice(0, -1));
      setError('');
    }
  };

  const verifyPin = async (pinToVerify: string) => {
    console.log('AppLockScreen - Verifying PIN');
    setIsVerifying(true);
    setError('');
    
    try {
      const isValid = await verifyAppLockPin(pinToVerify);
      
      if (isValid) {
        haptics.success();
        setPin('');
        setIsUnlocked(true);
        unlockApp();
        
        // Navigate to the last active page
        const lastPage = getLastActivePage();
        const targetPage = lastPage || '/(tabs)/index';
        
        setTimeout(() => {
          router.replace(targetPage);
        }, 500);
      } else {
        haptics.error();
        setError('Incorrect PIN');
        setPin('');
      }
    } catch (error) {
      console.error('AppLockScreen - PIN verification error:', error);
      haptics.error();
      setError('Verification failed');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricEnabled) {
      Alert.alert('Biometrics Disabled', 'Please enable biometric authentication in Security Center to use this feature.');
      return;
    }
    
    try {
      setIsVerifying(true);
      
      const result = await BiometricService.authenticateWithBiometrics(
        "Authenticate to unlock Planmoni"
      );
      
      if (result.success) {
        haptics.success();
        setIsUnlocked(true);
        unlockApp();
        
        // Navigate to the last active page
        const lastPage = getLastActivePage();
        const targetPage = lastPage || '/(tabs)/index';
        
        setTimeout(() => {
          router.replace(targetPage);
        }, 500);
      } else {
        haptics.error();
        if (result.error !== "Authentication cancelled") {
          Alert.alert('Authentication Failed', 'Biometric authentication failed. Please try again or use your PIN.');
        }
      }
    } catch (error) {
      console.error('AppLockScreen - Biometric unlock error:', error);
      haptics.error();
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const getUserName = () => {
    // You can get this from your auth context
    return 'User';
  };

  const getBiometricText = () => {
    if (!biometricSupport) return 'Unlock with biometrics';
    
    const label = biometricSupport.supportedTypes;
    return `Unlock with ${label}`;
  };

  const getBiometricIcon = () => {
    if (!biometricSupport) return 'finger-print-outline';
    
    const iconName = BiometricService.getBiometricIcon(biometricSupport.supportedTypes);
    
    // Map to valid Ionicons names
    if (iconName === 'face-recognition') return 'scan';
    if (iconName === 'finger-print') return 'finger-print-outline';
    if (iconName === 'eye') return 'eye-outline';
    
    return 'shield-checkmark-outline';
  };

  const styles = getStyles(isDark, colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{getUserName()}</Text>
        </View>

        <View style={styles.lockIcon}>
          <Text style={styles.lockIconText}>🔒</Text>
        </View>

        <Text style={styles.instruction}>Enter your PIN to continue</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <PinDisplay 
          length={4}
          value={pin}
        />

        <PinKeypad 
          onKeyPress={isVerifying ? () => {} : handlePinChange}
          onDelete={isVerifying ? () => {} : handleDelete}
          disabled={isVerifying}
        />

        {showBiometricOption && (
          <Pressable 
            style={styles.biometricButton}
            onPress={handleBiometricUnlock}
            disabled={isVerifying}
          >
            <Text style={styles.biometricText}>{getBiometricText()}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  greeting: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  lockIcon: {
    marginBottom: 32,
  },
  lockIconText: {
    fontSize: 48,
  },
  instruction: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  errorContainer: {
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  biometricButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  biometricText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
