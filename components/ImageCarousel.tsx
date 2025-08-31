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
import { LinearGradient } from 'expo-linear-gradient';

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
  autoPlayInterval = 5000,
  showPagination = true,
  height = 151,
  images: propImages,
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<Banner[]>(propImages || []);
  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [isLoading, setIsLoading] = useState(!propImages);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!propImages) {
      fetchImages();
    }
  }, [propImages]);

  useEffect(() => {
    if (propImages) {
      setImages(propImages);
      setIsLoading(false);
      setImagesReady(false); // Reset ready state for new images
    }
  }, [propImages]);

  useEffect(() => {
    if (images.length === 0) return;

    let loadedCount = 0;
    const totalImages = images.length;

    images.forEach((image) => {
      if (!imageSizes[image.id]) {
        Image.getSize(
          image.image_url,
          (width, height) => {
            setImageSizes((prev) => ({ ...prev, [image.id]: { width, height } }));
            loadedCount++;
            if (loadedCount === totalImages) {
              setImagesReady(true);
            }
          },
          (error) => {
            console.error('[ImageCarousel] Failed to get image size:', error);
            loadedCount++;
            if (loadedCount === totalImages) {
              setImagesReady(true);
            }
          }
        );
      } else {
        loadedCount++;
        if (loadedCount === totalImages) {
          setImagesReady(true);
        }
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

  useEffect(() => {
    if (autoPlay && images.length > 1 && !isLoading && imagesReady) {
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
  }, [images.length, isLoading, autoPlay, autoPlayInterval, imagesReady]);

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

  if (images.length === 0) return null;

  // Show loading state while images are being prepared
  if (!imagesReady) {
    return (
      <View style={[styles.container, { height }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparing banners to display...</Text>
        </View>
      </View>
    );
  }

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
          const scaledHeight = naturalSize
            ? (naturalSize.height / naturalSize.width) * SLIDE_WIDTH
            : height;

          return (
            <Pressable
              key={image.id}
              onPress={() => handleImagePress(image)}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
            >
              <Image
                source={{ uri: image.image_url }}
                style={{ width: '100%', height: scaledHeight, borderRadius: 8 }}
                resizeMode="cover"
                onError={() =>
                  console.error('[ImageCarousel] Image failed to load:', image.image_url)
                }
              />
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
    marginVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SLIDE_MARGIN,
    position: 'relative',
  },
  image: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 20,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
  },
  captionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captionDescription: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  ctaButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '500',
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
});
