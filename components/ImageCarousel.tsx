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

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
}

interface ImageCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  height?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDE_MARGIN = 16;
const SLIDE_WIDTH = screenWidth - 2 * SLIDE_MARGIN;
const SNAP_INTERVAL = SLIDE_WIDTH + 2 * SLIDE_MARGIN;

export default function ImageCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  height = 200,
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[ImageCarousel] Fetching images from API');
      
      // Fetch images from the API
      const response = await fetch('/api/images');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageCarousel] API error:', errorText);
        throw new Error(`Failed to fetch images: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('[ImageCarousel] API returned error:', data.error);
        throw new Error(data.error || 'Failed to fetch images');
      }
      
      console.log(`[ImageCarousel] Fetched ${data.images?.length || 0} images`);
      setImages(data.images || []);
    } catch (err) {
      console.error('[ImageCarousel] Error fetching images:', err);
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlay && images.length > 1 && !isLoading) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % images.length;
        scrollToIndex(nextIndex);
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [images, currentIndex, isLoading]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
      setCurrentIndex(index);
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.x / SNAP_INTERVAL);
      if (index >= 0 && index < images.length) {
        setCurrentIndex(index);
      }
    },
  });

  const handleImagePress = (banner: Banner) => {
    if (banner.link_url) router.push(banner.link_url);
  };

  const renderPlaceholder = () => (
    <View style={[styles.placeholderContainer, { height }]}>
      <Text style={styles.placeholderText}>No images available</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading images...</Text>
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

  if (images.length === 0) {
    return renderPlaceholder();
  }

  // Use the appropriate component based on platform
  const CarouselComponent = Platform.OS === 'web' ? ScrollView : Animated.ScrollView;

  return (
    <View style={[styles.container, { height }]}>
      <CarouselComponent
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Platform.OS === 'web' ? undefined : scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="center"
        contentContainerStyle={[styles.carouselContent, { paddingHorizontal: SLIDE_MARGIN }]}
      >
        {images.map((image) => (
          <Pressable
            key={image.id}
            onPress={() => handleImagePress(image)}
            style={[styles.slide, { width: SLIDE_WIDTH }]}
          >
            <Image
              source={{ uri: image.image_url }}
              style={[styles.image, { height }]}
              resizeMode="cover"
              onError={(e) => console.error('[ImageCarousel] Image failed to load:', image.image_url, e.nativeEvent.error)}
            />
            {image.title && (
              <View style={styles.captionContainer}>
                <Text style={styles.captionTitle}>{image.title}</Text>
                {image.description && (
                  <Text style={styles.captionDescription}>{image.description}</Text>
                )}
                {image.cta_text && (
                  <View style={styles.ctaButton}>
                    <Text style={styles.ctaText}>{image.cta_text}</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </CarouselComponent>

      {showPagination && images.length > 1 && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              scrollX={scrollX}
              screenWidth={SNAP_INTERVAL}
              isDark={isDark}
              color={colors.primary}
              currentIndex={currentIndex}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselContent: {
    alignItems: 'center',
  },
  slide: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 0,
    position: 'relative',
  },
  image: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#ccc',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  captionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  captionDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
  },
  ctaButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
});