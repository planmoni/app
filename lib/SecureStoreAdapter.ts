import { Platform } from 'react-native';
import { withTimeout } from '@/lib/with-timeout';

const SECURE_STORE_TIMEOUT_MS = 3000;

/** Lazy-load expo-secure-store so we never throw "Native module not found" at import time (Expo Go/simulator). */
let secureStoreModule: typeof import('expo-secure-store') | null | false = null;
async function getSecureStore(): Promise<typeof import('expo-secure-store') | null> {
  if (secureStoreModule === false) return null;
  if (secureStoreModule !== null) return secureStoreModule;
  try {
    secureStoreModule = require('expo-secure-store');
    return secureStoreModule;
  } catch (_) {
    secureStoreModule = false;
    return null;
  }
}

/** Lazy-load AsyncStorage so we never throw "Native module not found" at import time (simulator). */
let asyncStorageModule: typeof import('@react-native-async-storage/async-storage').default | null | false = null;
async function getAsyncStorage(): Promise<typeof import('@react-native-async-storage/async-storage').default | null> {
  if (asyncStorageModule === false) return null;
  if (asyncStorageModule !== null) return asyncStorageModule;
  try {
    const mod = require('@react-native-async-storage/async-storage');
    asyncStorageModule = mod.default;
    return asyncStorageModule;
  } catch (_) {
    asyncStorageModule = false;
    return null;
  }
}

export interface SecureStoreAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * SecureStore adapter for Supabase with in-memory cache for performance
 * Uses SecureStore for sensitive data (sessions) and AsyncStorage for non-sensitive data
 */
export class SupabaseSecureStoreAdapter implements SecureStoreAdapter {
  private memoryCache = new Map<string, string>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor() {
    // Clear expired cache entries periodically
    setInterval(() => {
      this.clearExpiredCache();
    }, 60000); // Check every minute
  }

  private clearExpiredCache() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.memoryCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  private setCache(key: string, value: string) {
    this.memoryCache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private getCache(key: string): string | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.memoryCache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.memoryCache.get(key) || null;
  }

  private clearCacheEntry(key: string) {
    this.memoryCache.delete(key);
    this.cacheExpiry.delete(key);
  }

  async getItem(key: string): Promise<string | null> {
    try {
      // Check memory cache first
      const cached = this.getCache(key);
      if (cached !== null) {
        return cached;
      }

      // Check SecureStore for sensitive keys
      if (this.isSensitiveKey(key)) {
        if (Platform.OS === 'web') {
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) {
            try {
              const value = await AsyncStorage.getItem(`secure_${key}`);
              if (value) this.setCache(key, value);
              return value ?? null;
            } catch (_) { return null; }
          }
          return null;
        } else {
          // On native: try SecureStore (lazy-loaded), then AsyncStorage (lazy-loaded)
          const SecureStore = await getSecureStore();
          if (SecureStore) {
            try {
              const value = await withTimeout(
                SecureStore.getItemAsync(key),
                SECURE_STORE_TIMEOUT_MS,
                `SecureStoreAdapter.getItem(${key})`
              );
              if (value) this.setCache(key, value);
              return value ?? null;
            } catch (_) {}
          }
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) {
            try {
              const value = await AsyncStorage.getItem(`secure_${key}`);
              if (value) this.setCache(key, value);
              return value ?? null;
            } catch (_) { return null; }
          }
          return null;
        }
      } else {
        const AsyncStorage = await getAsyncStorage();
        if (!AsyncStorage) return null;
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) this.setCache(key, value);
          return value ?? null;
        } catch (_) { return null; }
      }
    } catch (error) {
      console.error(`Error getting item from storage: ${key}`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Update cache
      this.setCache(key, value);

      // Store in appropriate storage
      if (this.isSensitiveKey(key)) {
        if (Platform.OS === 'web') {
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) {
            try { await AsyncStorage.setItem(`secure_${key}`, value); } catch (_) {}
          }
          return;
        } else {
          const SecureStore = await getSecureStore();
          if (SecureStore) {
            try {
              await withTimeout(
                SecureStore.setItemAsync(key, value),
                SECURE_STORE_TIMEOUT_MS,
                `SecureStoreAdapter.setItem(${key})`
              );
              return;
            } catch (_) {}
          }
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) {
            try {
              await AsyncStorage.setItem(`secure_${key}`, value);
            } catch (_) {
              console.warn('SecureStoreAdapter: could not persist session');
            }
          }
          return;
        }
      } else {
        const AsyncStorage = await getAsyncStorage();
        if (AsyncStorage) {
          try { await AsyncStorage.setItem(key, value); } catch (_) {}
        }
      }
    } catch (error) {
      console.error(`Error setting item in storage: ${key}`, error);
      // Do not throw - allows signUp to succeed when persistence fails
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.clearCacheEntry(key);

      // Remove from appropriate storage
      if (this.isSensitiveKey(key)) {
        if (Platform.OS === 'web') {
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) { try { await AsyncStorage.removeItem(`secure_${key}`); } catch (_) {} }
        } else {
          const SecureStore = await getSecureStore();
          if (SecureStore) {
            try {
              await withTimeout(
                SecureStore.deleteItemAsync(key),
                SECURE_STORE_TIMEOUT_MS,
                `SecureStoreAdapter.removeItem(${key})`
              );
            } catch (_) {}
          }
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) { try { await AsyncStorage.removeItem(`secure_${key}`); } catch (_) {} }
        }
      } else {
        const AsyncStorage = await getAsyncStorage();
        if (AsyncStorage) { try { await AsyncStorage.removeItem(key); } catch (_) {} }
      }
    } catch (error) {
      console.error(`Error removing item from storage: ${key}`, error);
    }
  }

  private isSensitiveKey(key: string): boolean {
    // Supabase auth keys that should be stored securely
    const sensitiveKeys = [
      'sb-',
      'supabase.auth.token',
      'auth-token',
      'refresh-token',
      'access-token',
      'session'
    ];
    
    return sensitiveKeys.some(sensitiveKey => key.includes(sensitiveKey));
  }

  /**
   * Clear all cached data (useful for logout)
   */
  clearCache(): void {
    this.memoryCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      cacheSize: this.memoryCache.size,
      cacheKeys: Array.from(this.memoryCache.keys()),
      expiredEntries: Array.from(this.cacheExpiry.entries())
        .filter(([_, expiry]) => Date.now() > expiry)
        .map(([key, _]) => key)
    };
  }
}

// Export singleton instance
export const secureStoreAdapter = new SupabaseSecureStoreAdapter(); 