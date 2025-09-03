import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAutoLogout } from '@/contexts/AutoLogoutContext';
import { usePin } from '@/contexts/PinContext';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { BiometricService } from '@/lib/biometrics';

export default function AppLockScreen() {
  const { colors, isDark } = useTheme();
  const { isAppLocked, unlockApp, checkPin } = useAutoLogout();
  const { hasAppLockPin, biometricEnabled } = usePin();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);

  // Debug logging
  useEffect(() => {
    console.log('AppLockScreen - Component state:', {
      isAppLocked,
      timestamp: new Date().toISOString()
    });
  }, [isAppLocked]);

  // Load biometric support on mount
  useEffect(() => {
    loadBiometricSupport();
  }, []);

  const loadBiometricSupport = async () => {
    try {
      const support = await BiometricService.checkBiometricSupport();
      setBiometricSupport(support);
    } catch (error) {
      console.error('Error loading biometric support:', error);
    }
  };

  const getBiometricText = () => {
    if (!biometricSupport) return 'Unlock with Biometrics';
    
    const label = BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes);
    return `Unlock with ${label}`;
  };

  const getBiometricIcon = () => {
    if (!biometricSupport) return 'finger-print-outline';
    
    const iconName = BiometricService.getBiometricIcon(biometricSupport.supportedTypes);
    
    // Map to valid Ionicons names
    if (iconName === 'face-recognition') return 'person';
    if (iconName === 'finger-print') return 'finger-print-outline';
    if (iconName === 'eye') return 'eye-outline';
    
    return 'shield-checkmark-outline';
  };

  // If not locked, don't render anything
  if (!isAppLocked) {
    console.log('AppLockScreen - Not locked, returning null');
    return null;
  }

  console.log('AppLockScreen - Rendering lock screen');

  const handlePinEnter = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      
      // Auto-verify when PIN reaches 4 digits
      if (newPin.length === 4) {
        handleVerifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleVerifyPin = async (pinToCheck: string = pin) => {
    if (isUnlocking) return;
    
    setIsUnlocking(true);
    try {
      const isValid = await checkPin(pinToCheck);
      if (isValid) {
        setError(null);
        setPin('');
        unlockApp();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
      setPin('');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricEnabled) {
      Alert.alert('Biometrics Disabled', 'Please enable biometric authentication in Security Center to use this feature.');
      return;
    }
    
    try {
      const result = await BiometricService.authenticateWithBiometrics('Unlock Planmoni with biometrics');
      if (result.success) {
        // Biometric authentication successful, unlock the app
        unlockApp();
      } else {
        Alert.alert('Authentication Failed', result.error || 'Biometric authentication failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
    }
  };

  const styles = getStyles(isDark, colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.lockIconContainer}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>App Locked</Text>
          <Text style={styles.headerSubtitle}>
            Enter your PIN to unlock the app
          </Text>
          <Text style={styles.lockReason}>
            App locked due to auto-logout setting
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.pinSection}>
          <PinDisplay 
            length={4}
            value={pin}
          />
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>

        <PinKeypad
          onKeyPress={handlePinEnter}
          onDelete={handleDelete}
          disabled={isUnlocking}
        />

        <TouchableOpacity 
          style={styles.forgotPinButton}
          onPress={() => {
            Alert.alert(
              'Forgot PIN?',
              'Please contact support to reset your app lock PIN. You may need to verify your identity.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Contact Support', onPress: () => {
                  // TODO: Implement contact support functionality
                  Alert.alert('Contact Support', 'Support contact functionality will be implemented soon.');
                }}
              ]
            );
          }}
          disabled={isUnlocking}
        >
          <Text style={styles.forgotPinButtonText}>Forgot Pin?</Text>
        </TouchableOpacity>

        {biometricEnabled && (
          <TouchableOpacity 
            style={styles.biometricButton}
            onPress={handleBiometricUnlock}
            disabled={isUnlocking}
          >
            <Ionicons name={getBiometricIcon()} size={24} color={colors.primary} />
            <Text style={styles.biometricButtonText}>{getBiometricText()}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Your app is locked for security. This happens when:
          </Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoItemText}>Auto-logout timer expired</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoItemText}>App was backgrounded</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoItemText}>Manual lock activated</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  lockReason: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 40,
  },
  biometricButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  forgotPinButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 40,
  },
  forgotPinButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItemText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
}); 