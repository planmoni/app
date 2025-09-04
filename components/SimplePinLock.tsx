import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAutoLogout } from '@/contexts/AutoLogoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePin } from '@/contexts/PinContext';
import { useRouter } from 'expo-router';
import { BiometricService } from '@/lib/biometrics';

export default function SimplePinLock() {
  const { colors, isDark } = useTheme();
  const { isAppLocked, unlockApp, getLastActivePage } = useAutoLogout();
  const { session } = useAuth();
  const { verifyAppLockPin, verifyAppLockPinWithBiometrics, biometricEnabled } = usePin();
  const router = useRouter();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Load biometric support on mount
  useEffect(() => {
    loadBiometricSupport();
  }, []);

  // Don't render if not locked or if we've already unlocked
  if (!isAppLocked || isUnlocked) {
    console.log('SimplePinLock - App is not locked or already unlocked, returning null');
    return null;
  }

  console.log('SimplePinLock - Rendering lock screen');

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

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(''); // Clear any previous errors
      
      // Auto-submit when 4 digits are entered
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const verifyPin = async (pinToVerify: string) => {
    console.log('SimplePinLock - Starting PIN verification for:', pinToVerify);
    setIsVerifying(true);
    setError('');
    
    try {
      const isValid = await verifyAppLockPin(pinToVerify);
      console.log('SimplePinLock - PIN verification result:', isValid);
      
      if (isValid) {
        // PIN is correct - unlock the app
        console.log('SimplePinLock - PIN correct, calling unlockApp()');
        setPin('');
        
        // Set flag to prevent re-render
        setIsUnlocked(true);
        
        unlockApp();
        console.log('SimplePinLock - unlockApp() called successfully');
        
        // Navigate to the last active page or fallback to index
        const lastPage = getLastActivePage();
        const targetPage = lastPage || '/(tabs)/index';
        
        console.log('SimplePinLock - Navigating to:', targetPage);
        
        // Longer delay to ensure protection is fully set for PIN unlock
        setTimeout(() => {
          router.replace(targetPage);
        }, 500);
      } else {
        // PIN is incorrect
        console.log('SimplePinLock - PIN incorrect, showing error');
        setError('Incorrect PIN');
        setPin('');
      }
    } catch (error) {
      console.error('SimplePinLock - PIN verification error:', error);
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
      console.log('SimplePinLock - Starting biometric PIN verification...');
      
      // Use the new biometric PIN verification function
      const isValid = await verifyAppLockPinWithBiometrics();
      console.log('SimplePinLock - Biometric PIN verification result:', isValid);
      
      if (isValid) {
        // Biometric PIN verification successful - unlock the app
        console.log('SimplePinLock - Biometric PIN correct, calling unlockApp()');
        
        // Set flag to prevent re-render
        setIsUnlocked(true);
        
        // Call unlockApp (same as PIN unlock) to ensure consistent behavior
        unlockApp();
        console.log('SimplePinLock - unlockApp() called successfully from biometric verification');
        
        // Navigate to the last active page or fallback to index
        const lastPage = getLastActivePage();
        const targetPage = lastPage || '/(tabs)/index';
        
        console.log('SimplePinLock - Biometric unlock successful, navigating to:', targetPage);
        
        // Use the same delay as PIN unlock for consistency
        setTimeout(() => {
          router.replace(targetPage);
        }, 500);
      } else {
        Alert.alert('Authentication Failed', 'Biometric authentication failed. Please try again or use your PIN.');
      }
    } catch (error) {
      console.error('SimplePinLock - Biometric unlock error:', error);
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
    }
  };

  const getUserName = () => {
    // Use the same method as the main index page
    const firstName = session?.user?.user_metadata?.first_name || 'User';
    
    console.log('SimplePinLock - Using first_name from metadata:', { 
      first_name: session?.user?.user_metadata?.first_name,
      result: firstName 
    });
    
    return firstName;
  };

  const styles = getStyles(isDark, colors);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/Planmoni_welcome_back_logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back,</Text>
          <Text style={styles.userName}>{getUserName()}</Text>
          <Text style={styles.welcomeSubtitle}>Enter your PIN to continue</Text>
        </View>

        {/* PIN Display */}
        <View style={styles.pinSection}>
          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < pin.length ? styles.pinDotFilled : styles.pinDotEmpty
                ]}
              />
            ))}
          </View>
          
          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="close-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          {/* Loading Message */}
          {isVerifying ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Verifying PIN...</Text>
            </View>
          ) : null}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'del']
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key, keyIndex) => {
                if (key === '') {
                  return <View key={keyIndex} style={styles.emptyKey} />;
                }
                
                if (key === 'del') {
                  return (
                    <TouchableOpacity
                      key={keyIndex}
                      style={styles.keyButton}
                      onPress={handleDelete}
                      disabled={pin.length === 0}
                    >
                      <Ionicons 
                        name="backspace-outline" 
                        size={24} 
                        color={pin.length === 0 ? colors.textTertiary : colors.text} 
                      />
                    </TouchableOpacity>
                  );
                }
                
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={styles.keyButton}
                    onPress={() => handleDigitPress(key)}
                    disabled={isVerifying || pin.length >= 4}
                  >
                    <Text style={[
                      styles.keyText,
                      { color: isVerifying || pin.length >= 4 ? colors.textTertiary : colors.text }
                    ]}>
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Forgot Pin Button */}
        <TouchableOpacity 
          style={styles.forgotPinButton}
          onPress={() => {
            // TODO: Implement forgot PIN functionality
            // This could redirect to a support page or show contact information
            console.log('Forgot PIN pressed');
          }}
          disabled={isVerifying}
        >
          <Text style={styles.forgotPinButtonText}>Forgot Pin?</Text>
        </TouchableOpacity>

        {/* Biometric Button */}
        {biometricEnabled && (
          <TouchableOpacity 
            style={styles.biometricButton}
            onPress={handleBiometricUnlock}
            disabled={isVerifying}
          >
            <Ionicons name={getBiometricIcon()} size={24} color={colors.primary} />
            <Text style={styles.biometricButtonText}>{getBiometricText()}</Text>
          </TouchableOpacity>
        )}

        {/* Debug button - remove in production */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              console.log('SimplePinLock - Test unlock button pressed');
              console.log('SimplePinLock - Current isAppLocked:', isAppLocked);
              console.log('SimplePinLock - isUnlocked:', isUnlocked);
              
              // Set flag to prevent re-render
              setIsUnlocked(true);
              
              // Use the same function as PIN unlock for consistency
              unlockApp();
              console.log('SimplePinLock - unlockApp() called from test button');
            }}
          >
            <Text style={styles.debugButtonText}>Debug: Unlock App</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 70,
    paddingBottom: 100,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    // marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 120,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  pinDotEmpty: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginLeft: 8,
  },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  loadingText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  keypad: {
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  keyButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  emptyKey: {
    width: 70,
    height: 70,
  },
  forgotPinButton: {
    alignSelf: 'center',
    marginTop: 20,
  },
  forgotPinButtonText: {
    fontSize: 16,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20,
  },
  biometricButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
  },
  debugButton: {
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: colors.primary + '15',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  debugButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
}); 