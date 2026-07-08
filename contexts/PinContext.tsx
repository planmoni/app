import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import { BIOMETRIC_ENABLED_KEY } from '@/lib/secure-storage';
import { BiometricService } from '@/lib/biometrics';
import { createUserScopedStorage } from '@/lib/user-scoped-storage';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/with-timeout';

const APP_LOCK_PIN_KEY = 'app_lock_pin';
const PAYOUT_PIN_KEY = 'payout_pin';
const EMERGENCY_PIN_KEY = 'emergency_pin';
const PAYOUT_BIOMETRIC_KEY = 'payout_biometric_enabled';
const EMERGENCY_BIOMETRIC_KEY = 'emergency_biometric_enabled';

interface PinContextType {
  hasAppLockPin: boolean;
  setupAppLockPin: (pin: string) => Promise<boolean>;
  verifyAppLockPin: (pin: string) => Promise<boolean>;
  verifyAppLockPinWithBiometrics: () => Promise<boolean>;
  updateAppLockPin: (pin: string) => Promise<boolean>;
  removeAppLockPin: () => Promise<boolean>;

  hasPayoutPin: boolean;
  setupPayoutPin: (pin: string) => Promise<boolean>;
  verifyPayoutPin: (pin: string) => Promise<boolean>;
  updatePayoutPin: (pin: string) => Promise<boolean>;
  removePayoutPin: () => Promise<boolean>;

  hasEmergencyPin: boolean;
  setupEmergencyPin: (pin: string) => Promise<boolean>;
  verifyEmergencyPin: (pin: string) => Promise<boolean>;
  updateEmergencyPin: (pin: string) => Promise<boolean>;
  removeEmergencyPin: () => Promise<boolean>;

  biometricEnabled: boolean;
  payoutBiometricEnabled: boolean;
  emergencyBiometricEnabled: boolean;
  enableBiometric: (type: 'app' | 'payout' | 'emergency') => Promise<boolean>;
  disableBiometric: (type: 'app' | 'payout' | 'emergency') => Promise<boolean>;
  verifyBiometric: (reason?: string) => Promise<boolean>;

  isLoading: boolean;
  checkBiometricSupport: () => Promise<any>;
  setupPin: (pin: string) => Promise<boolean>;
  clearAllPins: () => Promise<void>;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

const softGet = async (
  storage: ReturnType<typeof createUserScopedStorage>,
  key: string
): Promise<string | null> => {
  try {
    return await storage.getItem(key);
  } catch {
    return null;
  }
};

export function usePin() {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
}

export function PinProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [hasAppLockPin, setHasAppLockPin] = useState(false);
  const [hasPayoutPin, setHasPayoutPin] = useState(false);
  const [hasEmergencyPin, setHasEmergencyPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [payoutBiometricEnabled, setPayoutBiometricEnabled] = useState(false);
  const [emergencyBiometricEnabled, setEmergencyBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const userStorage = useMemo(() => {
    if (!userId) return null;
    try {
      return createUserScopedStorage(userId);
    } catch (error) {
      if (__DEV__) {
        console.error('PinContext - Error creating user storage:', error);
      }
      return null;
    }
  }, [userId]);

  const loadPinState = useCallback(async () => {
    if (!userStorage || !userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      await withTimeout(
        (async () => {
          const [
            appLockPin,
            payoutPin,
            emergencyPin,
            biometric,
            payoutBiometric,
            emergencyBiometric,
          ] = await Promise.all([
            softGet(userStorage, APP_LOCK_PIN_KEY),
            softGet(userStorage, PAYOUT_PIN_KEY),
            softGet(userStorage, EMERGENCY_PIN_KEY),
            softGet(userStorage, BIOMETRIC_ENABLED_KEY),
            softGet(userStorage, PAYOUT_BIOMETRIC_KEY),
            softGet(userStorage, EMERGENCY_BIOMETRIC_KEY),
          ]);

          setHasAppLockPin(!!appLockPin);
          setHasPayoutPin(!!payoutPin);
          setHasEmergencyPin(!!emergencyPin);
          setBiometricEnabled(biometric === 'true');
          setPayoutBiometricEnabled(payoutBiometric === 'true');
          setEmergencyBiometricEnabled(emergencyBiometric === 'true');
        })(),
        8000,
        'PIN state load'
      );
    } catch (error) {
      const isTimeoutError =
        error instanceof Error && error.message.includes('PIN state load timed out');

      if (isTimeoutError) {
        if (__DEV__) {
          console.warn(
            `PinContext - PIN state load timed out for user ${userId}; using safe defaults.`
          );
        }
      } else if (__DEV__) {
        console.error(`PinContext - Error loading PIN state for user ${userId}:`, error);
      }

      setHasAppLockPin(false);
      setHasPayoutPin(false);
      setHasEmergencyPin(false);
      setBiometricEnabled(false);
      setPayoutBiometricEnabled(false);
      setEmergencyBiometricEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [userStorage, userId]);

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      if (userId && userStorage) {
        try {
          await loadPinState();
        } catch (error) {
          if (__DEV__) {
            console.error('PinContext - Error in loadPinState during useEffect:', error);
          }
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } else if (isMounted) {
        setHasAppLockPin(false);
        setHasPayoutPin(false);
        setHasEmergencyPin(false);
        setBiometricEnabled(false);
        setPayoutBiometricEnabled(false);
        setEmergencyBiometricEnabled(false);
        setIsLoading(false);
      }
    };

    void loadState();

    return () => {
      isMounted = false;
    };
  }, [userId, userStorage, loadPinState]);

  const setupAppLockPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(APP_LOCK_PIN_KEY, pin);
      setHasAppLockPin(true);
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('PinContext - Error setting up App Lock PIN:', error);
      }
      return false;
    }
  }, [userStorage]);

  const verifyAppLockPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      const storedPin = await userStorage.getItem(APP_LOCK_PIN_KEY);
      return storedPin === pin;
    } catch (error) {
      if (__DEV__) {
        console.error('PinContext - Error verifying App Lock PIN:', error);
      }
      return false;
    }
  }, [userStorage]);

  const updateAppLockPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(APP_LOCK_PIN_KEY, pin);
      setHasAppLockPin(true);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const removeAppLockPin = useCallback(async (): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.deleteItem(APP_LOCK_PIN_KEY);
      setHasAppLockPin(false);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const setupPayoutPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const verifyPayoutPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      const storedPayoutPin = await userStorage.getItem(PAYOUT_PIN_KEY);
      if (storedPayoutPin) {
        return storedPayoutPin === pin;
      }

      const storedAppLockPin = await userStorage.getItem(APP_LOCK_PIN_KEY);
      return storedAppLockPin === pin;
    } catch {
      return false;
    }
  }, [userStorage]);

  const updatePayoutPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(PAYOUT_PIN_KEY, pin);
      setHasPayoutPin(true);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const removePayoutPin = useCallback(async (): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.deleteItem(PAYOUT_PIN_KEY);
      setHasPayoutPin(false);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const setupEmergencyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const verifyEmergencyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      const storedEmergencyPin = await userStorage.getItem(EMERGENCY_PIN_KEY);
      if (storedEmergencyPin) {
        return storedEmergencyPin === pin;
      }

      const storedAppLockPin = await userStorage.getItem(APP_LOCK_PIN_KEY);
      return storedAppLockPin === pin;
    } catch {
      return false;
    }
  }, [userStorage]);

  const updateEmergencyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.setItem(EMERGENCY_PIN_KEY, pin);
      setHasEmergencyPin(true);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const removeEmergencyPin = useCallback(async (): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      await userStorage.deleteItem(EMERGENCY_PIN_KEY);
      setHasEmergencyPin(false);
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const enableBiometric = useCallback(async (type: 'app' | 'payout' | 'emergency'): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      if (Platform.OS === 'web') return false;

      const support = await BiometricService.checkBiometricSupport();
      if (!support.isAvailable || !support.isEnrolled) return false;

      const result = await BiometricService.authenticateWithBiometrics(
        `Enable ${type} biometric authentication for Planmoni?`
      );

      if (!result.success) return false;

      if (type === 'app') {
        await userStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        setBiometricEnabled(true);
      } else if (type === 'payout') {
        await userStorage.setItem(PAYOUT_BIOMETRIC_KEY, 'true');
        setPayoutBiometricEnabled(true);
      } else {
        await userStorage.setItem(EMERGENCY_BIOMETRIC_KEY, 'true');
        setEmergencyBiometricEnabled(true);
      }

      return true;
    } catch (error) {
      if (__DEV__) {
        console.error(`PinContext - Error enabling biometric for ${type}:`, error);
      }
      return false;
    }
  }, [userStorage]);

  const disableBiometric = useCallback(async (type: 'app' | 'payout' | 'emergency'): Promise<boolean> => {
    if (!userStorage) return false;

    try {
      if (type === 'app') {
        await userStorage.deleteItem(BIOMETRIC_ENABLED_KEY);
        setBiometricEnabled(false);
      } else if (type === 'payout') {
        await userStorage.deleteItem(PAYOUT_BIOMETRIC_KEY);
        setPayoutBiometricEnabled(false);
      } else {
        await userStorage.deleteItem(EMERGENCY_BIOMETRIC_KEY);
        setEmergencyBiometricEnabled(false);
      }
      return true;
    } catch {
      return false;
    }
  }, [userStorage]);

  const verifyBiometric = useCallback(async (reason = 'Verify your identity'): Promise<boolean> => {
    try {
      if (Platform.OS === 'web' || !biometricEnabled) return false;
      const result = await BiometricService.authenticateWithBiometrics(reason);
      return result.success;
    } catch {
      return false;
    }
  }, [biometricEnabled]);

  const verifyAppLockPinWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      if (!biometricEnabled) return false;
      const result = await BiometricService.authenticateWithBiometrics(
        'Verify your identity to access your Planmoni account'
      );
      return result.success;
    } catch {
      return false;
    }
  }, [biometricEnabled]);

  const checkBiometricSupport = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        return {
          isAvailable: false,
          isEnrolled: false,
          supportedTypes: [],
        };
      }

      return await BiometricService.checkBiometricSupport();
    } catch {
      return {
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
      };
    }
  }, []);

  const clearAllPins = useCallback(async (): Promise<void> => {
    if (!userStorage) return;

    try {
      await Promise.all([
        userStorage.deleteItem(APP_LOCK_PIN_KEY),
        userStorage.deleteItem(PAYOUT_PIN_KEY),
        userStorage.deleteItem(EMERGENCY_PIN_KEY),
        userStorage.deleteItem(BIOMETRIC_ENABLED_KEY),
        userStorage.deleteItem(PAYOUT_BIOMETRIC_KEY),
        userStorage.deleteItem(EMERGENCY_BIOMETRIC_KEY),
      ]);

      setHasAppLockPin(false);
      setHasPayoutPin(false);
      setHasEmergencyPin(false);
      setBiometricEnabled(false);
      setPayoutBiometricEnabled(false);
      setEmergencyBiometricEnabled(false);
    } catch (error) {
      if (__DEV__) {
        console.error('PinContext - Error clearing PIN data:', error);
      }
      throw error;
    }
  }, [userStorage]);

  const value = useMemo<PinContextType>(
    () => ({
      hasAppLockPin,
      setupAppLockPin,
      setupPin: setupAppLockPin,
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
      clearAllPins,
    }),
    [
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
      clearAllPins,
    ]
  );

  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
}
