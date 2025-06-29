import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  interpolate,
  withTiming
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';

// Define banner type
interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_ASPECT_RATIO = 2.1; // 2.1:1 aspect ratio for banners

export default function BannerCarousel() {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

  // Calculate banner height based on screen width and aspect ratio
  const bannerHeight = SCREEN_WIDTH / BANNER_ASPECT_RATIO;

  // Fetch banners from API
  useEffect(() => {
    fetchBanners();
    return () => {
      // Clear auto-scroll timer on unmount
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, []);

  // Set up auto-scrolling
  useEffect(() => {
    if (banners.length > 1) {
      startAutoScroll();
    }
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [banners]);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch banners from API
      const response = await fetch('/api/banners');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setBanners(data.banners || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError('Error fetching banners: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const startAutoScroll = () => {
    // Clear any existing timer
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
    
    // Set up auto-scrolling every 5 seconds
    autoScrollTimer.current = setInterval(() => {
      if (banners.length > 1) {
        const nextIndex = (currentIndex + 1) % banners.length;
        scrollViewRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
        setCurrentIndex(nextIndex);
      }
    }, 5000);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const newIndex = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    },
  });

  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) {
      // Handle navigation to the link
      if (banner.link_url.startsWith('/')) {
        // Internal navigation
        router.push(banner.link_url);
      } else {
        // External link
        if (Platform.OS === 'web') {
          window.open(banner.link_url, '_blank');
        } else {
          // For native platforms, you would use Linking
          // Linking.openURL(banner.link_url);
        }
      }
    }
  };

  // If there are no banners and we're not loading, don't render anything
  if (banners.length === 0 && !isLoading) {
    return null;
  }

  const styles = createStyles(colors, isDark, bannerHeight);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
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
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {banners.map((banner) => (
          <Pressable 
            key={banner.id} 
            style={styles.bannerContainer}
            onPress={() => handleBannerPress(banner)}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.overlay}>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{banner.title}</Text>
                {banner.description && (
                  <Text style={styles.description}>{banner.description}</Text>
                )}
                {banner.cta_text && (
                  <View style={styles.ctaButton}>
                    <Text style={styles.ctaText}>{banner.cta_text}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </Animated.ScrollView>

      {/* Pagination dots */}
      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => {
            const dotStyle = useAnimatedStyle(() => {
              const inputRange = [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
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
              
              const backgroundColor = index === currentIndex 
                ? colors.primary 
                : colors.border;
              
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

const createStyles = (colors: any, isDark: boolean, bannerHeight: number) => StyleSheet.create({
  container: {
    marginBottom: 24,
    position: 'relative',
  },
  loadingContainer: {
    height: bannerHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 16,
    marginBottom: 24,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 16,
    marginBottom: 24,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    width: SCREEN_WIDTH,
    height: bannerHeight,
  },
  scrollContent: {
    height: bannerHeight,
  },
  bannerContainer: {
    width: SCREEN_WIDTH,
    height: bannerHeight,
    position: 'relative',
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: bannerHeight,
    borderRadius: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    borderRadius: 16,
  },
  textContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  ctaButton: {
    backgroundColor: colors.primary,
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
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});