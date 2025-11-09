// ImageCarousel.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import PaginationDot from './PaginationDot';
import { supabase } from '@/lib/supabase';
import { imageCache } from '@/lib/imageCache';
import { SupabaseImageManager } from '@/lib/supabaseImages';

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

interface ImageCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  height?: number;
  images?: Banner[];
  showDimensions?: boolean; // New prop to show/hide dimensions
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDE_MARGIN = 15;
// Account for: right padding (SLIDE_MARGIN) + right margin between slides (SLIDE_MARGIN)
const SLIDE_WIDTH = screenWidth - SLIDE_MARGIN * 2;
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_MARGIN;

export default function ImageCarousel({
  autoPlay = true,
  autoPlayInterval = 7000,
  showPagination = true,
  height = 160,
  images: propImages,
  showDimensions = false, // Default to false for production
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<Banner[]>(propImages || []);
  const [isLoading, setIsLoading] = useState(!propImages);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [cachedImagePaths, setCachedImagePaths] = useState<Map<string, string>>(new Map());
  const [isPrefetching, setIsPrefetching] = useState(false);

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize image cache
  useEffect(() => {
    imageCache.initialize();
  }, []);

  // Handle prop images
  useEffect(() => {
    if (propImages) {
      setImages(propImages);
      setIsLoading(false);
      processImages(propImages);
    }
  }, [propImages]);

  // Fetch images if not provided via props
  useEffect(() => {
    if (!propImages) {
      fetchImages();
    }
  }, [propImages]);

  // Process images for optimal loading
  const processImages = useCallback(async (banners: Banner[]) => {
    try {
      setIsPrefetching(true);
      
      // Get optimized URLs from Supabase
      const urlMap = await SupabaseImageManager.processBannerImages(banners);
      
      // Prefetch and cache images to disk
      const cachedPaths = await imageCache.prefetchImages(Array.from(urlMap.values()));
      setCachedImagePaths(cachedPaths);

      // Load image sizes
      await loadImageSizes(banners, urlMap);
      
      console.log(`✅ Processed ${banners.length} images, ${cachedPaths.size} cached`);
    } catch (error) {
      console.warn('[ImageCarousel] Error processing images:', error);
    } finally {
      setIsPrefetching(false);
    }
  }, []);

  // Load image sizes efficiently
  const loadImageSizes = useCallback(async (banners: Banner[], urlMap: Map<string, string>) => {
    const sizePromises = banners.map(async (banner) => {
      try {
        const url = urlMap.get(banner.id) || banner.image_url;
        const size = await imageCache.getImageSize(url);
        
        if (size) {
          setImageSizes(prev => ({ ...prev, [banner.id]: size }));
          console.log(` Image ${banner.id} dimensions: ${size.width}x${size.height}`);
        }
      } catch (error) {
        console.warn(`[ImageCarousel] Failed to get size for ${banner.id}:`, error);
      }
    });

    await Promise.allSettled(sizePromises);
  }, []);

  // Get image source (cached local path or original URL)
  const getImageSource = useCallback((banner: Banner, urlMap: Map<string, string>) => {
    const url = urlMap.get(banner.id) || banner.image_url;
    const cachedPath = cachedImagePaths.get(url);
    
    if (cachedPath) {
      return { uri: cachedPath };
    }
    
    return { uri: url };
  }, [cachedImagePaths]);

  // Check if image should be loaded (lazy loading)
  const shouldLoadImage = useCallback((imageIndex: number) => {
    const distance = Math.abs(imageIndex - currentIndex);
    return distance <= 1; // Load current, next, and previous images
  }, [currentIndex]);

  // Load image when it becomes visible
  const loadImage = useCallback((image: Banner, imageIndex: number) => {
    if (loadedImages.has(image.id) || !shouldLoadImage(imageIndex)) return;

    setLoadedImages(prev => new Set([...prev, image.id]));
  }, [loadedImages, shouldLoadImage]);

  const fetchImages = useCallback(async () => {
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
      
      // Process the fetched images
      await processImages(fetchedImages);
    } catch (err) {
      console.error('[ImageCarousel] Error fetching images:', err);
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, [processImages]);

  const scrollToIndex = useCallback((index: number) => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
    }
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && images.length > 1 && !isLoading && !isPrefetching) {
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
  }, [images.length, isLoading, isPrefetching, autoPlay, autoPlayInterval, scrollToIndex]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleImagePress = useCallback((banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  }, []);

  // Calculate dynamic height based on image dimensions
  const calculateDynamicHeight = useCallback(() => {
    if (images.length === 0) return height;

    const sizes = Object.values(imageSizes);
    if (sizes.length === 0) return height;

    // Calculate median aspect ratio for stability
    const aspectRatios = sizes.map(size => size.width / size.height);
    aspectRatios.sort((a, b) => a - b);
    const medianAspectRatio = aspectRatios[Math.floor(aspectRatios.length / 2)];

    const calculatedHeight = SLIDE_WIDTH / medianAspectRatio;
    const maxHeight = height * 1.5; // Allow up to 1.5x the default height
    const minHeight = height * 0.7; // Minimum 70% of default height

    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  }, [images.length, imageSizes, height]);

  const dynamicHeight = calculateDynamicHeight();

  // Loading state
  if (isLoading || isPrefetching) {
    const cacheStats = imageCache.getCacheStats();
    return (
      <View style={[styles.container, { height: dynamicHeight }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            {isPrefetching 
              ? `Loading banners...` 
              : 'Loading banners...'
            }
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { height: dynamicHeight }]}> 
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchImages}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state
  if (images.length === 0) return null;

  const CarouselComponent = Platform.OS === 'web' ? View : Animated.ScrollView;

  return (
    <View style={[styles.container, { height: dynamicHeight }]}> 
      <CarouselComponent
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={{ paddingLeft: 0, paddingRight: SLIDE_MARGIN }}
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
          const imageSource = getImageSource(image, new Map());
          
          // Load image if it should be visible
          loadImage(image, index);

          return (
            <Pressable
              key={image.id}
              onPress={() => handleImagePress(image)}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
            >
              <View style={[styles.imageContainer, { height: dynamicHeight }]}>
                <Image
                  source={imageSource}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                  placeholder={null}
                  onError={() => {
                    console.warn('[ImageCarousel] Image failed to load:', imageSource.uri);
                  }}
                />
                
                {!isLoaded && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                )}

                {/* Display image dimensions overlay */}
                {showDimensions && naturalSize && (
                  <View style={styles.dimensionsOverlay}>
                    <Text style={styles.dimensionsText}>
                      {naturalSize.width} × {naturalSize.height}
                    </Text>
                    <Text style={styles.aspectRatioText}>
                      {(naturalSize.width / naturalSize.height).toFixed(2)}:1
                    </Text>
                    <Text style={styles.displaySizeText}>
                      Container: {SLIDE_WIDTH} × {Math.round(dynamicHeight)}
                    </Text>
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
              color={isDark ? colors.text : colors.primary}
              isDark={isDark}
            />
          ))}
        </View>
      )}

      {/* Debug info panel */}
      {showDimensions && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Image Dimensions Debug</Text>
          <Text style={styles.debugText}>
            Carousel Height: {Math.round(dynamicHeight)}px
          </Text>
          <Text style={styles.debugText}>
            Slide Width: {SLIDE_WIDTH}px
          </Text>
          <Text style={styles.debugText}>
            Images with dimensions: {Object.keys(imageSizes).length}/{images.length}
          </Text>
          <Text style={styles.debugText}>
            Cached images: {cachedImagePaths.size}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
    // marginTop: 10,
  },
  scrollView: {
    width: screenWidth,
  },
  slide: {
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: SLIDE_MARGIN,
    position: 'relative',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginTop: 10,
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
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    borderRadius: 8,
  },
  dimensionsOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 4,
    minWidth: 120,
  },
  dimensionsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  aspectRatioText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  displaySizeText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  debugPanel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 6,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 2,
  },
});
