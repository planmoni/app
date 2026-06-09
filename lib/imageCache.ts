import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Image as RNImage } from 'react-native';

export interface CachedImageData {
  url: string;
  localPath: string;
  cachedAt: number;
  size?: { width: number; height: number };
  fileSize?: number;
}

export interface ImageCacheConfig {
  maxCacheSize?: number; // Maximum number of images to cache
  cacheExpiryDays?: number; // How long to keep cached images
  downloadTimeout?: number; // Timeout for downloading in ms
  maxFileSize?: number; // Maximum file size in bytes (default 10MB)
}

/**
 * Proper disk-based image cache manager
 * Downloads and stores images to local filesystem for persistent caching
 */
export class ImageCacheManager {
  private static instance: ImageCacheManager;
  private cache: Map<string, CachedImageData> = new Map();
  private config: Required<ImageCacheConfig>;
  private readonly CACHE_KEY = 'image_cache_metadata';
  private readonly CACHE_DIR = `${FileSystem.cacheDirectory}image_cache/`;

  private constructor(config: ImageCacheConfig = {}) {
    this.config = {
      maxCacheSize: config.maxCacheSize || 100,
      cacheExpiryDays: config.cacheExpiryDays || 30, // 30 days
      downloadTimeout: config.downloadTimeout || 15000, // 15 seconds
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
    };
  }

  static getInstance(config?: ImageCacheConfig): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager(config);
    }
    return ImageCacheManager.instance;
  }

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      await this.ensureCacheDirectory();
      
      // Load cache metadata
      await this.loadCacheFromStorage();
      
      // Clean expired entries
      await this.cleanExpiredEntries();
      
      console.log('[ImageCache] Initialized with', this.cache.size, 'cached images');
    } catch (error) {
      console.warn('[ImageCache] Failed to initialize:', error);
    }
  }

  /**
   * Get cached image - returns local path if cached, null otherwise
   */
  async getCachedImage(url: string): Promise<string | null> {
    try {
      const cached = this.cache.get(url);
      if (!cached) return null;

      // Check if file still exists
      const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
      if (!fileInfo.exists) {
        // File was deleted, remove from cache
        this.cache.delete(url);
        await this.saveCacheToStorage();
        return null;
      }

      // Check if expired
      const now = Date.now();
      const expiryTime = this.config.cacheExpiryDays * 24 * 60 * 60 * 1000;
      
      if (now - cached.cachedAt > expiryTime) {
        // Remove expired file and cache entry
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
        this.cache.delete(url);
        await this.saveCacheToStorage();
        return null;
      }

      console.log(`✅ Using cached image: ${url}`);
      return cached.localPath;
    } catch (error) {
      console.warn('[ImageCache] Error getting cached image:', error);
      return null;
    }
  }

  /**
   * Download and cache image to disk
   */
  async downloadAndCacheImage(url: string): Promise<string | null> {
    try {
      // Check if already cached
      const cachedPath = await this.getCachedImage(url);
      if (cachedPath) return cachedPath;

      // Validate URL
      if (!this.isValidUrl(url)) {
        console.warn('[ImageCache] Invalid URL:', url);
        return null;
      }

      // Generate unique filename
      const urlHash = this.hashUrl(url);
      const fileExtension = this.getFileExtension(url);
      const filename = `${urlHash}${fileExtension}`;
      const localPath = `${this.CACHE_DIR}${filename}`;

      console.log(` Downloading image: ${url}`);

      // Download with timeout
      const downloadPromise = FileSystem.downloadAsync(url, localPath, {
        headers: {
          'Cache-Control': 'max-age=31536000', // 1 year
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), this.config.downloadTimeout)
      );

      const result = await Promise.race([downloadPromise, timeoutPromise]);

      if (result.status !== 200) {
        throw new Error(`Download failed with status: ${result.status}`);
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error('Downloaded file is empty or missing');
      }

      // Check file size
      if (fileInfo.size > this.config.maxFileSize) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        throw new Error(`File too large: ${fileInfo.size} bytes`);
      }

      // Get image size
      let size: { width: number; height: number } | undefined;
      try {
        size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          RNImage.getSize(localPath, (width, height) => resolve({ width, height }), reject);
        });
      } catch (error) {
        console.warn('[ImageCache] Could not get image size:', error);
      }

      // Cache the image data
      const imageData: CachedImageData = {
        url,
        localPath,
        cachedAt: Date.now(),
        size,
        fileSize: fileInfo.size,
      };

      this.cache.set(url, imageData);

      // Enforce cache size limit
      if (this.cache.size > this.config.maxCacheSize) {
        await this.evictOldestEntries();
      }

      await this.saveCacheToStorage();

      console.log(`✅ Cached image: ${url} (${fileInfo.size} bytes)`);
      return localPath;
    } catch (error) {
      console.warn('[ImageCache] Failed to download and cache image:', error);
      return null;
    }
  }

  /**
   * Prefetch multiple images
   */
  async prefetchImages(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const validUrls = urls.filter(url => this.isValidUrl(url));
    
    if (validUrls.length === 0) return results;

    console.log(`🔄 Prefetching ${validUrls.length} images...`);

    // Process in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < validUrls.length; i += batchSize) {
      const batch = validUrls.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (url) => {
        try {
          const localPath = await this.downloadAndCacheImage(url);
          if (localPath) {
            results.set(url, localPath);
          }
        } catch (error) {
          console.warn(`[ImageCache] Failed to prefetch ${url}:`, error);
        }
      });

      await Promise.allSettled(batchPromises);
    }

    console.log(`✅ Prefetched ${results.size}/${validUrls.length} images`);
    return results;
  }

  /**
   * Get image size (cached or from URL)
   */
  async getImageSize(url: string): Promise<{ width: number; height: number } | null> {
    try {
      // Check cache first
      const cached = this.cache.get(url);
      if (cached?.size) {
        return cached.size;
      }

      // Try to get from local file if cached
      const localPath = await this.getCachedImage(url);
      if (localPath) {
        try {
          const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            RNImage.getSize(localPath, (width, height) => resolve({ width, height }), reject);
          });
          // Update cache with size
          if (cached) {
            cached.size = size;
            await this.saveCacheToStorage();
          }
          return size;
        } catch (error) {
          console.warn('[ImageCache] Could not get size from local file:', error);
        }
      }

      // Fallback to URL
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        RNImage.getSize(url, (width, height) => resolve({ width, height }), reject);
      });
      
      // Cache the size if we have the image cached
      if (cached) {
        cached.size = size;
        await this.saveCacheToStorage();
      }
      
      return size;
    } catch (error) {
      console.warn('[ImageCache] Failed to get image size:', error);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  async cleanExpiredEntries(): Promise<void> {
    try {
      const now = Date.now();
      const expiryTime = this.config.cacheExpiryDays * 24 * 60 * 60 * 1000;
      
      const toDelete: string[] = [];
      
      for (const [url, data] of this.cache.entries()) {
        if (now - data.cachedAt > expiryTime) {
          toDelete.push(url);
        }
      }

      // Delete expired files and cache entries
      for (const url of toDelete) {
        const data = this.cache.get(url);
        if (data) {
          await FileSystem.deleteAsync(data.localPath, { idempotent: true });
          this.cache.delete(url);
        }
      }

      if (toDelete.length > 0) {
        await this.saveCacheToStorage();
        console.log(` Cleaned ${toDelete.length} expired cache entries`);
      }
    } catch (error) {
      console.warn('[ImageCache] Failed to clean expired entries:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      // Delete all cached files
      for (const data of this.cache.values()) {
        await FileSystem.deleteAsync(data.localPath, { idempotent: true });
      }

      // Clear cache metadata
      this.cache.clear();
      await AsyncStorage.removeItem(this.CACHE_KEY);
      
      console.log('[ImageCache] Cleared all cache');
    } catch (error) {
      console.warn('[ImageCache] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const expiryTime = this.config.cacheExpiryDays * 24 * 60 * 60 * 1000;
    
    let expired = 0;
    let withSize = 0;
    let totalFileSize = 0;
    
    for (const data of this.cache.values()) {
      if (now - data.cachedAt > expiryTime) {
        expired++;
      }
      if (data.size) {
        withSize++;
      }
      if (data.fileSize) {
        totalFileSize += data.fileSize;
      }
    }

    return {
      total: this.cache.size,
      expired,
      withSize,
      totalFileSize,
      maxSize: this.config.maxCacheSize,
    };
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
        console.log('[ImageCache] Created cache directory');
      }
    } catch (error) {
      console.warn('[ImageCache] Failed to ensure cache directory:', error);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      if (!url || typeof url !== 'string') return false;
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private hashUrl(url: string): string {
    // Simple hash function for URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getFileExtension(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot > 0) {
        const extension = pathname.substring(lastDot);
        // Only allow common image extensions
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension.toLowerCase())) {
          return extension;
        }
      }
      
      return '.jpg'; // Default extension
    } catch {
      return '.jpg';
    }
  }

  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        this.cache = new Map(Object.entries(parsedCache));
      }
    } catch (error) {
      console.warn('[ImageCache] Failed to load cache from storage:', error);
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('[ImageCache] Failed to save cache to storage:', error);
    }
  }

  private async evictOldestEntries(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    
    const toRemove = entries.slice(0, Math.floor(this.config.maxCacheSize * 0.2));
    
    for (const [url, data] of toRemove) {
      await FileSystem.deleteAsync(data.localPath, { idempotent: true });
      this.cache.delete(url);
    }
    
    console.log(`🗑️ Evicted ${toRemove.length} oldest cache entries`);
  }
}

// Export singleton instance
export const imageCache = ImageCacheManager.getInstance(); 