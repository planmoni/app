import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { saveItem, getItem, deleteItem, BIOMETRIC_ENABLED_KEY } from '@/lib/secure-storage';
import { createUserScopedStorage } from '@/lib/user-scoped-storage';
import { BiometricService } from '@/lib/biometrics';
import { useAuth } from './AuthContext';

// Storage keys
const APP_LOCK_PIN_KEY = 'app_lock_pin';
const PAYOUT_PIN_KEY = 'payout_pin';
const EMERGENCY_PIN_KEY = 'emergency_pin';
const PAYOUT_BIOMETRIC_KEY = 'payout_biometric_enabled';
const EMERGENCY_BIOMETRIC_KEY = 'emergency_biometric_enabled';

interface PinContextType {
  // App Lock PIN
  hasAppLockPin: boolean;
  setupAppLockPin: (pin: string) => Promise<boolean>;
  verifyAppLockPin: (pin: string) => Promise<boolean>;
  verifyAppLockPinWithBiometrics: () => Promise<boolean>;
  updateAppLockPin: (pin: string) => Promise<boolean>;
  removeAppLockPin: () => Promise<boolean>;
  
  // Payout PIN
  hasPayoutPin: boolean;
  setupPayoutPin: (pin: string) => Promise<boolean>;
  verifyPayoutPin: (pin: string) => Promise<boolean>;
  updatePayoutPin: (pin: string) => Promise<boolean>;
  removePayoutPin: () => Promise<boolean>;
  
  // Emergency Withdrawal PIN
  hasEmergencyPin: boolean;
  setupEmergencyPin: (pin: string) => Promise<boolean>;
  verifyEmergencyPin: (pin: string) => Promise<boolean>;
  updateEmergencyPin: (pin: string) => Promise<boolean>;
  removeEmergencyPin: () => Promise<boolean>;
  
  // Biometric Settings
  biometricEnabled: boolean;
  payoutBiometricEnabled: boolean;
  emergencyBiometricEnabled: boolean;
  enableBiometric: (type: 'app' | 'payout' | 'emergency') => Promise<boolean>;
  disableBiometric: (type: 'app' | 'payout' | 'emergency') => Promise<boolean>;
  verifyBiometric: (reason?: string) => Promise<boolean>;
  
  // General
  isLoading: boolean;
  checkBiometricSupport: () => Promise<any>;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

export const usePin = () => {
  const context = useContext(PinContext);
  if (!context) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
};

export const PinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hasAppLockPin, setHasAppLockPin] = useState(false);
  const [hasPayoutPin, setHasPayoutPin] = useState(false);
  const [hasEmergencyPin, setHasEmergencyPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [payoutBiometricEnabled, setPayoutBiometricEnabled] = useState(false);
  const [emergencyBiometricEnabled, setEmergencyBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get user-scoped storage instance
  const getUserStorage = () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    return createUserScopedStorage(user.id);
  };

  // Load PIN states when user changes
  useEffect(() => {
    const loadPinStates = async () => {
      if (!user?.id) {
        // User signed out, reset all states
        setHasAppLockPin(false);
        setHasPayoutPin(false);
        setHasEmergencyPin(false);
        setBiometricEnabled(false);
        setPayoutBiometricEnabled(false);
        setEmergencyBiometricEnabled(false);
        setIsLoading(false);
        return;
      }

      try {
        const userStorage = getUserStorage();
        
        // Check app lock PIN (user-scoped)
        const appLockPin = await userStorage.getItem(APP_LOCK_PIN_KEY);
        setHasAppLockPin(!!appLockPin);
        
        // Check biometric settings (user-scoped)
        const biometricEnabledValue = await userStorage.getItem(BIOMETRIC_ENABLED_KEY);
        setBiometricEnabled(biometricEnabledValue === 'true');
        
        // Check payout PIN (global - can be user-scoped later if needed)
        const payoutPin = await getItem(PAYOUT_PIN_KEY);
        setHasPayoutPin(!!payoutPin);
        
        const payoutBiometricValue = await getItem(PAYOUT_BIOMETRIC_KEY);
        setPayoutBiometricEnabled(payoutBiometricValue === 'true');
        
        // Check emergency PIN (global - can be user-scoped later if needed)
        const emergencyPin = await getItem(EMERGENCY_PIN_KEY);
        setHasEmergencyPin(!!emergencyPin);
        
        const emergencyBiometricValue = await getItem(EMERGENCY_BIOMETRIC_KEY);
        setEmergencyBiometricEnabled(emergencyBiometricValue === 'true');
        
      } catch (error) {
        console.error('Failed to load PIN states:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPinStates();
  }, [user?.id]);

  // App Lock PIN methods (user-scoped)
  const setupAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      const userStorage = getUserStorage();
      await userStorage.setItem(APP_LOCK_PIN_KEY, pin);
      setHasAppLockPin(true);
      return true;
    } catch (error) {
      console.error('Failed to setup app lock PIN:', error);
      return false;
    }
  };

  const verifyAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      const userStorage = getUserStorage();
      const storedPin = await userStorage.getItem(APP_LOCK_PIN_KEY);
      return storedPin === pin;
    } catch (error) {
      console.error('Failed to verify app lock PIN:', error);
      return false;
    }
  };

  const verifyAppLockPinWithBiometrics = async (): Promise<boolean> => {
    try {
      if (!biometricEnabled) {
        return false;
      }
      
      const result = await BiometricService.authenticate('Unlock with biometrics');
      return result.success;
    } catch (error) {
      console.error('Failed to verify app lock PIN with biometrics:', error);
      return false;
    }
  };

  const updateAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      const userStorage = getUserStorage();
      await userStorage.setItem(APP_LOCK_PIN_KEY, pin);
      return true;
    } catch (error) {
      console.error('Failed to update app lock PIN:', error);
      return false;
    }
  };

  const removeAppLockPin = async (): Promise<boolean> => {
    try {
      const userStorage = getUserStorage();
      await userStorage.deleteItem(APP_LOCK_PIN_KEY);
      setHasAppLockPin(false);
      return true;
    } catch (error) {
      console.error('Failed to remove app lock PIN:', error);
      return false;
    }
  };

  // Payout PIN methods (global)
  const setupPayoutPin = async (pin: string): Promise<boolean> => {
    try {
      await saveItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      return true;
    } catch (error) {
      console.error('Failed to setup payout PIN:', error);
      return false;
    }
  };

  const verifyPayoutPin = async (pin: string): Promise<boolean> => {
    try {
      const storedPayoutPin = await getItem(PAYOUT_PIN_KEY);
      
      // If payout PIN is set, use it
      if (storedPayoutPin) {
        return storedPayoutPin === pin;
      }
      
      // Fall back to app lock PIN if no payout PIN is set
      const storedAppLockPin = await getItem(APP_LOCK_PIN_KEY);
      if (storedAppLockPin) {
        return storedAppLockPin === pin;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to verify payout PIN:', error);
      return false;
    }
  };

  const updatePayoutPin = async (pin: string): Promise<boolean> => {
    try {
      await saveItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      return true;
    } catch (error) {
      console.error('Failed to update payout PIN:', error);
      return false;
    }
  };

  const removePayoutPin = async (): Promise<boolean> => {
    try {
      await deleteItem(PAYOUT_PIN_KEY);
      setHasPayoutPin(false);
      return true;
    } catch (error) {
      console.error('Failed to remove payout PIN:', error);
      return false;
    }
  };

  // Emergency Withdrawal PIN methods (global)
  const setupEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      await saveItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      return true;
    } catch (error) {
      console.error('Failed to setup emergency PIN:', error);
      return false;
    }
  };

  const verifyEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      const storedEmergencyPin = await getItem(EMERGENCY_PIN_KEY);
      
      // If emergency PIN is set, use it
      if (storedEmergencyPin) {
        return storedEmergencyPin === pin;
      }
      
      // Fall back to app lock PIN if no emergency PIN is set
      const storedAppLockPin = await getItem(APP_LOCK_PIN_KEY);
      if (storedAppLockPin) {
        return storedAppLockPin === pin;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to verify emergency PIN:', error);
      return false;
    }
  };

  const updateEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      await saveItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      return true;
    } catch (error) {
      console.error('Failed to update emergency PIN:', error);
      return false;
    }
  };

  const removeEmergencyPin = async (): Promise<boolean> => {
    try {
      await deleteItem(EMERGENCY_PIN_KEY);
      setHasEmergencyPin(false);
      return true;
    } catch (error) {
      console.error('Failed to remove emergency PIN:', error);
      return false;
    }
  };

  // Biometric Settings methods (user-scoped)
  const enableBiometric = async (type: 'app' | 'payout' | 'emergency'): Promise<boolean> => {
    try {
      console.log(`PinContext - enableBiometric called for type: ${type}`);
      
      if (Platform.OS === 'web') {
        console.log('PinContext - Web platform detected, biometric not available');
        return false;
      }

      const support = await BiometricService.checkBiometricSupport();
      console.log('PinContext - Biometric support check result:', support);
      
      if (!support.isAvailable || !support.isEnrolled) {
        console.log('PinContext - Biometrics not available or not enrolled');
        return false;
      }

      // Test biometric authentication
      console.log(`PinContext - Testing biometric authentication for ${type}`);
      const result = await BiometricService.authenticateWithBiometrics(
        `Enable ${type} biometric authentication for Planmoni?`
      );
      
      console.log(`PinContext - Biometric authentication result:`, result);

      if (result.success) {
        console.log(`PinContext - Biometric authentication successful, saving settings for ${type}`);
        
        const userStorage = getUserStorage();
        if (type === 'app') {
          await userStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
          setBiometricEnabled(true);
          console.log('PinContext - App biometric enabled and saved');
        } else if (type === 'payout') {
          await userStorage.setItem(PAYOUT_BIOMETRIC_KEY, 'true');
          setPayoutBiometricEnabled(true);
          console.log('PinContext - Payout biometric enabled and saved');
        } else if (type === 'emergency') {
          await userStorage.setItem(EMERGENCY_BIOMETRIC_KEY, 'true');
          setEmergencyBiometricEnabled(true);
          console.log('PinContext - Emergency biometric enabled and saved');
        }
        
        // Verify the save operation
        const savedValue = await userStorage.getItem(type === 'app' ? BIOMETRIC_ENABLED_KEY : 
                                       type === 'payout' ? PAYOUT_BIOMETRIC_KEY : 
                                       EMERGENCY_BIOMETRIC_KEY);
        console.log(`PinContext - Verification of saved value for ${type}:`, savedValue);
        
        return true;
      } else {
        console.log(`PinContext - Biometric authentication failed for ${type}:`, result.error);
        return false;
      }
    } catch (error) {
      console.error(`PinContext - Error enabling biometric for ${type}:`, error);
      return false;
    }
  };

  const disableBiometric = async (type: 'app' | 'payout' | 'emergency'): Promise<boolean> => {
    try {
      console.log(`PinContext - disableBiometric called for type: ${type}`);
      
      if (type === 'app') {
        const userStorage = getUserStorage();
        await userStorage.deleteItem(BIOMETRIC_ENABLED_KEY);
        setBiometricEnabled(false);
        console.log('PinContext - App biometric disabled and removed from storage');
      } else if (type === 'payout') {
        const userStorage = getUserStorage();
        await userStorage.deleteItem(PAYOUT_BIOMETRIC_KEY);
        setPayoutBiometricEnabled(false);
        console.log('PinContext - Payout biometric disabled and removed from storage');
      } else if (type === 'emergency') {
        const userStorage = getUserStorage();
        await userStorage.deleteItem(EMERGENCY_BIOMETRIC_KEY);
        setEmergencyBiometricEnabled(false);
        console.log('PinContext - Emergency biometric disabled and removed from storage');
      }
      
      // Verify the delete operation
      const savedValue = await getItem(type === 'app' ? BIOMETRIC_ENABLED_KEY : 
                                     type === 'payout' ? PAYOUT_BIOMETRIC_KEY : 
                                     EMERGENCY_BIOMETRIC_KEY);
      console.log(`PinContext - Verification of deleted value for ${type}:`, savedValue);
      
      return true;
    } catch (error) {
      console.error(`PinContext - Error disabling biometric for ${type}:`, error);
      return false;
    }
  };

  const verifyBiometric = async (reason = "Verify your identity"): Promise<boolean> => {
    try {
      if (Platform.OS === 'web' || !biometricEnabled) {
        return false;
      }

      const result = await BiometricService.authenticateWithBiometrics(reason);
      return result.success;
    } catch (error) {
      console.error('Error verifying biometric:', error);
      return false;
    }
  };

  const checkBiometricSupport = async () => {
    try {
      return await BiometricService.checkBiometricSupport();
    } catch (error) {
      console.error('Failed to check biometric support:', error);
      return null;
    }
  };

  return (
    <PinContext.Provider
      value={{
        hasAppLockPin,
        setupAppLockPin,
        verifyAppLockPin,
        verifyAppLockPinWithBiometrics,
        updateAppLockPin,
        removeAppLockPin,
        hasPayoutPin,
        setupPayoutPin,
        verifyPayoutPin,
        updatePayoutPin,
        removePayoutPin,
        hasEmergencyPin,
        setupEmergencyPin,
        verifyEmergencyPin,
        updateEmergencyPin,
        removeEmergencyPin,
        biometricEnabled,
        payoutBiometricEnabled,
        emergencyBiometricEnabled,
        enableBiometric,
        disableBiometric,
        verifyBiometric,
        isLoading,
        checkBiometricSupport,
      }}
    >
      {children}
    </PinContext.Provider>
  );
};