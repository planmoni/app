import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keys for secure storage
export const APP_LOCK_PIN_KEY = 'app_lock_pin';
export const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
export const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
export const BIOMETRIC_TOKEN_KEY = 'biometric_token';

// Web storage fallback for development
const webStorage = new Map<string, string>();

/**
 * Save an item to secure storage
 */
export async function saveItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Use in-memory storage for web (development only)
      webStorage.set(key, value);
      return;
    }
    
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
      // Use in-memory storage for web (development only)
      return webStorage.get(key) || null;
    }
    
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
      // Use in-memory storage for web (development only)
      webStorage.delete(key);
      return;
    }
    
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`Error deleting item from secure storage: ${key}`, error);
    throw error;
  }
}