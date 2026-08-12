import { Platform } from 'react-native';
import { saveItem, getItem, deleteItem } from './secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

// Import SecureStore only on native platforms for advanced options
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

/**
 * Once keychain rejects with missing entitlement, every SecureStore call fails.
 * Skip further native round-trips for this JS runtime (stops nav spam + auth contention).
 */
let secureStoreBroken = false;

function isEntitlementError(error: unknown): boolean {
  const message = String(
    (error as { message?: string })?.message || error || ''
  );
  return (
    message.includes('entitlement') ||
    message.includes('errSecMissingEntitlement')
  );
}

function markSecureStoreBroken(error: unknown): void {
  if (secureStoreBroken) return;
  if (isEntitlementError(error)) {
    secureStoreBroken = true;
    if (__DEV__) {
      console.warn(
        '[UserScopedStorage] Keychain unavailable; using AsyncStorage only'
      );
    }
  }
}

/**
 * Device capability detection
 */
interface DeviceCapabilities {
  isSimulator: boolean;
  hasBiometrics: boolean;
  hasPasscode: boolean;
  isSecureDevice: boolean;
}

/**
 * Get device capabilities for defensive storage decisions
 */
async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  let isSimulator = false;
  let hasBiometrics = false;
  let hasPasscode = false;

  try {
    // Check if simulator (only on iOS)
    if (__DEV__ && Platform.OS === 'ios') {
      try {
        if (SecureStore && SecureStore.isAvailableAsync) {
          const isAvailable = await SecureStore.isAvailableAsync();
          isSimulator = !isAvailable;
        } else {
          isSimulator = process.env.EXPO_PUBLIC_IS_SIMULATOR === 'true';
        }
      } catch (error) {
        // If SecureStore check fails, assume not simulator
        isSimulator = process.env.EXPO_PUBLIC_IS_SIMULATOR === 'true';
      }
    }

    if (Platform.OS !== 'web') {
      try {
        // Use expo-local-authentication to detect biometric hardware and enrollment
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        hasBiometrics = !!hasHardware && !!isEnrolled;

        // We cannot reliably detect device passcode state across platforms; keep conservative default
        hasPasscode = false;
      } catch (error) {
        // If detection fails, fall back to conservative defaults
        console.warn('Error detecting device capabilities:', error);
        hasBiometrics = false;
        hasPasscode = false;
      }
    }
  } catch (error) {
    // If any capability detection fails, use safe defaults
    console.warn('Error in getDeviceCapabilities, using defaults:', error);
    isSimulator = false;
    hasBiometrics = false;
    hasPasscode = false;
  }

  const isSecureDevice = hasBiometrics || hasPasscode;

  return {
    isSimulator,
    hasBiometrics,
    hasPasscode,
    isSecureDevice
  };
}

/**
 * User-scoped storage wrapper that prefixes all keys with planmoni_<userId>_<key>
 * 
 * Defensive features:
 * - Never requires auth on simulator
 * - Only uses strict security options on real devices with passcode/biometrics
 * - Falls back to AsyncStorage on web or when SecureStore fails
 * - Gracefully handles entitlement errors
 * 
 * Note: To mirror app lock preferences in the user profile for cross-device sync,
 * you can add a field to the profiles table:
 * 
 * ALTER TABLE profiles ADD COLUMN app_lock_enabled BOOLEAN DEFAULT false;
 * 
 * Then update the profile when app lock settings change:
 * 
 * await supabase
 *   .from('profiles')
 *   .update({ app_lock_enabled: enabled })
 *   .eq('id', userId);
 */
export class UserScopedStorage {
  private userId: string;
  private deviceCapabilities: DeviceCapabilities | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getScopedKey(key: string): string {
    // Only replace invalid characters, keep hyphens and other allowed characters
    const sanitizedUserId = this.userId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `planmoni_${sanitizedUserId}_${sanitizedKey}`;
  }

  /**
   * Get device capabilities (cached after first call)
   */
  private async getCapabilities(): Promise<DeviceCapabilities> {
    if (!this.deviceCapabilities) {
      this.deviceCapabilities = await getDeviceCapabilities();
    }
    return this.deviceCapabilities;
  }

  /**
   * Get secure storage options based on device capabilities
   */
  private async getSecureStorageOptions(): Promise<any> {
    try {
      const capabilities = await this.getCapabilities();
      
      // Never require auth on simulator
      if (capabilities.isSimulator) {
        return {
          requireAuthentication: false,
          keychainService: 'planmoni-app-lock-dev',
          ...(Platform.OS === 'ios' && SecureStore && {
            kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          })
        };
      }

      // On real devices, only use strict security if device has biometrics/passcode
      if (capabilities.isSecureDevice) {
        return {
          requireAuthentication: false, // We handle auth at app level, not keychain level
          keychainService: 'planmoni-app-lock',
          ...(Platform.OS === 'ios' && SecureStore && {
            accessGroup: 'planmoni.app-lock',
            kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          })
        };
      }

      // Fallback for devices without security
      return {
        requireAuthentication: false,
        keychainService: 'planmoni-app-lock-basic',
        ...(Platform.OS === 'ios' && SecureStore && {
          kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
      };
    } catch (error) {
      console.warn('Error getting secure storage options, using defaults:', error);
      // Return safe defaults if capability detection fails
      return {
        requireAuthentication: false,
        keychainService: 'planmoni-app-lock-basic'
      };
    }
  }

  /**
   * Save an item to user-scoped secure storage with defensive fallbacks
   */
  async setItem(key: string, value: string): Promise<void> {
    const scopedKey = this.getScopedKey(key);
    
    try {
      if (Platform.OS === 'web') {
        await saveItem(scopedKey, value);
        return;
      }

      if (!SecureStore || secureStoreBroken) {
        await AsyncStorage.setItem(scopedKey, value);
        return;
      }

      const options = await this.getSecureStorageOptions();
      
      try {
        await SecureStore.setItemAsync(scopedKey, value, options);
      } catch (secureStoreError: any) {
        markSecureStoreBroken(secureStoreError);
        if (!secureStoreBroken) {
          console.warn(`SecureStore failed for key ${key}, falling back to AsyncStorage:`, secureStoreError);
        }
        await AsyncStorage.setItem(scopedKey, value);
      }
    } catch (error) {
      console.error(`Error saving user-scoped item: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get an item from user-scoped secure storage with defensive fallbacks
   */
  async getItem(key: string): Promise<string | null> {
    const scopedKey = this.getScopedKey(key);
    
    try {
      if (Platform.OS === 'web') {
        return await getItem(scopedKey);
      }

      if (!SecureStore || secureStoreBroken) {
        return await AsyncStorage.getItem(scopedKey);
      }

      try {
        return await SecureStore.getItemAsync(scopedKey, await this.getSecureStorageOptions());
      } catch (secureStoreError: any) {
        markSecureStoreBroken(secureStoreError);
        if (!secureStoreBroken) {
          console.warn(`SecureStore failed for key ${key}, trying AsyncStorage fallback:`, secureStoreError);
        }
        return await AsyncStorage.getItem(scopedKey);
      }
    } catch (error) {
      console.error(`Error getting user-scoped item: ${key}`, error);
      return null;
    }
  }

  /**
   * Delete an item from user-scoped secure storage with defensive fallbacks
   */
  async deleteItem(key: string): Promise<void> {
    const scopedKey = this.getScopedKey(key);
    
    try {
      if (Platform.OS === 'web') {
        await deleteItem(scopedKey);
        return;
      }

      if (!SecureStore || secureStoreBroken) {
        await AsyncStorage.removeItem(scopedKey);
        return;
      }

      try {
        await SecureStore.deleteItemAsync(scopedKey, await this.getSecureStorageOptions());
      } catch (secureStoreError: any) {
        markSecureStoreBroken(secureStoreError);
        if (!secureStoreBroken) {
          console.warn(`SecureStore delete failed for key ${key}, trying AsyncStorage fallback:`, secureStoreError);
        }
        await AsyncStorage.removeItem(scopedKey);
      }
    } catch (error) {
      console.error(`Error deleting user-scoped item: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all items for this user with defensive fallbacks
   */
  async clearAll(): Promise<void> {
    const commonKeys = [
      'app_lock_enabled',
      'app_lock_pin',
      'biometric_enabled',
      'biometric_token'
    ];

    for (const key of commonKeys) {
      try {
        await this.deleteItem(key);
      } catch (error) {
        console.warn(`Failed to clear key ${key} for user ${this.userId}:`, error);
      }
    }
  }

  /**
   * Get device capabilities for debugging
   */
  async getDeviceInfo(): Promise<DeviceCapabilities> {
    return await this.getCapabilities();
  }
}

/**
 * Create a user-scoped storage instance
 */
export function createUserScopedStorage(userId: string): UserScopedStorage {
  return new UserScopedStorage(userId);
} 