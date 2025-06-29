import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

type Banner = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
};

export default function BannerCarousel() {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const { width: screenWidth } = Dimensions.get('window');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  useEffect(() => {
    // Auto-scroll banners every 5 seconds
    if (banners.length > 1) {
      timerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % banners.length;
        setCurrentIndex(nextIndex);
        scrollViewRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
      }, 5000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentIndex, banners.length, screenWidth]);

  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the correct API URL based on environment
      const apiUrl = `${process.env.VITE_SUPABASE_URL || ''}/api/banners?active=true`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data.banners) {
        setBanners(data.banners);
      } else {
        setBanners([]);
      }
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.x / screenWidth);
      setCurrentIndex(index);
    },
  });

  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundTertiary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.backgroundTertiary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
        <Pressable 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={fetchBanners}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (banners.length === 0) {
    return null; // Don't render anything if there are no banners
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            style={[styles.bannerContainer, { width: screenWidth - 32 }]}
            onPress={() => handleBannerPress(banner)}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={[styles.bannerContent, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>{banner.title}</Text>
              {banner.description && (
                <Text style={[styles.bannerDescription, { color: colors.textSecondary }]}>
                  {banner.description}
                </Text>
              )}
              {banner.cta_text && (
                <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.ctaButtonText}>{banner.cta_text}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </Animated.ScrollView>

      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => {
            const dotStyle = useAnimatedStyle(() => {
              const inputRange = [
                (index - 1) * screenWidth,
                index * screenWidth,
                (index + 1) * screenWidth,
              ];
              
              const width = interpolate(
                scrollX.value,
                inputRange,
                [8, 16, 8],
                'clamp'
              );
              
              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.5, 1, 0.5],
                'clamp'
              );
              
              const backgroundColor = currentIndex === index ? colors.primary : colors.border;
              
              return {
                width: withTiming(width, { duration: 200 }),
                opacity: withTiming(opacity, { duration: 200 }),
                backgroundColor,
              };
            });
            
            return (
              <Animated.View
                key={index}
                style={[styles.dot, dotStyle]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  loadingContainer: {
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bannerContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});