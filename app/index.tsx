import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Shield, Calendar, Wallet, TrendingUp, ArrowRight } from 'lucide-react-native';
import Button from '@/components/Button';
import PaginationDot from '@/components/PaginationDot';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';
import { useRef } from 'react';

const SLIDES = [
  {
    id: '1',
    title: 'Say hello to financial control',
    // subtitle: 'Smart Financial Planning',
    description: 'Take full control of your money by breaking your income into manageable payouts to ensure you never run out of money on time.',
    image: require('@/assets/images/StayInControl.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '2',
    title: 'Create Personalized\nSalary Plans',
    // subtitle: 'Automated Scheduling',
    description: 'Split deposits into scheduled weekly, bi-weekly or monthly payouts that work for your lifestyle.',
    image: require('@/assets/images/PayYourselfOnTime.png'),
    gradient: ['#059669', '#10B981'],
    accentColor: '#34D399',
  },
  {
    id: '3',
    title: 'Receive Stable\nIncome Flow',
    // subtitle: 'Financial Security',
    description: 'Secure your money, automate payouts & say goodbye to irregular income forever.',
    image: require('@/assets/images/SmartSavings.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '4',
    title: 'Build Healthy\nMoney Habits',
    // subtitle: 'Long-term Success',
    description: 'Automate discipline and achieve long-term financial goals effortlessly.',
    image: require('@/assets/images/BuildHealthyHabits.png'),
    gradient: ['#7C3AED', '#A855F7'],
    accentColor: '#C084FC',
  },
];

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const autoSlideTimerRef = useRef<number | NodeJS.Timeout | null>(null);

  // Redirect to tabs if user is already authenticated
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session]);

  // Auto-slide functionality
  useEffect(() => {
    const startAutoSlide = () => {
      autoSlideTimerRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % SLIDES.length;
          
          // Scroll to next slide
          scrollViewRef.current?.scrollTo({
            x: nextIndex * width,
            animated: true
          });
          
          return nextIndex;
        });
      }, 4000); // Change slide every 4 seconds
    };

    const stopAutoSlide = () => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    };

    // Start auto-slide
    startAutoSlide();

    // Cleanup on unmount
    return () => {
      stopAutoSlide();
    };
  }, [width]);

  // Handle manual scroll - pause auto-slide temporarily
  const handleScrollBegin = () => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  };

  const handleScrollEnd = () => {
    // Restart auto-slide after manual interaction
    setTimeout(() => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
      }
      autoSlideTimerRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % SLIDES.length;
          
          scrollViewRef.current?.scrollTo({
            x: nextIndex * width,
            animated: true
          });
          
          return nextIndex;
        });
      }, 6000);
    }, 2000); // Wait 2 seconds after manual interaction before resuming
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const newIndex = Math.round(event.contentOffset.x / width);
      runOnJS(setCurrentIndex)(newIndex);
    },
  });

  const handleGetStarted = () => {
    router.push('/(auth)/onboarding/first-name');
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  // Calculate responsive dimensions with platform-specific adjustments
  const isSmallScreen = height < 700;
  const isAndroid = Platform.OS === 'android';
  
  // Platform-specific adjustments
  const platformMultiplier = isAndroid ? 0.8 : 1.0; // Reduce sizes on Android
  const marginMultiplier = isAndroid ? 0.7 : 1.0; // Reduce margins on Android
  
  const imageHeight = Math.min(height * 0.35 * platformMultiplier, 230);
  const verticalPadding = (isSmallScreen ? 16 : 24) * marginMultiplier;
  const buttonHeight = (isSmallScreen ? 48 : 56) * platformMultiplier;
  const titleSize = (isSmallScreen ? 28 : 36) * platformMultiplier;
  const subtitleSize = (isSmallScreen ? 14 : 16) * platformMultiplier;
  const descriptionSize = (isSmallScreen ? 14 : 16) * platformMultiplier;

  const styles = createStyles(colors, isDark, {
    imageHeight,
    verticalPadding,
    buttonHeight,
    titleSize,
    subtitleSize,
    descriptionSize,
    height,
    width,
    isAndroid,
  });
  // Animated background style
  const backgroundStyle = useAnimatedStyle(() => {
    const currentSlide = Math.floor(scrollX.value / width);
    const progress = (scrollX.value % width) / width;

    // Use consistent blue gradient for all slides in dark mode
    const baseColor = isDark ? '#1E3A8A' : '#FFFFFF';
    const accentColor = isDark ? '#3B82F6' : '#FFFFFF';
    
    return {
      backgroundColor: interpolate(
        progress,
        [0, 1],
        [baseColor, accentColor],
        Extrapolate.CLAMP
      ),
    };
  });

  return (
    <View style={styles.container}>
      {isDark && <Animated.View style={[styles.backgroundGradient, backgroundStyle]} />}
      
      <View style={styles.logoContainer}>
        <Image 
          source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.sliderContainer}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onScrollBeginDrag={handleScrollBegin}
          onScrollEndDrag={handleScrollEnd}
          style={styles.slider}
          contentContainerStyle={styles.sliderContent}
        >
          {SLIDES.map((slide, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];

            const animatedStyle = useAnimatedStyle(() => {
              const scale = interpolate(
                scrollX.value,
                inputRange,
                [0.8, 1, 0.8],
                Extrapolate.CLAMP
              );
              
              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.3, 1, 0.3],
                Extrapolate.CLAMP
              );
              
              const translateY = interpolate(
                scrollX.value,
                inputRange,
                [50, 0, 50],
                Extrapolate.CLAMP
              );

              return {
                transform: [{ scale }, { translateY }],
                opacity,
              };
            });

            return (
              <Animated.View 
                key={slide.id} 
                style={[
                  styles.slide, 
                  { width },
                  animatedStyle
                ]}
              >
                <View style={styles.slideContent}>
                  <View style={styles.imageContainer}>
                    <View style={[
                      styles.imageBackground,
                      { backgroundColor: slide.accentColor + '20' }
                    ]}>
                      <Image 
                        source={slide.image}
                        style={[
                          styles.slideImage,
                          index === 0 && styles.firstSlideImage
                        ]}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                  
                  <View style={styles.textContainer}>
                    <View style={styles.titleSection}>
                      <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                      <Text style={styles.slideTitle}>{slide.title}</Text>
                    </View>
                    
                    <Text style={styles.slideDescription}>{slide.description}</Text>
                    
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </View>

      <BlurView intensity={2} tint={isDark ? 'dark' : 'light'} style={styles.footer}>
        {/* Pagination Dots - moved above buttons */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => {
            const animatedDotStyle = useAnimatedStyle(() => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];

              const scale = interpolate(
                scrollX.value,
                inputRange,
                [0.8, 1.2, 0.8],
                Extrapolate.CLAMP
              );

              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.4, 1, 0.4],
                Extrapolate.CLAMP
              );

              return {
                transform: [{ scale }],
                opacity,
              };
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.paginationDot,
                  animatedDotStyle,
                  {
                    backgroundColor: index === currentIndex 
                      ? (currentIndex === SLIDES.length - 1 
                          ? colors.primary 
                          : SLIDES[currentIndex]?.accentColor || colors.primary)
                      : colors.border
                  }
                ]}
              />
            );
          })}
        </View>

        <View style={styles.footerContent}>
          <Pressable
            style={styles.signInButton}
            onPress={handleSignIn}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={[styles.getStartedButton, {
              backgroundColor: colors.primary
            }]}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, responsive: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? colors.background : '#FFFFFF',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: responsive.verticalPadding * 3.1,
  },
  slider: {
    flex: 1,
  },
  sliderContent: {
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.verticalPadding,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
  },
  logoContainer: {
    paddingTop: responsive.verticalPadding * 3,
    paddingBottom: responsive.verticalPadding,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 160,
    height: 40,
  },
  imageContainer: {
    marginBottom: responsive.verticalPadding * 0.1,
    alignItems: 'center',
  },
  imageBackground: {
    borderRadius: 24,
    padding: responsive.verticalPadding,
  },
  slideImage: {
    width: responsive.width * 0.6,
    height: responsive.imageHeight * 1.0,
  },
  firstSlideImage: {
    width: responsive.width * 0.6,
    height: responsive.imageHeight * 1.0,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: responsive.verticalPadding,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: responsive.verticalPadding,
  },
  slideSubtitle: {
    fontSize: responsive.subtitleSize,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontWeight: '800',
    fontSize: responsive.titleSize,
    lineHeight: responsive.titleSize * 1.1,
    letterSpacing: -0.5,
    color: isDark ? colors.text : colors.primary,
    textAlign: 'center',
  },
  slideDescription: {
    color: colors.text,
    textAlign: 'center',
    fontSize: responsive.descriptionSize,
    lineHeight: responsive.descriptionSize * 1.6,
    marginBottom: responsive.verticalPadding * 3.4,
    maxWidth: '90%',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: responsive.verticalPadding,
    paddingHorizontal: responsive.verticalPadding,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: responsive.verticalPadding,
    paddingBottom: responsive.verticalPadding * 2.0,
    paddingHorizontal: responsive.verticalPadding,
  },
  footerContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 60,
    borderRadius: 100,
    paddingHorizontal: 24,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 100,
    paddingHorizontal: 24,
    flex: 1,
    borderWidth: 2,
    borderColor: colors.buttonPrimary,
  },
  signInButtonText: {
    color: colors.buttonTextPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});