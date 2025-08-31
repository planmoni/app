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
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDE_MARGIN = 5;
const SLIDE_WIDTH = screenWidth - SLIDE_MARGIN * 9;
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_MARGIN;

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

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle prop images
  useEffect(() => {
    if (propImages) {
      setImages(propImages);
      setIsLoading(false);
    }
  }, [propImages]);

  // Fetch images if not provided via props
  useEffect(() => {
    if (!propImages) {
      fetchImages();
    }
  }, [propImages]);

  // Detect image sizes when images are loaded
  useEffect(() => {
    if (images.length === 0) return;

    images.forEach((image) => {
      if (!imageSizes[image.id]) {
        Image.getSize(
          image.image_url,
          (width: number, height: number) => {
            setImageSizes((prev) => ({ ...prev, [image.id]: { width, height } }));
          },
          (error: any) => {
            console.error('[ImageCarousel] Failed to get image size for:', image.image_url, error);
            // Use default size as fallback
            setImageSizes((prev) => ({ ...prev, [image.id]: { width: 300, height: 180 } }));
          }
        );
      }
    });
  }, [images, imageSizes]);

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
      setImages(data || []);
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
    return (
      <View style={[styles.container, { height }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading banners...</Text>
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
        {images.map((image) => {
          const naturalSize = imageSizes[image.id];
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

          return (
            <Pressable
              key={image.id}
              onPress={() => handleImagePress(image)}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
            >
              <View style={[styles.imageContainer, { height: height }]}>
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
    marginBottom: 10,
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
});
