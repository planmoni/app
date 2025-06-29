import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
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

interface BannerCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  height?: number;
}

export default function BannerCarousel({
  autoPlay = true,
  autoPlayInterval = 4000,
  showPagination = true,
  height = 140,
}: BannerCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { width: screenWidth } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .order('order_index', { ascending: true });

        if (error) throw error;
        setBanners(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (autoPlay && banners.length > 1 && !isLoading) {
      startAutoPlay();
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [autoPlay, banners.length, isLoading]);

  const startAutoPlay = () => {
    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      scrollToIndex(nextIndex);
    }, autoPlayInterval);
  };

  const scrollToIndex = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    setCurrentIndex(index);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { height }]}> 
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { height }]}> 
        <Text>{error}</Text>
      </View>
    );
  }

  if (banners.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}> 
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={Platform.OS !== 'web'}
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ width: screenWidth * banners.length }}
        style={{ width: '100%' }}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => banner.link_url && router.push(banner.link_url)}
            style={[styles.slide, { width: screenWidth - 40, height }]}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={styles.image}
              resizeMode="cover"
              onError={() => console.warn('Image failed to load:', banner.image_url)}
            />
          </Pressable>
        ))}
      </ScrollView>

      {showPagination && banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              scrollX={scrollX}
              screenWidth={screenWidth}
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
  slide: {
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
});