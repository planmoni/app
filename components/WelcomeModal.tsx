import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions, Platform, Modal } from 'react-native';
import { router } from 'expo-router';
import {
  Animated,
  Extrapolate,
  interpolate,
  runOnJS,
  SharedValue,
  reanimatedAvailable,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from '@/lib/reanimatedSafe';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useRef } from 'react';

const WELCOME_IMAGES = {
  logoDark: require('../assets/images/logo-dark.png'),
  logoLight: require('../assets/images/logo-light.png'),
  awardDark: require('../assets/images/award-dark.png'),
  awardLight: require('../assets/images/award-light.png'),
  partnershipDark: require('../assets/images/partnership-dark.png'),
  partnershipLight: require('../assets/images/partnership-light.png'),
  slide2: require('../assets/images/slide-2.png'),
  slide3: require('../assets/images/slide-3.png'),
  slide4: require('../assets/images/slide-4.png'),
  slide5: require('../assets/images/slide-5.png'),
  slide6: require('../assets/images/slide-6.png'),
} as const;

// Slide Item Component
function SlideItem({ 
  slide, 
  index, 
  width,
  slideHeight,
  scrollX, 
  styles, 
  isDark 
}: { 
  slide: any; 
  index: number; 
  width: number;
  slideHeight: number;
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
    if (!reanimatedAvailable) {
      return {
        opacity: 1,
        transform: [{ scale: 1 }, { translateY: 0 }],
      };
    }

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
        { width, height: slideHeight },
        animatedStyle
      ]}
    >
      {slide.id === '1' ? (
        <View style={[styles.introSlideContent, { height: slideHeight }]}>
          <View style={styles.introBrandBlock}>
            <Text style={styles.introWelcomeText}>Welcome to</Text>
            <Image
              source={isDark ? WELCOME_IMAGES.logoDark : WELCOME_IMAGES.logoLight}
              style={styles.introLogo}
              resizeMode="contain"
            />
          </View>

          <Image
            source={isDark ? WELCOME_IMAGES.awardLight : WELCOME_IMAGES.awardDark}
            style={styles.introAwardImage}
            resizeMode="contain"
          />

          <View style={styles.introPartnershipBlock}>
            <Image
              source={isDark ? WELCOME_IMAGES.partnershipLight : WELCOME_IMAGES.partnershipDark}
              style={styles.introPartnershipImage}
              resizeMode="contain"
            />
          </View>
        </View>
      ) : (
        <View style={[styles.slideContent, { height: slideHeight }]}>
          <View style={styles.textContainer}>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            {slide.description ? (
              <Text style={styles.slideDescription}>{slide.description}</Text>
            ) : null}
          </View>

          <View style={styles.imageContainer}>
            {slide.showLogo ? (
              <Image
                source={isDark ? WELCOME_IMAGES.logoDark : WELCOME_IMAGES.logoLight}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={slide.image}
                style={slide.rawImage ? styles.slideImageRaw : styles.slideImage}
                resizeMode="contain"
              />
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
    if (!reanimatedAvailable) {
      return {};
    }

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

  const isActive = index === currentIndex;

  return (
    <Animated.View
      style={[
        styles.paginationDot,
        animatedDotStyle,
        !reanimatedAvailable && {
          opacity: isActive ? 1 : 0.4,
          transform: [{ scale: isActive ? 1.2 : 0.8 }],
        },
        {
          backgroundColor: isActive ? colors.primary : colors.borderSecondary,
        },
      ]}
    />
  );
}

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to Financial Control',
    description:
      'Turn your one-time funds into regular auto payouts, create a consistent cash flow that sorts everyday expenses.',
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '2',
    title: 'Secure your money in vaults, access them when due',
    description: '',
    image: WELCOME_IMAGES.slide2,
    gradient: ['#059669', '#10B981'],
    accentColor: '#34D399',
    rawImage: true,
  },
  {
    id: '3',
    title: 'Plan your every money move',
    description: '',
    image: WELCOME_IMAGES.slide3,
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
    rawImage: true,
  },
  {
    id: '4',
    title: 'Create payouts, control timing',
    description: '',
    image: WELCOME_IMAGES.slide4,
    gradient: ['#7C3AED', '#A855F7'],
    accentColor: '#C084FC',
    rawImage: true,
  },
  {
    id: '5',
    title: 'Timely payouts, 24/7/365',
    description: '',
    image: WELCOME_IMAGES.slide5,
    gradient: ['#EC4899', '#F97316'],
    accentColor: '#F9A8D4',
    rawImage: true,
  },
  {
    id: '6',
    title: 'Join thousands of users who love Planmoni',
    description: '',
    image: WELCOME_IMAGES.slide6,
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
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const resetScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);

  const modalHeight = height * 0.9;
  // Android Modals often report inset 0 — use a solid fallback for 3-button / gesture nav.
  const footerSafeBottom =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom, 20)
      : Math.max(insets.bottom, 48);

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
      router.push('/(auth)/onboarding/country-select');
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

  const verticalPadding = isSmallScreen ? 16 : 20;
  const titleSize = isSmallScreen ? 24 : 28;
  const descriptionSize = isSmallScreen ? 13 : 15;
  // Keep these in sync with footer / pagination styles below so the
  // intro slide gets accurate remaining height to space content evenly.
  const buttonHeight = Platform.OS === 'ios' ? 56 : 50;
  const footerPaddingTop = 8;
  const footerHeight = buttonHeight + footerPaddingTop + footerSafeBottom;
  const paginationHeight = 32;
  const slideHeight = Math.max(modalHeight - footerHeight - paginationHeight, 320);

  const styles = createStyles(colors, isDark, {
    verticalPadding,
    titleSize,
    descriptionSize,
    modalHeight,
    slideHeight,
    width,
    isAndroid,
    isSmallScreen,
    footerSafeBottom,
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
              style={[styles.slider, { height: slideHeight }]}
              contentContainerStyle={[styles.sliderContent, { height: slideHeight }]}
            >
              {SLIDES.map((slide, index) => (
                <SlideItem
                  key={slide.id}
                  slide={slide}
                  index={index}
                  width={width}
                  slideHeight={slideHeight}
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

          {/* Footer Buttons — pad bottom for Android edge-to-edge system nav */}
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={2}
              tint={isDark ? 'dark' : 'light'}
              style={[styles.footer, { paddingBottom: footerSafeBottom }]}
            >
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
          ) : (
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: footerSafeBottom,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.96)',
                },
              ]}
            >
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
            </View>
          )}
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
    height: responsive.slideHeight,
  },
  slider: {
    flexGrow: 0,
  },
  sliderContent: {
    alignItems: 'flex-start',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: responsive.verticalPadding,
    // Leave room for the floating close button without crushing intro content
    paddingTop: Platform.OS === 'ios' ? 44 : 36,
  },
  slideContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: responsive.verticalPadding,
    flex: 1,
  },
  slideImage: {
    width: responsive.width * 0.86,
    height: responsive.slideHeight * 0.48,
  },
  slideImageRaw: {
    width: responsive.width * 0.86,
    height: responsive.slideHeight * 0.52,
  },
  logoImage: {
    width: responsive.width * 0.55,
    height: responsive.slideHeight * 0.4,
  },
  introSlideContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: Math.max(responsive.verticalPadding, 24),
  },
  introBrandBlock: {
    alignItems: 'center',
    width: '100%',
    gap: responsive.isSmallScreen ? 8 : 12,
  },
  introWelcomeText: {
    fontSize: responsive.isSmallScreen ? 24 : Platform.OS === 'ios' ? 28 : 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  // Logo asset ~1032x221 — size by width and preserve aspect ratio
  introLogo: {
    width: Math.min(responsive.width * (responsive.isSmallScreen ? 0.46 : 0.52), 220),
    height:
      Math.min(responsive.width * (responsive.isSmallScreen ? 0.46 : 0.52), 220) *
      (221 / 1032),
  },
  // Award asset ~787x671
  introAwardImage: {
    width: Math.min(responsive.width * (responsive.isSmallScreen ? 0.34 : 0.4), 170),
    height:
      Math.min(responsive.width * (responsive.isSmallScreen ? 0.34 : 0.4), 170) *
      (671 / 787),
  },
  introPartnershipBlock: {
    alignItems: 'center',
    width: '100%',
  },
  // Partnership asset ~808x342
  introPartnershipImage: {
    width: Math.min(responsive.width * (responsive.isSmallScreen ? 0.52 : 0.58), 250),
    height:
      Math.min(responsive.width * (responsive.isSmallScreen ? 0.52 : 0.58), 250) *
      (342 / 808),
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: responsive.verticalPadding * 0.5,
    width: '100%',
  },
  slideTitle: {
    fontWeight: '700',
    fontSize: responsive.titleSize,
    lineHeight: responsive.titleSize * 1.25,
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
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: responsive.verticalPadding,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 4,
    marginHorizontal: 1,
  },
  footer: {
    paddingTop: 8,
    // paddingBottom applied inline from safe-area insets (edge-to-edge)
    paddingHorizontal: Math.max(responsive.verticalPadding, 20),
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

