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

const MAX_BIOMETRIC_RETRIES = 3;

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
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
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
  }, [biometricEnabled, hasAppLockPin]);

  const checkBiometrics = async () => {
    try {
      const support = await checkBiometricSupport();
      const canUseBiometric = biometricEnabled && support.isAvailable && support.isEnrolled;
      setBiometricSupport(support);
      setShowBiometricOption(canUseBiometric);
      setShowPinEntry(!canUseBiometric);
    } catch (error) {
      console.error('Error checking biometric support:', error);
      setShowBiometricOption(false);
      setShowPinEntry(true);
    }
  };

  useEffect(() => {
    if (!showBiometricOption || showPinEntry || isVerifying || isUnlocked) return;
    if (biometricAttempts >= MAX_BIOMETRIC_RETRIES) return;

    const timer = setTimeout(() => {
      handleBiometricUnlock(true);
    }, biometricAttempts === 0 ? 600 : 300);

    return () => clearTimeout(timer);
  }, [showBiometricOption, showPinEntry, biometricAttempts, isVerifying, isUnlocked]);

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

  const handleBiometricUnlock = async (isAutoRetry: boolean = false) => {
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
        const nextAttempt = biometricAttempts + 1;
        setBiometricAttempts(nextAttempt);

        if (nextAttempt >= MAX_BIOMETRIC_RETRIES) {
          setShowPinEntry(true);
          setError('Biometric verification failed. Enter your PIN to continue.');
        } else if (!isAutoRetry) {
          const left = MAX_BIOMETRIC_RETRIES - nextAttempt;
          setError(`Biometric failed. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
        }
      }
    } catch (error) {
      console.error('AppLockScreen - Biometric unlock error:', error);
      haptics.error();
      const nextAttempt = biometricAttempts + 1;
      setBiometricAttempts(nextAttempt);

      if (nextAttempt >= MAX_BIOMETRIC_RETRIES) {
        setShowPinEntry(true);
        setError('Biometric verification failed. Enter your PIN to continue.');
      } else if (!isAutoRetry) {
        const left = MAX_BIOMETRIC_RETRIES - nextAttempt;
        setError(`Biometric failed. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
      }
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
  const biometricLabel = biometricSupport
    ? BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes)
    : 'biometrics';

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

            <Text style={styles.instruction}>
              {showPinEntry ? 'Enter your PIN to continue' : `Authenticating with ${biometricLabel}...`}
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {showPinEntry ? (
              <>
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
              </>
            ) : (
              <View style={styles.biometricFirstContainer}>
                <View style={styles.biometricBadge}>
                  <Text style={styles.biometricBadgeText}>
                    {biometricAttempts > 0
                      ? `Retry ${Math.min(biometricAttempts + 1, MAX_BIOMETRIC_RETRIES)} of ${MAX_BIOMETRIC_RETRIES}`
                      : 'Attempt 1 of 3'}
                  </Text>
                </View>
                <Pressable
                  style={styles.biometricPrimaryButton}
                  onPress={() => handleBiometricUnlock(false)}
                  disabled={isVerifying}
                >
                  <Text style={styles.biometricPrimaryButtonText}>
                    {isVerifying ? `Checking ${biometricLabel}...` : `Try ${biometricLabel} again`}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Buttons Row - Biometric and Forgot PIN in same row */}
            <View style={[styles.buttonsRow, (!showBiometricOption || !showPinEntry) && styles.buttonsRowSingle]}>
              {showBiometricOption && showPinEntry && (
                <Pressable 
                  style={styles.biometricButton}
                  onPress={() => handleBiometricUnlock(false)}
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
                  (!showBiometricOption || !showPinEntry) && styles.forgotPinButtonSingle,
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
  biometricFirstContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  biometricBadge: {
    backgroundColor: colors.primary + '14',
    borderColor: colors.primary + '35',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  biometricBadgeText: {
    color: colors.primary,
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
  },
  biometricPrimaryButton: {
    width: '100%',
    paddingVertical: isSmallScreen ? 12 : 14,
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricPrimaryButtonText: {
    color: colors.primary,
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '600',
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
