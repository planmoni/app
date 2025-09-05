import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAutoLogout } from '@/contexts/AutoLogoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePin } from '@/contexts/PinContext';
import { useRouter } from 'expo-router';
import { BiometricService } from '@/lib/biometrics';
import SimplePinLock from './SimplePinLock';

export default function BiometricsLock() {
  const { colors, isDark } = useTheme();
  const { isAppLocked, unlockApp, getLastActivePage } = useAutoLogout();
  const { session } = useAuth();
  const { biometricEnabled, verifyAppLockPinWithBiometrics } = usePin();
  const router = useRouter();
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);

  const loadBiometricSupport = async () => {
    try {
      const support = await BiometricService.checkBiometricSupport();
      setBiometricSupport(support);
    } catch (error) {
      console.error('BiometricsLock - Error loading biometric support:', error);
    }
  };

  // Load biometric support on mount
  useEffect(() => {
    loadBiometricSupport();
  }, []);

  // Don't render if not locked or if we've already unlocked
  if (!isAppLocked || isUnlocked) {
    return null;
  }

  // Show PIN fallback if requested or if biometrics are not available
  if (showPinFallback || !biometricEnabled) {
    return <SimplePinLock />;
  }

  const getBiometricText = () => {
    if (!biometricSupport) return 'Unlock with Biometrics';
    
    const label = BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes);
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

  const handleBiometricUnlock = async () => {
    if (!biometricEnabled) {
      Alert.alert('Biometrics Disabled', 'Please enable biometric authentication in Security Center to use this feature.');
      return;
    }
    
    try {
      setIsVerifying(true);
      
      // Use the new biometric PIN verification function
      const isValid = await verifyAppLockPinWithBiometrics();
      
      if (isValid) {
        // Biometric PIN verification successful - unlock the app
        // Set local unlock state FIRST
        setIsUnlocked(true);
        
        // Then unlock the app
        unlockApp();
        
        // Navigate to the last active page or fallback to index
        const lastPage = getLastActivePage();
        const targetPage = lastPage || '/(tabs)/index';
        
        // Navigate after a short delay to ensure state updates are processed
        setTimeout(() => {
          router.replace(targetPage);
        }, 100);
      } else {
        Alert.alert('Authentication Failed', 'Biometric authentication failed. Please try again or use your PIN.');
      }
    } catch (error) {
      console.error('BiometricsLock - Biometric unlock error:', error);
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const getUserName = () => {
    const firstName = session?.user?.user_metadata?.first_name || 'User';
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
          <Text style={styles.welcomeSubtitle}>Use biometrics to unlock</Text>
        </View>

        {/* Status Messages */}
        <View style={styles.statusSection}>
          {isVerifying ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Verifying biometrics...</Text>
            </View>
          ) : null}
          
          {!biometricEnabled && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning-outline" size={16} color={colors.warning || colors.primary} />
              <Text style={styles.warningText}>Biometrics not enabled</Text>
            </View>
          )}
        </View>

        {/* Biometric Button */}
        <TouchableOpacity 
          style={[
            styles.biometricButton,
            (!biometricEnabled || isVerifying) && styles.biometricButtonDisabled
          ]}
          onPress={handleBiometricUnlock}
          disabled={!biometricEnabled || isVerifying}
        >
          <Ionicons 
            name={getBiometricIcon()} 
            size={32} 
            color={(!biometricEnabled || isVerifying) ? colors.textTertiary : colors.primary} 
          />
          <Text style={[
            styles.biometricButtonText,
            (!biometricEnabled || isVerifying) && styles.biometricButtonTextDisabled
          ]}>
            {getBiometricText()}
          </Text>
        </TouchableOpacity>

        {/* Fallback to PIN Button */}
        <TouchableOpacity 
          style={styles.fallbackButton}
          onPress={() => {
            // Show PIN lock instead of biometric lock
            setShowPinFallback(true);
          }}
          disabled={isVerifying}
        >
          <Text style={styles.fallbackButtonText}>Use PIN Instead</Text>
        </TouchableOpacity>
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
    paddingTop: 90,
    paddingBottom: 50,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 120,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
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
  statusSection: {
    alignItems: 'center',
    marginBottom: 40,
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: (colors.warning || colors.primary) + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: (colors.warning || colors.primary) + '30',
  },
  warningText: {
    fontSize: 14,
    color: colors.warning || colors.primary,
    marginLeft: 8,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 20,
    paddingHorizontal: 32,
    width: '70%',
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 40,
  },
  biometricButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  biometricButtonText: {
    fontSize: 18,
    color: colors.primary,
    marginLeft: 12,
    fontWeight: '600',
  },
  biometricButtonTextDisabled: {
    color: colors.textTertiary,
  },
  fallbackButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  fallbackButtonText: {
    fontSize: 16,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
}); 