import { Platform } from 'react-native';

// Keys for secure storage
export const APP_LOCK_PIN_KEY = 'app_lock_pin';
export const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
export const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
export const BIOMETRIC_TOKEN_KEY = 'biometric_token';
export const AUTH_SESSION_KEY = 'auth_session';
export const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';
export const AUTH_ACCESS_TOKEN_KEY = 'auth_access_token';

// Web storage implementation
class WebStorage {
  private storage = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    try {
      // Try to get from localStorage first
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key);
        return value;
      }
      // Fall back to in-memory storage
      return this.storage.get(key) || null;
    } catch (error) {
      console.error(`Error getting item from web storage: ${key}`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Try to use localStorage first
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
      // Fall back to in-memory storage
      this.storage.set(key, value);
    } catch (error) {
      console.error(`Error saving item to web storage: ${key}`, error);
      throw error;
    }
  }

  async deleteItem(key: string): Promise<void> {
    try {
      // Try to use localStorage first
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
      // Fall back to in-memory storage
      this.storage.delete(key);
    } catch (error) {
      console.error(`Error deleting item from web storage: ${key}`, error);
      throw error;
    }
  }
}

// Create a singleton instance of WebStorage
const webStorage = new WebStorage();

// Import SecureStore only on native platforms
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

// AsyncStorage fallback for when the keychain is unavailable (e.g. dev builds
// missing the keychain-access-groups entitlement on iOS).
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (_) {
  AsyncStorage = null;
}

// Once the keychain rejects with an entitlement error, every subsequent call
// will fail too. Cache that fact so startup doesn't pay for repeated slow,
// doomed native round-trips.
let secureStoreBroken = false;

function isEntitlementError(error: any): boolean {
  const message = String(error?.message || error || '');
  return message.includes('entitlement') || message.includes('errSecMissingEntitlement');
}

const FALLBACK_PREFIX = 'secure_fallback_';

/**
 * Save an item to secure storage
 */
export async function saveItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webStorage.setItem(key, value);
    return;
  }

  if (!secureStoreBroken) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (error) {
      if (isEntitlementError(error)) {
        secureStoreBroken = true;
        console.warn('SecureStore unavailable (entitlement missing); falling back to AsyncStorage');
      } else {
        console.error(`Error saving item to secure storage: ${key}`, error);
        throw error;
      }
    }
  }

  if (AsyncStorage) {
    await AsyncStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
  }
}

/**
 * Get an item from secure storage
 */
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return await webStorage.getItem(key);
  }

  if (!secureStoreBroken) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      if (isEntitlementError(error)) {
        secureStoreBroken = true;
        console.warn('SecureStore unavailable (entitlement missing); falling back to AsyncStorage');
      } else {
        console.error(`Error getting item from secure storage: ${key}`, error);
        return null;
      }
    }
  }

  if (AsyncStorage) {
    try {
      return await AsyncStorage.getItem(`${FALLBACK_PREFIX}${key}`);
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Delete an item from secure storage
 */
export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webStorage.deleteItem(key);
    return;
  }

  if (!secureStoreBroken) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (isEntitlementError(error)) {
        secureStoreBroken = true;
        console.warn('SecureStore unavailable (entitlement missing); falling back to AsyncStorage');
      } else {
        console.error(`Error deleting item from secure storage: ${key}`, error);
        throw error;
      }
    }
  }

  if (AsyncStorage) {
    try {
      await AsyncStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
    } catch (_) {}
  }
}