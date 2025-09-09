import { Platform } from 'react-native';
import { saveItem, getItem, deleteItem } from './secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import SecureStore only on native platforms for advanced options
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
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
  const isSimulator = __DEV__ && Platform.OS === 'ios' && 
    (await SecureStore?.isAvailableAsync?.() === false || 
     process.env.EXPO_PUBLIC_IS_SIMULATOR === 'true');

  let hasBiometrics = false;
  let hasPasscode = false;

  if (Platform.OS !== 'web' && SecureStore) {
    try {
      // Try to detect if device has biometrics/passcode by testing keychain access
      await SecureStore.setItemAsync('_test_keychain_access', 'test', {
        requireAuthentication: true,
        keychainService: 'planmoni-test'
      });
      hasBiometrics = true;
      hasPasscode = true;
      await SecureStore.deleteItemAsync('_test_keychain_access', {
        keychainService: 'planmoni-test'
      });
    } catch (error) {
      // If authentication fails, device might not have biometrics/passcode
      hasBiometrics = false;
      hasPasscode = false;
    }
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
    const capabilities = await this.getCapabilities();
    
    // Never require auth on simulator
    if (capabilities.isSimulator) {
      return {
        requireAuthentication: false,
        keychainService: 'planmoni-app-lock-dev',
        ...(Platform.OS === 'ios' && {
          kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
      };
    }

    // On real devices, only use strict security if device has biometrics/passcode
    if (capabilities.isSecureDevice) {
      return {
        requireAuthentication: false, // We handle auth at app level, not keychain level
        keychainService: 'planmoni-app-lock',
        ...(Platform.OS === 'ios' && {
          accessGroup: 'planmoni.app-lock',
          kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
        })
      };
    }

    // Fallback for devices without security
    return {
      requireAuthentication: false,
      keychainService: 'planmoni-app-lock-basic',
      ...(Platform.OS === 'ios' && {
        kSecAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
      })
    };
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

      if (!SecureStore) {
        // Fallback to AsyncStorage if SecureStore is not available
        await AsyncStorage.setItem(scopedKey, value);
        return;
      }

      const options = await this.getSecureStorageOptions();
      
      try {
        await SecureStore.setItemAsync(scopedKey, value, options);
      } catch (secureStoreError: any) {
        console.warn(`SecureStore failed for key ${key}, falling back to AsyncStorage:`, secureStoreError);
        
        // If SecureStore fails (e.g., entitlement issues), fall back to AsyncStorage
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

      if (!SecureStore) {
        // Fallback to AsyncStorage if SecureStore is not available
        return await AsyncStorage.getItem(scopedKey);
      }

      try {
        return await SecureStore.getItemAsync(scopedKey, await this.getSecureStorageOptions());
      } catch (secureStoreError: any) {
        console.warn(`SecureStore failed for key ${key}, trying AsyncStorage fallback:`, secureStoreError);
        
        // If SecureStore fails, try AsyncStorage as fallback
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

      if (!SecureStore) {
        // Fallback to AsyncStorage if SecureStore is not available
        await AsyncStorage.removeItem(scopedKey);
        return;
      }

      try {
        await SecureStore.deleteItemAsync(scopedKey, await this.getSecureStorageOptions());
      } catch (secureStoreError: any) {
        console.warn(`SecureStore delete failed for key ${key}, trying AsyncStorage fallback:`, secureStoreError);
        
        // If SecureStore fails, try AsyncStorage as fallback
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