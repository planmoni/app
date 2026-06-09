import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import FastImageImport from 'react-native-fast-image';
import { Image } from 'react-native';
// FastImage may not be available in all environments; cast to any for static usage and JSX
const FastImage: any = FastImageImport;
import { router } from 'expo-router';
import { useAnimatedReaction, useSharedValue } from '@/lib/reanimatedSafe';
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
  showControls?: boolean;
  height?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDE_MARGIN = 16;
const SLIDE_WIDTH = screenWidth - 2 * SLIDE_MARGIN;
const SNAP_INTERVAL = SLIDE_WIDTH + 2 * SLIDE_MARGIN;

export default function BannerCarousel({
  autoPlay = true,
  autoPlayInterval = 5000,
  showPagination = true,
  showControls = false,
  height = 140,
}: BannerCarouselProps) {
  const { colors, isDark } = useTheme();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoadedMap, setImageLoadedMap] = useState<Record<string, boolean>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const animatedIndex = useSharedValue(0);

  useAnimatedReaction(
    () => currentIndex,
    (current) => {
      animatedIndex.value = current;
    }
  );

  useEffect(() => {
    const fetchAndPrefetch = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .order('order_index', { ascending: true });
        if (error) throw error;
        const bannersData = data || [];
        setBanners(bannersData);

        if (FastImage && typeof FastImage.preload === 'function') {
          await Promise.all(
            bannersData.map((banner: Banner) =>
              FastImage.preload([
                {
                  uri: banner.image_url,
                },
              ])
            )
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load banners');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndPrefetch();
  }, []);

  useEffect(() => {
    if (autoPlay && banners.length > 1 && !isLoading) {
      // cast setInterval return to environment-agnostic ReturnType<typeof setInterval>
      autoPlayTimerRef.current = (setInterval(() => {
        const nextIndex = (currentIndex + 1) % banners.length;
        scrollToIndex(nextIndex);
        setCurrentIndex(nextIndex);
      }, autoPlayInterval) as unknown) as ReturnType<typeof setInterval>;
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
          const imageLoaded = imageLoadedMap[banner.id];

          return (
            <Pressable
              key={banner.id}
              style={[styles.slide, { width: SLIDE_WIDTH }]}
              onPress={() => handleBannerPress(banner)}
            >
              {!imageLoaded && (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              {FastImage ? (
                <FastImage
                  source={{ uri: banner.image_url }}
                  style={styles.image}
                  resizeMode={FastImage.resizeMode?.cover || 'cover'}
                  onLoad={() =>
                    setImageLoadedMap((prev) => ({
                      ...prev,
                      [banner.id]: true,
                    }))
                  }
                  onError={() => {
                    console.warn('Failed to load image:', banner.image_url);
                    setImageLoadedMap((prev) => ({
                      ...prev,
                      [banner.id]: true,
                    }));
                  }}
                />
              ) : (
                // Fallback to a simple Image if FastImage isn't available
                <Image
                  source={{ uri: banner.image_url }}
                  style={styles.image}
                  resizeMode={'cover'}
                  onLoad={() =>
                    setImageLoadedMap((prev) => ({
                      ...prev,
                      [banner.id]: true,
                    }))
                  }
                  onError={() => {
                    console.warn('Failed to load image:', banner.image_url);
                    setImageLoadedMap((prev) => ({
                      ...prev,
                      [banner.id]: true,
                    }));
                  }}
                />
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
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    zIndex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
});
