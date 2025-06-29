import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Pressable, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { Link } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  interpolate, 
  withTiming 
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

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
}

interface BannerCarouselProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPagination?: boolean;
  showOverlay?: boolean;
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BannerCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  showOverlay = true,
  height = 200
}: BannerCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/banners');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch banners: ${response.status}`);
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
        setLoading(false);
      }
    };
    
    fetchBanners();
  }, []);

  // Set up auto-play
  useEffect(() => {
    if (autoPlay && banners.length > 1 && !loading && !error) {
      startAutoPlay();
    }
    
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, banners.length, loading, error]);

  const startAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
    
    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true
      });
    }, autoPlayInterval);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const newIndex = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(newIndex);
    },
  });

  // If there are no banners or only one, don't render the carousel
  if (banners.length === 0 && !loading) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
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
        contentContainerStyle={styles.scrollContent}
      >
        {banners.map((banner, index) => (
          <View key={banner.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <Image
              source={{ uri: banner.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
            
            {showOverlay && (
              <View style={styles.overlay}>
                <View style={styles.textContainer}>
                  <Text style={styles.title}>{banner.title}</Text>
                  {banner.description && (
                    <Text style={styles.description}>{banner.description}</Text>
                  )}
                  
                  {banner.cta_text && banner.link_url && (
                    <Link href={banner.link_url} asChild>
                      <Pressable style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
                        <Text style={styles.ctaButtonText}>{banner.cta_text}</Text>
                      </Pressable>
                    </Link>
                  )}
                </View>
                
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>Planmoni</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </Animated.ScrollView>
      
      {showPagination && banners.length > 1 && (
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
                [8, 24, 8],
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
                : `${colors.primary}80`;
              
              return {
                width: withTiming(width, { duration: 300 }),
                opacity: withTiming(opacity, { duration: 300 }),
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
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    marginVertical: 16,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ctaButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
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
  errorText: {
    textAlign: 'center',
  },
});