import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions, Platform, Modal } from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef } from 'react';

// Slide Item Component
function SlideItem({ 
  slide, 
  index, 
  width, 
  scrollX, 
  styles, 
  isDark 
}: { 
  slide: any; 
  index: number; 
  width: number; 
  scrollX: SharedValue<number>; 
  styles: any; 
  isDark: boolean;
}) {
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
      [30, 0, 30],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
      opacity,
    };
  });

  return (
    <Animated.View 
      style={[
        styles.slide, 
        { width },
        animatedStyle
      ]}
    >
      {slide.id === '1' ? (
        <View style={styles.introSlideContent}>
          <Text style={styles.introWelcomeText}>Welcome to</Text>
          <Image
            source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
            style={styles.introLogo}
            resizeMode="contain"
          />
          <Image
            source={isDark ? require('@/assets/images/award-light.png') : require('@/assets/images/award-dark.png')}
            style={styles.introAwardImage}
            resizeMode="contain"
          />
          <Image
            source={isDark ? require('@/assets/images/partnership-light.png') : require('@/assets/images/partnership-dark.png')}
            style={styles.introPartnershipImage}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={styles.slideContent}>
          <View style={styles.textContainer}>
            <View style={styles.titleSection}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
            </View>
            
            {slide.description && (
              <Text style={styles.slideDescription}>{slide.description}</Text>
            )}
          </View>

          <View style={styles.imageContainer}>
            {slide.showLogo ? (
              <Image 
                source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : slide.rawImage ? (
              <Image 
                source={slide.image}
                style={styles.slideImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[
                styles.imageBackground,
                { backgroundColor: slide.accentColor + '20' }
              ]}>
                <Image 
                  source={slide.image}
                  style={styles.slideImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// Pagination Dot Component
function PaginationDot({ 
  index, 
  width, 
  scrollX, 
  currentIndex, 
  colors, 
  styles,
  slides
}: { 
  index: number; 
  width: number; 
  scrollX: SharedValue<number>; 
  currentIndex: number; 
  colors: any; 
  styles: any;
  slides: typeof SLIDES;
}) {
  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];

  const animatedDotStyle = useAnimatedStyle(() => {
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
      style={[
        styles.paginationDot,
        animatedDotStyle,
        {
          backgroundColor: index === currentIndex 
            ? colors.primary
            : colors.borderSecondary
        }
      ]}
    />
  );
}

const SLIDES = [
  
  {
    id: '1',
    title: 'Welcome to Financial Control',
    description: "Turn your one-time funds into regular auto payouts, create a consistent cash flow that sorts everyday expenses.",
    image: require('@/assets/images/StayInControl.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '2',
    title: 'Secure your money in vaults, access them when due',
    description: '',
    image: require('@/assets/images/Slide 2.png'),
    gradient: ['#059669', '#10B981'],
    accentColor: '#34D399',
    rawImage: true,
  },
  {
    id: '3',
    title: 'Plan your every money move',
    description: '',
    image: require('@/assets/images/Slide 3.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
    rawImage: true,
  },
  {
    id: '4',
    title: 'Create payouts, control timing',
    description: '',
    image: require('@/assets/images/Slide 4.png'),
    gradient: ['#7C3AED', '#A855F7'],
    accentColor: '#C084FC',
    rawImage: true,
  },
  {
    id: '5',
    title: 'Timely payouts, 24/7/365',
    description: '',
    image: require('@/assets/images/Slide 5.png'),
    gradient: ['#EC4899', '#F97316'],
    accentColor: '#F9A8D4',
    rawImage: true,
  },
  {
    id: '6',
    title: 'Join thousands of users who love Planmoni',
    description: '',
    image: require('@/assets/images/Slide 6.png'),
    gradient: ['#0EA5E9', '#2563EB'],
    accentColor: '#7DD3FC',
    rawImage: true,
  },
];

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
  showButtons?: boolean; // Deprecated - buttons are now always visible
}

export default function WelcomeModal({ isVisible, onClose, showButtons = false }: WelcomeModalProps) {
  const { width, height } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const resetScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);

  const modalHeight = height * 0.9;

  // Reset scroll position and index when modal opens
  useEffect(() => {
    if (isVisible) {
      // Reset to first slide
      setCurrentIndex(0);
      scrollX.value = 0;
      setIsNavigating(false); // Reset navigation state when modal opens
      isClosingRef.current = false;
      // Small delay to ensure ScrollView is mounted
      if (resetScrollTimerRef.current) {
        clearTimeout(resetScrollTimerRef.current);
      }
      resetScrollTimerRef.current = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      }, 100);
    }
    return () => {
      if (resetScrollTimerRef.current) {
        clearTimeout(resetScrollTimerRef.current);
        resetScrollTimerRef.current = null;
      }
    };
  }, [isVisible]);

  const handleClose = () => {
    // Prevent repeated close events while modal is dismissing.
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
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

  const handleSignUp = () => {
    if (isNavigating) return; // Prevent multiple clicks
    setIsNavigating(true);
    handleClose();
    // Add a small delay to ensure modal closes before navigation
    setTimeout(() => {
      router.push('/(auth)/onboarding/first-name');
    }, 300);
  };

  const handleSignIn = () => {
    if (isNavigating) return; // Prevent multiple clicks
    setIsNavigating(true);
    handleClose();
    // Add a small delay to ensure modal closes before navigation
    setTimeout(() => {
      router.push('/(auth)/login');
    }, 300);
  };

  const isSmallScreen = height < 700;
  const isAndroid = Platform.OS === 'android';
  
  const platformMultiplier = isAndroid ? 0.8 : 1.0;
  const marginMultiplier = isAndroid ? 0.7 : 1.0;
  
  const imageHeight = Math.min(modalHeight * 0.4 * platformMultiplier, 215);
  const verticalPadding = (isSmallScreen ? 16 : 20) * marginMultiplier;
  const titleSize = (isSmallScreen ? 24 : 30) * platformMultiplier;
  const descriptionSize = (isSmallScreen ? 13 : 15) * platformMultiplier;

  const styles = createStyles(colors, isDark, {
    imageHeight,
    verticalPadding,
    titleSize,
    descriptionSize,
    modalHeight,
    width,
    isAndroid,
  });

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.text} />
          </Pressable>

          {/* Slider Container */}
          <View style={styles.sliderContainer}>
            <Animated.ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                setCurrentIndex(newIndex);
              }}
              style={styles.slider}
              contentContainerStyle={styles.sliderContent}
            >
              {SLIDES.map((slide, index) => (
                <SlideItem
                  key={slide.id}
                  slide={slide}
                  index={index}
                  width={width}
                  scrollX={scrollX}
                  styles={styles}
                  isDark={isDark}
                />
              ))}
            </Animated.ScrollView>
          </View>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {SLIDES.map((_, index) => (
              <PaginationDot
                key={index}
                index={index}
                width={width}
                scrollX={scrollX}
                currentIndex={currentIndex}
                colors={colors}
                styles={styles}
                slides={SLIDES}
              />
            ))}
          </View>

          {/* Footer Buttons */}
          <BlurView intensity={2} tint={isDark ? 'dark' : 'light'} style={styles.footer}>
            <View style={styles.footerContent}>
              <Pressable
                style={styles.signInButton}
                onPress={handleSignIn}
                disabled={isNavigating}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </Pressable>
              <Pressable
                style={[styles.signUpButton, {
                  backgroundColor: colors.primary,
                  opacity: isNavigating ? 0.6 : 1
                }]}
                onPress={handleSignUp}
                disabled={isNavigating}
              >
                <Text style={styles.signUpButtonText}>Sign Up</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, responsive: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    height: responsive.modalHeight,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 16 : 12,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  logoContainer: {
    paddingTop: responsive.verticalPadding * 2,
    paddingBottom: responsive.verticalPadding,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 140,
    height: 35,
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: responsive.verticalPadding,
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
  imageContainer: {
    marginBottom: responsive.verticalPadding * 0.5,
    alignItems: 'center',
  },
  imageBackground: {
    borderRadius: 20,
    padding: responsive.verticalPadding * 0.8,
  },
  slideImage: {
    width: responsive.width * 1.55,
    height: responsive.imageHeight * 1.9,
  },
  logoImage: {
    width: responsive.width * 0.6,
    height: responsive.imageHeight * 1.5,
  },
  introSlideContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.verticalPadding,
  },
  introWelcomeText: {
    fontSize: Platform.OS === 'ios' ? 26 : 24,
    // lineHeight: Platform.OS === 'ios' ? 42 : 38,
    fontWeight: '700',
    color: colors.text,
    marginBottom: -16,
    marginTop: 70,
    textAlign: 'center',
  },
  introLogo: {
    width: responsive.width * 0.5,
    height: responsive.imageHeight * 0.44,
    marginBottom: 1,
  },
  introAwardImage: {
    width: responsive.width * 0.44,
    height: responsive.imageHeight * 0.96,
    marginBottom: 10,
  },
  introPartnershipImage: {
    width: responsive.width * 0.5,
    height: responsive.imageHeight * 0.56,
    marginTop: 20,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: responsive.verticalPadding,
  },
  titleSection: {
    marginTop: responsive.verticalPadding * 0.5,
    alignItems: 'center',
    marginBottom: responsive.verticalPadding * 0.8,
  },
  slideTitle: {
    marginTop: 60,
    fontWeight: '700',
    fontSize: Platform.OS === 'ios' ? responsive.titleSize : responsive.titleSize * 1.5,
    lineHeight: Platform.OS === 'ios' ? responsive.titleSize * 1.1 : responsive.titleSize * 1.5,
    letterSpacing: -0.9,
    maxWidth: '90%',
    color: isDark ? colors.text : colors.text,
    textAlign: 'center',
  },
  slideDescription: {
    color: colors.text,
    textAlign: 'center',
    fontSize: Platform.OS === 'ios' ? responsive.descriptionSize * 0.8: responsive.descriptionSize * 1.2,
    lineHeight: Platform.OS === 'ios' ? responsive.descriptionSize * 1.4 : responsive.descriptionSize * 1.5,
    maxWidth: '90%',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: responsive.verticalPadding * 0.8,
    paddingHorizontal: responsive.verticalPadding,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 4,
    marginHorizontal: 1,
    marginBottom: 20,
  },
  footer: {
    paddingTop: responsive.verticalPadding,
    paddingBottom: responsive.verticalPadding * 3.5,
    paddingHorizontal: responsive.verticalPadding,
  },
  footerContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: Platform.OS === 'ios' ? 56 : 50,
    borderRadius: 16,
    paddingHorizontal: 24,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signUpButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Platform.OS === 'ios' ? 56 : 50,
    borderRadius: 16,
    paddingHorizontal: 24,
    flex: 1,
    borderWidth: 2,
    borderColor: isDark ? '#fff' : colors.primary,
  },
  signInButtonText: {
    color: isDark ? '#fff' : colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  flagIcon: {
    fontSize: 16,
  },
  availabilityText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '400',
  },
});

