import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { X, Fingerprint } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { BiometricService } from '@/lib/biometrics';
import { useRouter } from 'expo-router';

interface PinVerificationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  amount?: string;
  description?: string;
  customVerifyPin?: (pin: string) => Promise<boolean>;
  biometricType?: 'app' | 'payout' | 'emergency';
}

export default function PinVerificationModal({
  isVisible,
  onClose,
  onSuccess,
  title = "PIN Verification",
  amount,
  description = "Enter your PIN to continue",
  customVerifyPin,
  biometricType = 'app',
}: PinVerificationModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { verifyBiometric, biometricEnabled, payoutBiometricEnabled, emergencyBiometricEnabled, checkBiometricSupport, verifyAppLockPin } = usePin();
  const haptics = useHaptics();
  const router = useRouter();
  const { showError } = useToast();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  // Get the correct biometric setting based on type
  const getBiometricEnabled = () => {
    switch (biometricType) {
      case 'payout':
        return payoutBiometricEnabled;
      case 'emergency':
        return emergencyBiometricEnabled;
      case 'app':
      default:
        return biometricEnabled;
    }
  };

  const isBiometricEnabled = getBiometricEnabled();

  useEffect(() => {
    if (isVisible) {
      // Reset state
      setPin('');
      setError(null);
      setIsVerifying(false);
      
      // Check biometric support
      checkBiometrics();
      
      // Animate modal in
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        })
      ]).start();
      
      // Auto-trigger biometric if enabled and available
      // For payout/emergency, we can trigger even without customVerifyPin (will fall back to app lock PIN)
      // For app, we need customVerifyPin to ensure PIN exists
      const shouldAutoTrigger = isBiometricEnabled && (
        biometricType === 'payout' || 
        biometricType === 'emergency' || 
        (biometricType === 'app' && customVerifyPin)
      );
      
      if (shouldAutoTrigger) {
        setTimeout(() => {
          handleBiometricAuth();
        }, 500);
      }
    }
  }, [isVisible, isBiometricEnabled, customVerifyPin]);

  const checkBiometrics = async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
      setShowBiometricOption(isBiometricEnabled && support.isAvailable && support.isEnrolled);
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  };

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

  const handlePinChange = (digit: string) => {
    if (pin.length < 4 && !isVerifying) {
      haptics.selection();
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      
      // Auto-verify when PIN is complete
      if (newPin.length === 4) {
        setTimeout(() => {
          handlePinVerification(newPin);
        }, 300);
      }
    }
  };

  const handlePinDelete = () => {
    if (!isVerifying) {
      haptics.lightImpact();
      setPin(prev => prev.slice(0, -1));
      setError(null);
    }
  };

  const handlePinVerification = async (pinToVerify?: string) => {
    const currentPin = pinToVerify || pin;
    
    if (currentPin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      haptics.error();
      return;
    }

    setIsVerifying(true);
    
    try {
      const isValid = await (customVerifyPin ? customVerifyPin(currentPin) : verifyAppLockPin(currentPin));
      
      if (isValid) {
        haptics.success();
        handleClose();
        onSuccess();
      } else {
        haptics.error();
        setError('Incorrect PIN. Please try again.');
        setPin('');
        
        // Show toast notification
        showError('Incorrect PIN. Please try again.');
        
        // Trigger shake animation
        triggerShake();
      }
    } catch (error) {
      haptics.error();
      setError('Failed to verify PIN. Please try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (!isBiometricEnabled || !biometricSupport?.isAvailable || Platform.OS === 'web') {
      console.log('PinVerificationModal - Biometric auth skipped:', {
        isBiometricEnabled,
        isAvailable: biometricSupport?.isAvailable,
        isEnrolled: biometricSupport?.isEnrolled,
        platform: Platform.OS
      });
      return;
    }

    try {
      setIsVerifying(true);
      haptics.mediumImpact();
      
      console.log('PinVerificationModal - Attempting biometric auth for type:', biometricType);
      
      // Use BiometricService directly to ensure it works regardless of app biometric setting
      const result = await BiometricService.authenticateWithBiometrics(
        `Use ${getBiometricLabel()} to authorize this transaction`
      );

      console.log('PinVerificationModal - Biometric auth result:', result);

      if (result.success) {
        haptics.success();
        handleClose();
        onSuccess();
      } else {
        haptics.error();
        setError(result.error || 'Biometric authentication failed');
        console.log('PinVerificationModal - Biometric auth failed:', result.error);
      }
    } catch (error) {
      haptics.error();
      const errorMessage = error instanceof Error ? error.message : 'Biometric authentication failed';
      setError(errorMessage);
      console.error('PinVerificationModal - Biometric auth error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getBiometricLabel = () => {
    if (!biometricSupport?.supportedTypes) return 'Biometric';
    
    return Platform.OS !== 'web'
      ? BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes)
      : 'Biometric';
  };

  const handleClose = () => {
    // Animate out before closing
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      haptics.lightImpact();
      onClose();
    });
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.overlay,
        { opacity: overlayOpacity }
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.overlayPressable} onPress={handleClose} />
      
      <Animated.View 
        style={[
          styles.modal,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable 
            style={styles.closeButton} 
            onPress={handleClose}
            disabled={isVerifying}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        
        {amount && (
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>{amount}</Text>
          </View>
        )}
        
        <View style={styles.content}>
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
          
          <PinKeypad 
            onKeyPress={isVerifying ? () => {} : handlePinChange}
            onDelete={isVerifying ? () => {} : handlePinDelete}
            disabled={isVerifying}
          />
          
          <View style={styles.options}>
            <Pressable 
              style={styles.forgotPin}
              onPress={() => {
                haptics.selection();
                onClose(); // Close the modal first
                router.push('/forgot-pin'); // Navigate to PIN recovery flow
              }}
            >
              <Text style={styles.forgotPinText}>Forgot PIN</Text>
            </Pressable>
            
            {showBiometricOption && (
              <Pressable 
                style={styles.biometricOption}
                onPress={handleBiometricAuth}
                disabled={isVerifying}
              >
                <Text style={styles.biometricText}>Use {getBiometricLabel()}</Text>
              </Pressable>
            )}
          </View>
        </View>
        
        <View style={styles.securityNotice}>
          <View style={styles.securityIcon}>
            <Text style={styles.securityCheckmark}>✓</Text>
          </View>
          <Text style={styles.securityText}>Secure input mode is active</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    paddingBottom: 40,
    // Add shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 16 : 24,
  },
  amount: {
    fontSize: isSmallScreen ? 24 : 32,
    fontWeight: '700',
    color: colors.text, // Purple color like in the screenshots
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: isSmallScreen ? 16 : 24,
    paddingHorizontal: isSmallScreen ? 16 : 32,
  },
  forgotPin: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  forgotPinText: {
    fontSize: 14,
    color: colors.text, 
    fontWeight: '500',
  },
  biometricOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  biometricText: {
    fontSize: 14,
    color: colors.text, 
    fontWeight: '500',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: isSmallScreen ? 16 : 24,
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  securityIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  securityCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  securityText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
});