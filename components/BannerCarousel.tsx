import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Pressable, 
  Dimensions, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  interpolate, 
  withTiming 
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

// Define the Banner type
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

interface BannerCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  showControls?: boolean;
  height?: number;
}

export default function BannerCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  showControls = false,
  height = 180
}: BannerCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { width: screenWidth } = Dimensions.get('window');
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch banners from the API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/banners');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch banners: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch banners');
        }
        
        setBanners(data.banners || []);
      } catch (err) {
        console.error('Error fetching banners:', err);
        setError(err instanceof Error ? err.message : 'Failed to load banners');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBanners();
  }, []);
  
  // Set up auto-play
  useEffect(() => {
    if (autoPlay && banners.length > 1 && !isLoading) {
      startAutoPlay();
    }
    
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, banners.length, isLoading]);
  
  const startAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
    
    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      scrollToIndex(nextIndex);
    }, autoPlayInterval);
  };
  
  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: index * screenWidth, animated: true });
      setCurrentIndex(index);
    }
  };
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const newIndex = Math.round(event.contentOffset.x / screenWidth);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    },
  });
  
  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { height, backgroundColor: colors.backgroundTertiary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <View style={[styles.container, { height, backgroundColor: colors.backgroundTertiary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }
  
  // Render empty state
  if (banners.length === 0) {
    return null;
  }
  
  return (
    <View style={[styles.container, { height }]}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {banners.map((banner) => (
          <Pressable 
            key={banner.id} 
            style={[styles.slide, { width: screenWidth - 32 }]}
            onPress={() => handleBannerPress(banner)}
          >
            <Image 
              source={{ uri: banner.image_url }} 
              style={styles.image}
              resizeMode="cover"
            />
            <View style={[
              styles.overlay, 
              { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }
            ]}>
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: '#FFFFFF' }]}>{banner.title}</Text>
                {banner.description && (
                  <Text style={[styles.description, { color: '#FFFFFF' }]}>
                    {banner.description}
                  </Text>
                )}
                {banner.cta_text && (
                  <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
                    <Text style={styles.ctaText}>{banner.cta_text}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </Animated.ScrollView>
      
      {showPagination && banners.length > 1 && (
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
                [8, 24, 8],
                'clamp'
              );
              
              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.5, 1, 0.5],
                'clamp'
              );
              
              const backgroundColor = isDark ? '#FFFFFF' : colors.primary;
              
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    justifyContent: 'flex-end',
  },
  textContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ctaButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});