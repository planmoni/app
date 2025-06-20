import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useAppLock } from '@/contexts/AppLockContext';
import { useTheme } from '@/contexts/ThemeContext';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { Lock, Fingerprint } from 'lucide-react-native';
import { BiometricService } from '@/lib/biometrics';

export default function LockScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { unlockApp, checkPin, appLockPin } = useAppLock();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Check if biometrics are available
  useEffect(() => {
    const checkBiometrics = async () => {
      if (Platform.OS !== 'web') {
        try {
          const biometricSettings = await BiometricService.checkBiometricSupport();
          setShowBiometricButton(biometricSettings.isEnabled && biometricSettings.isAvailable);
        } catch (error) {
          console.error('Error checking biometric support:', error);
          setShowBiometricButton(false);
        }
      }
    };
    
    checkBiometrics();
  }, []);
  
  // Handle PIN input
  const handlePinChange = (digit: string) => {
    if (pin.length < (appLockPin?.length || 6)) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      
      // Check if PIN is complete
      if (newPin.length === appLockPin?.length) {
        handleVerifyPin(newPin);
      }
    }
  };
  
  // Handle PIN deletion
  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };
  
  // Verify PIN
  const handleVerifyPin = (pinToCheck: string = pin) => {
    if (checkPin(pinToCheck)) {
      unlockApp();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };
  
  // Handle biometric authentication
  const handleBiometricAuth = async () => {
    if (Platform.OS === 'web') return;
    
    try {
      const result = await BiometricService.authenticateWithBiometrics('Unlock Planmoni');
      
      if (result.success) {
        unlockApp();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      console.error('Error authenticating with biometrics:', error);
      setError('Biometric authentication failed. Please use your PIN.');
    }
  };
  
  const styles = createStyles(colors, isDark, isSmallScreen);
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.lockIconContainer}>
          <Lock size={isSmallScreen ? 40 : 48} color={colors.primary} />
        </View>
        
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>Enter your PIN to unlock</Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.pinContainer}>
          <PinDisplay 
            length={appLockPin?.length || 6}
            value={pin}
          />
          
          <PinKeypad 
            onKeyPress={handlePinChange}
            onDelete={handlePinDelete}
          />
        </View>
        
        {showBiometricButton && Platform.OS !== 'web' && (
          <Pressable 
            style={styles.biometricButton}
            onPress={handleBiometricAuth}
          >
            <Fingerprint size={isSmallScreen ? 20 : 24} color={colors.primary} />
            <Text style={styles.biometricButtonText}>Use Biometrics</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    padding: isSmallScreen ? 20 : 32,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: isSmallScreen ? 80 : 100,
    height: isSmallScreen ? 80 : 100,
    borderRadius: isSmallScreen ? 40 : 50,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 24 : 32,
  },
  title: {
    fontSize: isSmallScreen ? 24 : 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 24 : 32,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 300,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  pinContainer: {
    alignItems: 'center',
    width: '100%',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: isSmallScreen ? 24 : 32,
    padding: 12,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  biometricButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
});