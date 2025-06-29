import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Pressable, 
  ActivityIndicator,
  FlatList,
  useWindowDimensions
} from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler,
  interpolate,
  useAnimatedStyle
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import Constants from 'expo-constants';

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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function BannerCarousel() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch banners from the API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get the API base URL from environment variables
        const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || '';
        const endpoint = `${apiUrl}/api/banners`;
        
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch banners: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.banners) {
          setBanners(data.banners);
        } else {
          throw new Error(data.error || 'Failed to fetch banners');
        }
      } catch (err) {
        console.error('Error fetching banners:', err);
        setError(err instanceof Error ? err.message : 'Failed to load banners');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBanners();
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const startAutoScroll = () => {
      autoScrollTimer.current = setInterval(() => {
        if (flatListRef.current) {
          const nextIndex = (activeIndex + 1) % banners.length;
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true
          });
          setActiveIndex(nextIndex);
        }
      }, 5000); // Change slide every 5 seconds
    };
    
    startAutoScroll();
    
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [banners.length, activeIndex]);

  // Handle scroll events
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const newIndex = Math.round(event.contentOffset.x / width);
      setActiveIndex(newIndex);
    },
  });

  // Handle banner press
  const handleBannerPress = (banner: Banner) => {
    if (banner.link_url) {
      router.push(banner.link_url);
    }
  };

  // Render banner item
  const renderBanner = ({ item }: { item: Banner }) => {
    return (
      <Pressable 
        style={[styles.bannerItem, { width }]} 
        onPress={() => handleBannerPress(item)}
      >
        <Image 
          source={{ uri: item.image_url }} 
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={[styles.bannerContent, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }]}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>{item.title}</Text>
          {item.description && (
            <Text style={[styles.bannerDescription, { color: colors.textSecondary }]}>
              {item.description}
            </Text>
          )}
          {item.cta_text && (
            <Pressable 
              style={[styles.ctaButton, { backgroundColor: colors.primary }]}
              onPress={() => handleBannerPress(item)}
            >
              <Text style={styles.ctaButtonText}>{item.cta_text}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  // Render pagination dots
  const renderPaginationDots = () => {
    return (
      <View style={styles.pagination}>
        {banners.map((_, index) => {
          const dotStyle = useAnimatedStyle(() => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
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
            
            return {
              width,
              opacity,
              backgroundColor: index === activeIndex ? colors.primary : colors.border,
            };
          });
          
          return (
            <Animated.View
              key={index}
              style={[styles.paginationDot, dotStyle]}
            />
          );
        })}
      </View>
    );
  };

  // If loading, show a loading indicator
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If error, show error message
  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  // If no banners, don't render anything
  if (banners.length === 0) {
    return null;
  }

  // Render the carousel
  return (
    <View style={styles.container}>
      <AnimatedFlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      />
      {banners.length > 1 && renderPaginationDots()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  bannerItem: {
    position: 'relative',
    height: '100%',
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
    marginBottom: 12,
  },
  ctaButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    gap: 8,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
});