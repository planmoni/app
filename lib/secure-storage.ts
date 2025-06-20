import { Platform } from 'react-native';

// Keys for secure storage
export const APP_LOCK_PIN_KEY = 'app_lock_pin';
export const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
export const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
export const BIOMETRIC_TOKEN_KEY = 'biometric_token';

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

/**
 * Save an item to secure storage
 */
export async function saveItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Use web storage for web platform
      await webStorage.setItem(key, value);
      return;
    }
    
    // Use SecureStore for native platforms
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Error saving item to secure storage: ${key}`, error);
    throw error;
  }
}

/**
 * Get an item from secure storage
 */
export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // Use web storage for web platform
      return await webStorage.getItem(key);
    }
    
    // Use SecureStore for native platforms
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`Error getting item from secure storage: ${key}`, error);
    return null;
  }
}

/**
 * Delete an item from secure storage
 */
export async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Use web storage for web platform
      await webStorage.deleteItem(key);
      return;
    }
    
    // Use SecureStore for native platforms
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`Error deleting item from secure storage: ${key}`, error);
    throw error;
  }
}