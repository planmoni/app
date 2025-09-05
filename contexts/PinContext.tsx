import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { saveItem, getItem, deleteItem, BIOMETRIC_ENABLED_KEY } from '@/lib/secure-storage';
import { BiometricService } from '@/lib/biometrics';

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

export function usePin() {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
}

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [hasAppLockPin, setHasAppLockPin] = useState(false);
  const [hasPayoutPin, setHasPayoutPin] = useState(false);
  const [hasEmergencyPin, setHasEmergencyPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [payoutBiometricEnabled, setPayoutBiometricEnabled] = useState(false);
  const [emergencyBiometricEnabled, setEmergencyBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load PIN state on mount
  useEffect(() => {
    loadPinState();
  }, []);

  const loadPinState = async () => {
    try {
      setIsLoading(true);
      
      // Check if PINs exist
      const appLockPin = await getItem(APP_LOCK_PIN_KEY);
      const payoutPin = await getItem(PAYOUT_PIN_KEY);
      const emergencyPin = await getItem(EMERGENCY_PIN_KEY);
      
      setHasAppLockPin(!!appLockPin);
      setHasPayoutPin(!!payoutPin);
      setHasEmergencyPin(!!emergencyPin);
      
      // Check if biometric is enabled
      const biometric = await getItem(BIOMETRIC_ENABLED_KEY);
      const payoutBiometric = await getItem(PAYOUT_BIOMETRIC_KEY);
      const emergencyBiometric = await getItem(EMERGENCY_BIOMETRIC_KEY);
      
      setBiometricEnabled(biometric === 'true');
      setPayoutBiometricEnabled(payoutBiometric === 'true');
      setEmergencyBiometricEnabled(emergencyBiometric === 'true');
    } catch (error) {
      console.error('Error loading PIN state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('PinContext - setupAppLockPin called with:', pin);
      console.log('PinContext - PIN details:', {
        value: pin,
        type: typeof pin,
        length: pin?.length
      });
      
      await saveItem(APP_LOCK_PIN_KEY, pin);
      setHasAppLockPin(true);
      
      // Verify what was actually saved
      const savedPin = await getItem(APP_LOCK_PIN_KEY);
      console.log('PinContext - PIN saved and verified:', {
        original: pin,
        saved: savedPin,
        match: pin === savedPin
      });
      
      console.log('PinContext - App Lock PIN setup completed successfully');
      return true;
    } catch (error) {
      console.error('PinContext - Error setting up App Lock PIN:', error);
      return false;
    }
  };

  const verifyAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('PinContext - verifyAppLockPin called with:', pin);
      const storedPin = await getItem(APP_LOCK_PIN_KEY);
      console.log('PinContext - Stored PIN retrieved:', storedPin);
      console.log('PinContext - PIN comparison:', {
        input: pin,
        stored: storedPin,
        inputType: typeof pin,
        storedType: typeof storedPin,
        inputLength: pin?.length,
        storedLength: storedPin?.length,
        match: storedPin === pin,
        exactMatch: storedPin === pin
      });
      
      const isValid = storedPin === pin;
      console.log('PinContext - PIN verification result:', isValid);
      return isValid;
    } catch (error) {
      console.error('PinContext - Error verifying App Lock PIN:', error);
      return false;
    }
  };

  const updateAppLockPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Updating App Lock PIN...');
      await saveItem(APP_LOCK_PIN_KEY, pin);
      setHasAppLockPin(true);
      console.log('App Lock PIN updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating App Lock PIN:', error);
      return false;
    }
  };

  const removeAppLockPin = async (): Promise<boolean> => {
    try {
      console.log('Removing App Lock PIN...');
      await deleteItem(APP_LOCK_PIN_KEY);
      setHasAppLockPin(false);
      console.log('App Lock PIN removed successfully');
      return true;
    } catch (error) {
      console.error('Error removing App Lock PIN:', error);
      return false;
    }
  };

  const setupPayoutPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Setting up Payout PIN...');
      await saveItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      console.log('Payout PIN setup completed successfully');
      return true;
    } catch (error) {
      console.error('Error setting up Payout PIN:', error);
      return false;
    }
  };

  const verifyPayoutPin = async (pin: string): Promise<boolean> => {
    try {
      const storedPin = await getItem(PAYOUT_PIN_KEY);
      console.log('Verifying Payout PIN...');
      return storedPin === pin;
    } catch (error) {
      console.error('Error verifying Payout PIN:', error);
      return false;
    }
  };

  const updatePayoutPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Updating Payout PIN...');
      await saveItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      console.log('Payout PIN updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating Payout PIN:', error);
      return false;
    }
  };

  const removePayoutPin = async (): Promise<boolean> => {
    try {
      console.log('Removing Payout PIN...');
      await deleteItem(PAYOUT_PIN_KEY);
      setHasPayoutPin(false);
      console.log('Payout PIN removed successfully');
      return true;
    } catch (error) {
      console.error('Error removing Payout PIN:', error);
      return false;
    }
  };

  const setupEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Setting up Emergency PIN...');
      await saveItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      console.log('Emergency PIN setup completed successfully');
      return true;
    } catch (error) {
      console.error('Error setting up Emergency PIN:', error);
      return false;
    }
  };

  const verifyEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Verifying Emergency PIN...');
      const storedEmergencyPin = await getItem(EMERGENCY_PIN_KEY);
      
      // If emergency PIN is set, use it
      if (storedEmergencyPin) {
        console.log('Emergency PIN found, verifying against emergency PIN');
        return storedEmergencyPin === pin;
      }
      
      // Fall back to app lock PIN if no emergency PIN is set
      console.log('No emergency PIN set, falling back to app lock PIN');
      const storedAppLockPin = await getItem(APP_LOCK_PIN_KEY);
      if (storedAppLockPin) {
        console.log('App lock PIN found, verifying against app lock PIN');
        return storedAppLockPin === pin;
      }
      
      console.log('No PIN found for emergency verification');
      return false;
    } catch (error) {
      console.error('Error verifying Emergency PIN:', error);
      return false;
    }
  };

  const updateEmergencyPin = async (pin: string): Promise<boolean> => {
    try {
      console.log('Updating Emergency PIN...');
      await saveItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      console.log('Emergency PIN updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating Emergency PIN:', error);
      return false;
    }
  };

  const removeEmergencyPin = async (): Promise<boolean> => {
    try {
      console.log('Removing Emergency PIN...');
      await deleteItem(EMERGENCY_PIN_KEY);
      setHasEmergencyPin(false);
      console.log('Emergency PIN removed successfully');
      return true;
    } catch (error) {
      console.error('Error removing Emergency PIN:', error);
      return false;
    }
  };

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
        
        if (type === 'app') {
          await saveItem(BIOMETRIC_ENABLED_KEY, 'true');
          setBiometricEnabled(true);
          console.log('PinContext - App biometric enabled and saved');
        } else if (type === 'payout') {
          await saveItem(PAYOUT_BIOMETRIC_KEY, 'true');
          setPayoutBiometricEnabled(true);
          console.log('PinContext - Payout biometric enabled and saved');
        } else if (type === 'emergency') {
          await saveItem(EMERGENCY_BIOMETRIC_KEY, 'true');
          setEmergencyBiometricEnabled(true);
          console.log('PinContext - Emergency biometric enabled and saved');
        }
        
        // Verify the save operation
        const savedValue = await getItem(type === 'app' ? BIOMETRIC_ENABLED_KEY : 
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
        await deleteItem(BIOMETRIC_ENABLED_KEY);
        setBiometricEnabled(false);
        console.log('PinContext - App biometric disabled and removed from storage');
      } else if (type === 'payout') {
        await deleteItem(PAYOUT_BIOMETRIC_KEY);
        setPayoutBiometricEnabled(false);
        console.log('PinContext - Payout biometric disabled and removed from storage');
      } else if (type === 'emergency') {
        await deleteItem(EMERGENCY_BIOMETRIC_KEY);
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

  const verifyAppLockPinWithBiometrics = async (): Promise<boolean> => {
    try {
      console.log('PinContext - Verifying App Lock PIN with biometrics...');
      
      // First, check if biometrics are enabled
      if (!biometricEnabled) {
        console.log('PinContext - Biometrics not enabled');
        return false;
      }
      
      // Perform biometric authentication
      const result = await BiometricService.authenticateWithBiometrics(
        'Verify your identity to access your Planmoni account'
      );
      
      console.log('PinContext - Biometric authentication result:', result);
      
      if (result.success) {
        // Biometric authentication successful - this means the user is verified
        // Since biometrics are enabled and working, we can consider this as PIN verification
        console.log('PinContext - App Lock PIN verified successfully with biometrics');
        return true;
      } else {
        console.log('PinContext - App Lock PIN verification failed with biometrics:', result.error);
        return false;
      }
    } catch (error) {
      console.error('PinContext - Error verifying App Lock PIN with biometrics:', error);
      return false;
    }
  };


  const checkBiometricSupport = async () => {
    try {
      if (Platform.OS === 'web') {
        return {
          isAvailable: false,
          isEnrolled: false,
          supportedTypes: []
        };
      }
      
      return await BiometricService.checkBiometricSupport();
    } catch (error) {
      console.error('Error checking biometric support:', error);
      return {
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: []
      };
    }
  };

  return (
    <PinContext.Provider value={{
      // App Lock PIN
      hasAppLockPin,
      setupAppLockPin,
      verifyAppLockPin,
      verifyAppLockPinWithBiometrics,
      updateAppLockPin,
      removeAppLockPin,
      
      // Payout PIN
      hasPayoutPin,
      setupPayoutPin,
      verifyPayoutPin,
      updatePayoutPin,
      removePayoutPin,
      
      // Emergency Withdrawal PIN
      hasEmergencyPin,
      setupEmergencyPin,
      verifyEmergencyPin,
      updateEmergencyPin,
      removeEmergencyPin,
      
      // Biometric Settings
      biometricEnabled,
      payoutBiometricEnabled,
      emergencyBiometricEnabled,
      enableBiometric,
      disableBiometric,
      verifyBiometric,
      
      // General
      isLoading,
      checkBiometricSupport,
    }}>
      {children}
    </PinContext.Provider>
  );
}