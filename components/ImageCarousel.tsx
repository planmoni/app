// ImageCarousel.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import PaginationDot from './PaginationDot';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Banner {
  id: string;
  title?: string;
  description?: string | null;
  image_url: string;
  cta_text?: string | null;
  link_url?: string | null;
  order_index?: number;
  is_active?: boolean;
}

interface CachedImage {
  id: string;
  url: string;
  cachedAt: number;
  size?: { width: number; height: number };
}

interface ImageCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  height?: number;
  images?: Banner[];
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDE_MARGIN = 5;
const SLIDE_WIDTH = screenWidth - SLIDE_MARGIN * 9;
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_MARGIN;

const CACHE_KEY = 'image_carousel_cache';
const CACHE_EXPIRY_DAYS = 7; // Cache images for 7 days

// Utility function to validate image URL
const isValidImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' && urlObj.hostname.includes('supabase.co');
  } catch {
    return false;
  }
};

export default function ImageCarousel({
  autoPlay = true,
  autoPlayInterval = 7000,
  showPagination = true,
  height = 180,
  images: propImages,
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<Banner[]>(propImages || []);
  const [isLoading, setIsLoading] = useState(!propImages);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [cachedImages, setCachedImages] = useState<Record<string, CachedImage>>({});

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load cached images on mount
  useEffect(() => {
    loadCachedImages();
  }, []);

  // Handle prop images
  useEffect(() => {
    if (propImages) {
      setImages(propImages);
      setIsLoading(false);
      // Prefetch and cache prop images
      prefetchImages(propImages);
    }
  }, [propImages]);

  // Fetch images if not provided via props
  useEffect(() => {
    if (!propImages) {
      fetchImages();
    }
  }, [propImages]);

  // Load first image immediately when carousel is ready
  useEffect(() => {
    if (images.length > 0 && !loadedImages.has(images[0].id)) {
      loadImage(images[0], 0);
    }
  }, [images]);

  // Clear expired cache entries
  const clearExpiredCache = async () => {
    try {
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      
      const newCache: Record<string, CachedImage> = {};
      Object.entries(cachedImages).forEach(([key, value]) => {
        if (now - value.cachedAt < expiryTime) {
          newCache[key] = value;
        }
      });
      
      setCachedImages(newCache);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
    } catch (error) {
      console.error('[ImageCarousel] Error clearing expired cache:', error);
    }
  };

  // Clear all cache (for debugging or manual cache reset)
  const clearAllCache = async () => {
    try {
      setCachedImages({});
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('[ImageCarousel] Error clearing all cache:', error);
    }
  };

  // Load cached images from AsyncStorage
  const loadCachedImages = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache: Record<string, CachedImage> = JSON.parse(cached);
        const now = Date.now();
        const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        // Filter out expired cache entries
        const validCache: Record<string, CachedImage> = {};
        Object.entries(parsedCache).forEach(([key, value]) => {
          if (now - value.cachedAt < expiryTime) {
            validCache[key] = value;
          }
        });
        
        setCachedImages(validCache);
        
        // Save cleaned cache back to storage
        if (Object.keys(validCache).length !== Object.keys(parsedCache).length) {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(validCache));
        }
      }
    } catch (error) {
      console.error('[ImageCarousel] Error loading cached images:', error);
    }
  };

  // Save images to cache
  const saveToCache = async (imageId: string, imageUrl: string, size?: { width: number; height: number }) => {
    try {
      const newCache = {
        ...cachedImages,
        [imageId]: {
          id: imageId,
          url: imageUrl,
          cachedAt: Date.now(),
          size,
        },
      };
      
      setCachedImages(newCache);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
    } catch (error) {
      console.error('[ImageCarousel] Error saving to cache:', error);
    }
  };

  // Prefetch and cache images
  const prefetchImages = async (imagesToCache: Banner[]) => {
    const prefetchPromises = imagesToCache.map(async (image) => {
      try {
        // Check if already cached
        if (cachedImages[image.id]) {
          return;
        }

        // Validate image URL first
        if (!isValidImageUrl(image.image_url)) {
          console.warn('[ImageCarousel] Invalid image URL:', image.image_url);
          return null;
        }

        // Prefetch the image with timeout
        const prefetchPromise = Image.prefetch(image.image_url);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Prefetch timeout')), 10000)
        );
        
        await Promise.race([prefetchPromise, timeoutPromise]);
        
        // Get image size with timeout
        return new Promise<{ id: string; size: { width: number; height: number } }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Image size timeout'));
          }, 8000);

          Image.getSize(
            image.image_url,
            (width, height) => {
              clearTimeout(timeout);
              resolve({ id: image.id, size: { width, height } });
            },
            (error) => {
              clearTimeout(timeout);
              // Don't log as error, just silently fail
              console.warn('[ImageCarousel] Could not get size for image:', image.image_url);
              reject(error);
            }
          );
        });
      } catch (error) {
        // Don't log as error, just silently fail
        console.warn('[ImageCarousel] Could not prefetch image:', image.image_url);
        return null;
      }
    });

    try {
      const results = await Promise.allSettled(prefetchPromises);
      
      // Save successful prefetches to cache
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const image = imagesToCache.find(img => img.id === result.value!.id);
          if (image) {
            saveToCache(image.id, image.image_url, result.value!.size);
          }
        }
      });
    } catch (error) {
      console.warn('[ImageCarousel] Error in batch prefetch:', error);
    }
  };

  // Check if image should be loaded (lazy loading)
  const shouldLoadImage = (imageIndex: number) => {
    const distance = Math.abs(imageIndex - currentIndex);
    // Load current image, next image, and previous image
    return distance <= 1;
  };

  // Load image when it becomes visible
  const loadImage = (image: Banner, imageIndex: number) => {
    if (loadedImages.has(image.id)) return;

    if (shouldLoadImage(imageIndex)) {
      setLoadedImages(prev => {
        const newSet = new Set(prev);
        newSet.add(image.id);
        return newSet;
      });

      // Get image size when loading (use cached size if available)
      if (!imageSizes[image.id]) {
        const cachedImage = cachedImages[image.id];
        if (cachedImage?.size) {
          setImageSizes((prev) => ({ ...prev, [image.id]: cachedImage.size! }));
        } else {
          // Add timeout for getSize
          const timeout = setTimeout(() => {
            // Use default size as fallback if timeout
            setImageSizes((prev) => ({ ...prev, [image.id]: { width: 300, height: 180 } }));
          }, 5000);

          Image.getSize(
            image.image_url,
            (width: number, height: number) => {
              clearTimeout(timeout);
              setImageSizes((prev) => ({ ...prev, [image.id]: { width, height } }));
              // Save size to cache
              saveToCache(image.id, image.image_url, { width, height });
            },
            (error: any) => {
              clearTimeout(timeout);
              // Don't log as error, use fallback silently
              console.warn('[ImageCarousel] Using fallback size for image:', image.image_url);
              setImageSizes((prev) => ({ ...prev, [image.id]: { width: 300, height: 180 } }));
            }
          );
        }
      }
    }
  };

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      
      const fetchedImages = data || [];
      setImages(fetchedImages);
      
      // Prefetch and cache the fetched images
      prefetchImages(fetchedImages);
    } catch (err) {
      console.error('[ImageCarousel] Error fetching images:', err);
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && images.length > 1 && !isLoading) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          scrollToIndex(nextIndex);
          return nextIndex;
        });
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [images.length, isLoading, autoPlay, autoPlayInterval]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleImagePress = (banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };

  // Loading state
  if (isLoading) {
    const cachedCount = Object.keys(cachedImages).length;
    return (
      <View style={[styles.container, { height }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            {cachedCount > 0 ? `Loading banners... (${cachedCount} cached)` : 'Loading banners...'}
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { height }]}> 
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchImages}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (images.length === 0) return null;

  const CarouselComponent = Platform.OS === 'web' ? ScrollView : Animated.ScrollView;

  return (
    <View style={[styles.container, { height }]}> 
      <CarouselComponent
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SLIDE_MARGIN }}
        onScroll={Platform.OS !== 'web' ? scrollHandler : undefined}
        onMomentumScrollEnd={(event) => {
          const x = event.nativeEvent.contentOffset.x;
          const newIndex = Math.round(x / SNAP_INTERVAL);
          if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
            setCurrentIndex(newIndex);
          }
        }}
      >
        {images.map((image, index) => {
          const naturalSize = imageSizes[image.id];
          const isLoaded = loadedImages.has(image.id);
          const isCached = !!cachedImages[image.id];
          let imageHeight = height;
          let imageWidth = SLIDE_WIDTH;
          let resizeMode: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' = 'cover';

          if (naturalSize) {
            const aspectRatio = naturalSize.width / naturalSize.height;
            const containerAspectRatio = SLIDE_WIDTH / height;

            if (aspectRatio > containerAspectRatio) {
              // Image is wider than container - fit to width
              imageWidth = SLIDE_WIDTH;
              imageHeight = SLIDE_WIDTH / aspectRatio;
              resizeMode = 'contain';
            } else {
              // Image is taller than container - fit to height
              imageHeight = height;
              imageWidth = height * aspectRatio;
              resizeMode = 'contain';
            }
          }

          // Load image if it should be visible
          loadImage(image, index);

          return (
            <Pressable
              key={image.id}
              onPress={() => handleImagePress(image)}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
            >
              <View style={[styles.imageContainer, { height: height }]}>
                {isLoaded || isCached ? (
                  <Image
                    source={{ uri: image.image_url }}
                    style={[
                      styles.image,
                      {
                        width: imageWidth,
                        height: imageHeight,
                      }
                    ]}
                    resizeMode={resizeMode}
                    onError={() =>
                      console.error('[ImageCarousel] Image failed to load:', image.image_url)
                    }
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { width: imageWidth, height: imageHeight }]}>
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </CarouselComponent>

      {showPagination && images.length > 1 && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              currentIndex={currentIndex}
              scrollX={Platform.OS === 'web' ? undefined : scrollX}
              screenWidth={SNAP_INTERVAL}
              color={colors.primary}
              isDark={isDark}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -25,
  },
  slide: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SLIDE_MARGIN,
    position: 'relative',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 8,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // A light gray background for placeholder
  },
});
