import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform, Animated, useWindowDimensions, Image, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import { BiometricService } from '@/lib/biometrics';
import { useHaptics } from '@/hooks/useHaptics';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';

export default function AppLockScreen() {
  const { colors, isDark } = useTheme();
  const { hasAppLockPin, verifyAppLockPin, biometricEnabled, checkBiometricSupport } = usePin();
  const { unlockApp, getLastActivePage, setPinResetMode } = useAppLock();
  const { session } = useAuth();
  const router = useRouter();
  const haptics = useHaptics();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Determine if we're on a small screen - use ref to prevent recalculation on window changes
  const initialHeight = useRef(height);
  const isSmallScreen = initialHeight.current < 700;
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Shake animation for incorrect PIN
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Aggressively dismiss keyboard on iOS when component mounts/updates
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const dismissKeyboard = () => {
        Keyboard.dismiss();
      };
      
      // Immediate dismissal
      dismissKeyboard();
      
      // Multiple dismissals to catch any delayed triggers
      const timers = [0, 50, 100, 200, 500].map(delay => 
        setTimeout(dismissKeyboard, delay)
      );
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, []);

  // Shake animation function
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };


  useEffect(() => {
    checkBiometrics();
    
    // Auto-trigger biometric if enabled, but only after a delay
    if (biometricEnabled && hasAppLockPin) {
      const timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 2000);
      
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
        setPin('');
        
        // Trigger shake animation
        triggerShake();
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
    // Get the first name from the user's metadata
    const firstName = session?.user?.user_metadata?.first_name || 'User';
    
    console.log('AppLockScreen - Using first_name from metadata:', { 
      first_name: session?.user?.user_metadata?.first_name,
      result: firstName 
    });
    
    return firstName;
  };

  const getBiometricText = () => {
    if (!biometricSupport) return 'Unlock with biometrics';
    
    const label = BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes);
    return `Unlock with ${label}`;
  };

  const styles = getStyles(isDark, colors, isSmallScreen, showBiometricOption, insets);

  return (
    <View 
      style={styles.container}
      collapsable={false}
      removeClippedSubviews={false}
      {...(Platform.OS === 'ios' && {
        accessible: false
      })}
    >
      <View 
        style={styles.overlay}
        collapsable={false}
        removeClippedSubviews={false}
        {...(Platform.OS === 'ios' && {
          accessible: false
        })}
      >
        <View 
          style={styles.safeArea}
        >
          <View 
            style={styles.content}
            collapsable={false}
            removeClippedSubviews={false}
            {...(Platform.OS === 'ios' && {
              accessible: false
            })}
          >
            <View style={styles.header}>
              <Image 
                source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
                style={styles.logo}
                resizeMode="contain"
              />
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

            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <PinDisplay 
                length={4}
                value={pin}
              />
            </Animated.View>

            <View 
              collapsable={false}
              removeClippedSubviews={false}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <PinKeypad 
                onKeyPress={isVerifying ? () => {} : handlePinChange}
                onDelete={isVerifying ? () => {} : handleDelete}
                disabled={isVerifying}
              />
            </View>

            {/* Buttons Row - Biometric and Forgot PIN in same row */}
            <View style={[styles.buttonsRow, !showBiometricOption && styles.buttonsRowSingle]}>
              {showBiometricOption && (
                <Pressable 
                  style={styles.biometricButton}
                  onPress={handleBiometricUnlock}
                  disabled={isVerifying}
                  {...(Platform.OS === 'ios' && {
                    // Prevent keyboard trigger on iOS
                    accessible: true,
                    accessibilityRole: 'button'
                  })}
                >
                  <Text style={styles.biometricText}>{getBiometricText()}</Text>
                </Pressable>
              )}

              {/* Forgot Pin Button */}
              <Pressable 
                style={({ pressed }) => [
                  styles.forgotPinButton,
                  !showBiometricOption && styles.forgotPinButtonSingle,
                  pressed && styles.forgotPinButtonPressed,
                  isVerifying && styles.forgotPinButtonDisabled
                ]}
                onPress={() => {
                  haptics.lightImpact();
                  // Enable pin reset mode to hide the lock screen
                  setPinResetMode(true);
                  // Navigate to forgot PIN flow
                  router.push('/forgot-pin');
                }}
                disabled={isVerifying}
                {...(Platform.OS === 'ios' && {
                  // Prevent keyboard trigger on iOS
                  accessible: true,
                  accessibilityRole: 'button'
                })}
              >
                <Text style={[
                  styles.forgotPinButtonText,
                  isVerifying && styles.forgotPinButtonTextDisabled
                ]}>
                  Forgot Pin?
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any, isSmallScreen: boolean, showBiometricOption: boolean, insets: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 1, // Start from very top to prevent any safe area padding
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '110%', // Extend beyond screen to ensure full coverage
    marginTop: 0,
    paddingTop: 0,
    zIndex: 10000,
    elevation: Platform.OS === 'android' ? 10000 : undefined,
    // Prevent keyboard indicator on iOS
    ...(Platform.OS === 'ios' && {
      // Ensure no keyboard-related UI can appear
      backgroundColor: colors.background,
      // Prevent any safe area insets from creating visible boxes
      overflow: 'hidden',
    }),
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: isSmallScreen ? Platform.OS === 'ios' ? 10 : 10 : Platform.OS === 'ios' ? 1 : 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    minHeight: '100%',
    width: '100%',
    // Prevent layout changes on iOS
    ...(Platform.OS === 'ios' && {
      flexShrink: 0,
      flexGrow: 1,
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: isSmallScreen ? 20 : 24,
  },
  logo: {
    width: isSmallScreen ? 120 : 150,
    height: isSmallScreen ? 40 : 50,
    marginBottom: isSmallScreen ? 16 : 20,
  },
  greeting: {
    fontSize: isSmallScreen ? 15 : 16,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: isSmallScreen ? 18 : 22,
    fontWeight: '600',
    color: colors.text,
  },
  lockIcon: {
    marginBottom: isSmallScreen ? 16 : 20,
  },
  lockIconText: {
    fontSize: isSmallScreen ? 32 : 36,
  },
  instruction: {
    fontSize: isSmallScreen ? 13 : 15,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 16 : 20,
    textAlign: 'center',
  },
  errorContainer: {
    marginBottom: isSmallScreen ? 12 : 16,
    marginTop: isSmallScreen ? -8 : -4,
  },
  errorText: {
    color: colors.error,
    fontSize: isSmallScreen ? 12 : 14,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: isSmallScreen ? 12 : 16,
    gap: isSmallScreen ? 10 : 12,
    width: '100%',
    paddingHorizontal: 0,
  },
  buttonsRowSingle: {
    justifyContent: 'center',
  },
  biometricButton: {
    flex: 1,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    borderRadius: 9999,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
    maxWidth: '48%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: isSmallScreen ? 40 : 44,
  },
  biometricText: {
    color: colors.primary,
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 11 : 13,
    includeFontPadding: false,
  },
  forgotPinButton: {
    flex: 1,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    borderRadius: 9999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '48%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: isSmallScreen ? 40 : 44,
  },
  forgotPinButtonSingle: {
    flex: 0,
    minWidth: isSmallScreen ? 140 : 160,
  },
  forgotPinButtonPressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.primary,
    transform: [{ scale: 0.98 }],
  },
  forgotPinButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.backgroundTertiary,
  },
  forgotPinButtonText: {
    color: colors.textSecondary,
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 12 : 14,
    includeFontPadding: false,
  },
  forgotPinButtonTextDisabled: {
    color: colors.textTertiary,
  },
});
