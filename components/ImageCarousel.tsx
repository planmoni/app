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
const SLIDE_MARGIN = 16;
const SLIDE_WIDTH = screenWidth - SLIDE_MARGIN * 2;
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_MARGIN;

export default function ImageCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  height = 150,
  images: propImages,
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<Banner[]>(propImages || []);
  const [isLoading, setIsLoading] = useState(!propImages);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!propImages) {
      fetchImages();
    }
  }, [propImages]);

  useEffect(() => {
    if (propImages) {
      setImages(propImages);
      setIsLoading(false);
    }
  }, [propImages]);

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
        {images.map((image) => (
          <Pressable
            key={image.id}
            onPress={() => handleImagePress(image)}
            style={[styles.slide, { width: SLIDE_WIDTH }]}
          >
            <Image
              source={{ uri: image.image_url }}
              style={[styles.image, { height }]}
              resizeMode="fit"
              width={510}
              height={150}
              onError={() =>
                console.error('[ImageCarousel] Image failed to load:', image.image_url)
              }
            />
            
          </Pressable>
        ))}
      </CarouselComponent>

      {showPagination && images.length > 1 && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <PaginationDot
              key={index}d
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
    paddingHorizontal: 10,
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
});