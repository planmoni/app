import { supabase } from './supabase';

export interface SupabaseImageConfig {
  bucket: string;
  path: string;
  expiresIn?: number; // seconds, default 1 hour
}

/**
 * Simple Supabase image URL manager
 * Handles both public and private image URLs efficiently
 */
export class SupabaseImageManager {
  private static urlCache = new Map<string, { url: string; expiresAt: number }>();
  private static readonly REFRESH_THRESHOLD = 12 * 60 * 60 * 1000; // 12 hours

  /**
   * Get image URL for Supabase Storage
   */
  static async getImageUrl(config: SupabaseImageConfig): Promise<string> {
    const cacheKey = `${config.bucket}:${config.path}`;
    const cached = this.urlCache.get(cacheKey);

    // Check if we have a valid cached URL
    if (cached && Date.now() < cached.expiresAt - this.REFRESH_THRESHOLD) {
      return cached.url;
    }

    try {
      let url: string;
      let expiresAt: number;

      // Check if bucket is public
      const { data: bucket } = await supabase.storage.getBucket(config.bucket);
      
      if (bucket?.public) {
        // Public bucket - use public URL
        const { data } = supabase.storage
          .from(config.bucket)
          .getPublicUrl(config.path);
        
        url = data.publicUrl;
        expiresAt = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year
      } else {
        // Private bucket - use signed URL
        const expiresIn = config.expiresIn || 3600; // 1 hour default
        const { data, error } = await supabase.storage
          .from(config.bucket)
          .createSignedUrl(config.path, expiresIn);

        if (error) {
          throw new Error(`Failed to create signed URL: ${error.message}`);
        }

        url = data.signedUrl;
        expiresAt = Date.now() + (expiresIn * 1000);
      }

      // Cache the URL
      this.urlCache.set(cacheKey, { url, expiresAt });
      
      return url;
    } catch (error) {
      console.error('Error getting image URL:', error);
      throw error;
    }
  }

  /**
   * Parse Supabase Storage URL to extract bucket and path
   */
  static parseImageUrl(url: string): SupabaseImageConfig | null {
    try {
      if (!url || typeof url !== 'string') return null;

      const urlObj = new URL(url);
      
      // Check if it's a Supabase Storage URL
      if (urlObj.hostname.includes('supabase') || urlObj.hostname.includes('storage')) {
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
        
        if (pathParts.length >= 2) {
          const bucket = pathParts[0];
          const path = pathParts.slice(1).join('/');
          
          return { bucket, path };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to parse image URL:', url);
      return null;
    }
  }

  /**
   * Process banner images and get optimized URLs
   */
  static async processBannerImages(banners: Array<{ id: string; image_url: string }>): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    
    for (const banner of banners) {
      try {
        const config = this.parseImageUrl(banner.image_url);
        
        if (config) {
          // Try to get optimized Supabase URL
          const url = await this.getImageUrl(config);
          urlMap.set(banner.id, url);
        } else {
          // Not a Supabase URL, use as-is
          urlMap.set(banner.id, banner.image_url);
        }
      } catch (error) {
        console.warn(`Failed to process banner ${banner.id}, using original URL:`, error);
        // Fallback to original URL
        urlMap.set(banner.id, banner.image_url);
      }
    }

    return urlMap;
  }

  /**
   * Clear expired URLs from cache
   */
  static clearExpiredUrls(): void {
    const now = Date.now();
    for (const [key, cached] of this.urlCache.entries()) {
      if (now >= cached.expiresAt) {
        this.urlCache.delete(key);
      }
    }
  }
}

// Export convenience functions
export const getImageUrl = SupabaseImageManager.getImageUrl.bind(SupabaseImageManager);
export const processBannerImages = SupabaseImageManager.processBannerImages.bind(SupabaseImageManager);
