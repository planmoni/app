import { Platform } from 'react-native';

/**
 * Supabase auth storage.
 *
 * IMPORTANT: Do NOT use expo-secure-store for Supabase sessions.
 * Planmoni JWTs (with user metadata) regularly exceed iOS SecureStore's ~2048
 * byte limit. Writes warn / silently fail, then getSession hangs or returns
 * null, which eventually freezes authenticated fetches and UI buttons.
 *
 * Memory cache + AsyncStorage is the reliable path on Expo / RN.
 */

/** Lazy-load AsyncStorage so we never throw at import time (simulator). */
let asyncStorageModule: typeof import('@react-native-async-storage/async-storage').default | null | false =
  null;

async function getAsyncStorage(): Promise<
  typeof import('@react-native-async-storage/async-storage').default | null
> {
  if (asyncStorageModule === false) return null;
  if (asyncStorageModule !== null) return asyncStorageModule;
  try {
    const mod = require('@react-native-async-storage/async-storage');
    asyncStorageModule = mod.default;
    return asyncStorageModule as typeof import('@react-native-async-storage/async-storage').default | null;
  } catch (_) {
    asyncStorageModule = false;
    return null;
  }
}

function storageKey(key: string, sensitive: boolean): string {
  if (!sensitive) return key;
  // Keep the historical `secure_` prefix so existing sessions still load.
  return `secure_${key}`;
}

export interface SecureStoreAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Auth storage adapter for Supabase — memory + AsyncStorage only.
 */
export class SupabaseSecureStoreAdapter implements SecureStoreAdapter {
  private memoryCache = new Map<string, string>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    setInterval(() => {
      this.clearExpiredCache();
    }, 60_000);
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

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'sb-',
      'supabase.auth.token',
      'auth-token',
      'refresh-token',
      'access-token',
      'session',
    ];
    return sensitiveKeys.some((sensitiveKey) => key.includes(sensitiveKey));
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const cached = this.getCache(key);
      if (cached !== null) {
        return cached;
      }

      const AsyncStorage = await getAsyncStorage();
      if (!AsyncStorage) return null;

      const sensitive = this.isSensitiveKey(key);
      const primary = storageKey(key, sensitive);

      try {
        let value = await AsyncStorage.getItem(primary);
        // Migrate legacy unprefixed / alternate keys if needed
        if (value == null && sensitive) {
          value = await AsyncStorage.getItem(key);
        }
        if (value) this.setCache(key, value);
        return value ?? null;
      } catch (_) {
        return null;
      }
    } catch (error) {
      console.error(`Error getting item from storage: ${key}`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.setCache(key, value);

      const AsyncStorage = await getAsyncStorage();
      if (!AsyncStorage) return;

      const sensitive = this.isSensitiveKey(key);
      try {
        await AsyncStorage.setItem(storageKey(key, sensitive), value);
      } catch (_) {
        if (__DEV__) {
          console.warn('SecureStoreAdapter: could not persist session to AsyncStorage');
        }
      }
    } catch (error) {
      console.error(`Error setting item in storage: ${key}`, error);
      // Do not throw — allows sign-in to succeed when persistence fails
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.clearCacheEntry(key);

      const AsyncStorage = await getAsyncStorage();
      if (!AsyncStorage) return;

      const sensitive = this.isSensitiveKey(key);
      try {
        await AsyncStorage.removeItem(storageKey(key, sensitive));
        if (sensitive) {
          await AsyncStorage.removeItem(key);
        }
      } catch (_) {}
    } catch (error) {
      console.error(`Error removing item from storage: ${key}`, error);
    }
  }

  clearCache(): void {
    this.memoryCache.clear();
    this.cacheExpiry.clear();
  }

  getCacheStats() {
    return {
      cacheSize: this.memoryCache.size,
      cacheKeys: Array.from(this.memoryCache.keys()),
      expiredEntries: Array.from(this.cacheExpiry.entries())
        .filter(([_, expiry]) => Date.now() > expiry)
        .map(([key]) => key),
      platform: Platform.OS,
    };
  }
}

export const secureStoreAdapter = new SupabaseSecureStoreAdapter();
