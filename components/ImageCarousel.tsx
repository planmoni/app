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
import { supabase } from '@/lib/supabase';
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
const SLIDE_WIDTH = screenWidth - (SLIDE_MARGIN * 2);
// Adjust SNAP_INTERVAL to match the slide width plus right margin
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_MARGIN;

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

      console.log('[ImageCarousel] Fetching banners from Supabase');

      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('[ImageCarousel] Supabase error:', error);
        throw new Error('Failed to fetch banners');
      }

      setImages(data || []);
    } catch (err) {
      console.error('[ImageCarousel] Error fetching banners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load banners');
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
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };

  const isWeb = Platform.OS === 'web';
  const CarouselComponent = isWeb ? ScrollView : Animated.ScrollView;

  if (isLoading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading banners...</Text>
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
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.placeholderText}>No banners available</Text>
      </View>
    );
  }

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
        contentContainerStyle={{ paddingHorizontal: SLIDE_MARGIN }}
        {...(!isWeb && {
          onScroll: scrollHandler,
        })}
        decelerationRate="fast"
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
              onError={() =>
                console.error('[ImageCarousel] Image failed to load:', image.image_url)
              }
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
              currentIndex={currentIndex}
              scrollX={scrollX}
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
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: SLIDE_MARGIN,
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
    gap: 8,
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
    marginTop: 8,
    color: '#666',
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
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
});