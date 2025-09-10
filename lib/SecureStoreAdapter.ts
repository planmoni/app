import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  private clearCache(key: string) {
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
          // On web, use AsyncStorage with a prefix
          const value = await AsyncStorage.getItem(`secure_${key}`);
          if (value) {
            this.setCache(key, value);
          }
          return value;
        } else {
          // On native, use SecureStore
          const value = await SecureStore.getItemAsync(key);
          if (value) {
            this.setCache(key, value);
          }
          return value;
        }
      } else {
        // Non-sensitive keys use AsyncStorage
        const value = await AsyncStorage.getItem(key);
        if (value) {
          this.setCache(key, value);
        }
        return value;
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
          // On web, use AsyncStorage with a prefix
          await AsyncStorage.setItem(`secure_${key}`, value);
        } else {
          // On native, use SecureStore
          await SecureStore.setItemAsync(key, value);
        }
      } else {
        // Non-sensitive keys use AsyncStorage
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Error setting item in storage: ${key}`, error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      // Clear cache
      this.clearCache(key);

      // Remove from appropriate storage
      if (this.isSensitiveKey(key)) {
        if (Platform.OS === 'web') {
          // On web, use AsyncStorage with a prefix
          await AsyncStorage.removeItem(`secure_${key}`);
        } else {
          // On native, use SecureStore
          await SecureStore.deleteItemAsync(key);
        }
      } else {
        // Non-sensitive keys use AsyncStorage
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing item from storage: ${key}`, error);
      throw error;
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