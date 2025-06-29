import React, { useEffect, useRef, useState } from 'react';
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
import { useSharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import PaginationDot from './PaginationDot';

interface Banner {
  id: string;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
}

interface ImageCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  showControls?: boolean;
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
  showControls = false,
  height = 140,
}: ImageCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create animated value for pagination
  const animatedIndex = useSharedValue(0);
  
  // Update animated index when current index changes
  useAnimatedReaction(
    () => currentIndex,
    (current) => {
      animatedIndex.value = current;
    }
  );

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('order_index', { ascending: true });

        if (error) throw error;
        setBanners(data || []);
      } catch (err) {
        console.error('Error fetching banners:', err);
        setError(err instanceof Error ? err.message : 'Failed to load banners');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Preload image dimensions
  useEffect(() => {
    banners.forEach((banner) => {
      if (!imageSizes[banner.id] && banner.image_url) {
        Image.getSize(
          banner.image_url,
          (width, height) => {
            setImageSizes((prev) => ({ ...prev, [banner.id]: { width, height } }));
          },
          (error) => console.error(`Failed to get image size for ${banner.image_url}:`, error)
        );
      }
    });
  }, [banners]);

  useEffect(() => {
    if (autoPlay && banners.length > 1 && !isLoading) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % banners.length;
        scrollToIndex(nextIndex);
        setCurrentIndex(nextIndex);
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, banners, currentIndex, isLoading]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SNAP_INTERVAL,
        animated: true,
      });
    }
  };

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SNAP_INTERVAL);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < banners.length) {
      setCurrentIndex(newIndex);
    }
  };

  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => ({
      ...prev,
      [id]: true
    }));
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={{ color: colors.error }}>{error}</Text>
      </View>
    );
  }

  if (banners.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SLIDE_MARGIN }]}
      >
        {banners.map((banner) => {
          const naturalSize = imageSizes[banner.id];
          const scaledHeight = naturalSize
            ? (naturalSize.height / naturalSize.width) * SLIDE_WIDTH
            : height;
          const isLoaded = loadedImages[banner.id];

          return (
            <Pressable
              key={banner.id}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
              onPress={() => handleBannerPress(banner)}
            >
              {!isLoaded && (
                <View style={[styles.imagePlaceholder, { height: scaledHeight }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              <Image
                source={{ uri: banner.image_url }}
                style={[
                  styles.image, 
                  { height: scaledHeight, opacity: isLoaded ? 1 : 0 }
                ]}
                resizeMode="cover"
                onLoad={() => handleImageLoad(banner.id)}
                onError={() => console.warn('Failed to load image:', banner.image_url)}
                // Add caching for better performance
                cachePolicy="memory-disk"
                // Progressive loading for web
                {...(Platform.OS === 'web' ? { loading: 'lazy' } : {})}
              />
              {banner.cta_text && (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionTitle}>{banner.cta_text}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {showPagination && banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              currentIndex={currentIndex}
              scrollX={animatedIndex}
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
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 0,
    backgroundColor: '#ccc',
    position: 'relative',
  },
  image: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#ccc',
  },
  imagePlaceholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
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