import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
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
  image_url: string;
  title?: string;
  description?: string | null;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
}

interface BannerCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  height?: number;
}

export default function BannerCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  height = 116,
}: BannerCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { width: screenWidth } = Dimensions.get('window');
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[BannerCarousel] Fetching banners');
      
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('[BannerCarousel] Supabase error:', error);
        throw error;
      }
      
      console.log(`[BannerCarousel] Successfully fetched ${data?.length || 0} banners`);
      setBanners(data || []);
    } catch (err) {
      console.error('[BannerCarousel] Fetch error:', err);
      setError('Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlay && banners.length > 1 && !isLoading) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % banners.length;
        scrollToIndex(nextIndex);
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [banners, currentIndex, isLoading]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ x: index * (screenWidth - 32), animated: true });
      setCurrentIndex(index);
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.x / (screenWidth - 32));
      setCurrentIndex(index);
    },
  });

  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) router.push(banner.link_url);
  };

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
        <Pressable style={styles.retryButton} onPress={fetchBanners}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (banners.length === 0) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Text style={styles.placeholderText}>No banners available</Text>
      </View>
    );
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
        snapToInterval={screenWidth - 32}
        snapToAlignment="center"
        contentContainerStyle={styles.carouselContent}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => handleBannerPress(banner)}
            style={[styles.slide, { width: screenWidth - 40 }]}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={[styles.image, { height }]}
              resizeMode="cover"
              onError={(e) => console.error('[BannerCarousel] Image failed to load:', banner.image_url, e.nativeEvent.error)}
            />
            {banner.title && (
              <View style={styles.captionContainer}>
                <Text style={styles.captionTitle}>{banner.title}</Text>
                {banner.description && (
                  <Text style={styles.captionDescription}>{banner.description}</Text>
                )}
                {banner.cta_text && (
                  <View style={styles.ctaButton}>
                    <Text style={styles.ctaText}>{banner.cta_text}</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </CarouselComponent>

      {showPagination && banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              scrollX={scrollX}
              screenWidth={screenWidth - 32}
              isDark={isDark}
              color={colors.primary}
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
  carouselContent: {
    paddingHorizontal: 4,
  },
  slide: {
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 16,
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
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  captionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  captionDescription: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  ctaButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
});