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
      <View style={styles.slideContent}>
        <View style={styles.imageContainer}>
          {slide.showLogo ? (
            <Image 
              source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
              style={styles.logoImage}
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
        
        <View style={styles.textContainer}>
          <View style={styles.titleSection}>
            <Text style={styles.slideTitle}>{slide.title}</Text>
          </View>
          
          {slide.description && (
            <Text style={styles.slideDescription}>{slide.description}</Text>
          )}
        </View>
      </View>
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
    description: "Planmoni is your financial companion, equipped with advanced tools, insights & A.I capabilities to help pace your spending like a pro.",
    image: require('@/assets/images/StayInControl.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '2',
    title: 'Choose when and how you get paid',
    description: 'Split lump-sums into scheduled daily, weekly, bi-weekly or monthly payouts that work for your lifestyle.',
    image: require('@/assets/images/PayYourselfOnTime.png'),
    gradient: ['#059669', '#10B981'],
    accentColor: '#34D399',
  },
  {
    id: '3',
    title: 'Stabilize your Cash Flow',
    description: 'Secure your money, automate payouts & say goodbye to irregular income forever.',
    image: require('@/assets/images/SmartSavings.png'),
    gradient: ['#1E3A8A', '#3B82F6'],
    accentColor: '#60A5FA',
  },
  {
    id: '4',
    title: 'Build Healthy\nMoney Habits',
    description: 'Automate discipline and achieve long-term financial goals effortlessly.',
    image: require('@/assets/images/BuildHealthyHabits.png'),
    gradient: ['#7C3AED', '#A855F7'],
    accentColor: '#C084FC',
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
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const modalHeight = height * 0.9;

  // Reset scroll position and index when modal opens
  useEffect(() => {
    if (isVisible) {
      // Reset to first slide
      setCurrentIndex(0);
      scrollX.value = 0;
      // Small delay to ensure ScrollView is mounted
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      }, 100);
    }
  }, [isVisible]);

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
    onClose();
    router.push('/(auth)/onboarding/first-name');
  };

  const handleSignIn = () => {
    onClose();
    router.push('/(auth)/login');
  };

  const isSmallScreen = height < 700;
  const isAndroid = Platform.OS === 'android';
  
  const platformMultiplier = isAndroid ? 0.8 : 1.0;
  const marginMultiplier = isAndroid ? 0.7 : 1.0;
  
  const imageHeight = Math.min(modalHeight * 0.4 * platformMultiplier, 200);
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
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.text} />
          </Pressable>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-light.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

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
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </Pressable>
              <Pressable
                style={[styles.signUpButton, {
                  backgroundColor: colors.primary
                }]}
                onPress={handleSignUp}
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
    backgroundColor: colors.accentBackground,
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
    width: responsive.width * 0.55,
    height: responsive.imageHeight,
  },
  logoImage: {
    width: responsive.width * 0.6,
    height: responsive.imageHeight * 1.5,
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
    fontWeight: '800',
    fontSize: Platform.OS === 'ios' ? responsive.titleSize : responsive.titleSize * 1.5,
    lineHeight: Platform.OS === 'ios' ? responsive.titleSize * 1.1 : responsive.titleSize * 1.5,
    letterSpacing: -0.5,
    color: isDark ? colors.text : colors.primary,
    textAlign: 'center',
  },
  slideDescription: {
    color: colors.text,
    textAlign: 'center',
    fontSize: Platform.OS === 'ios' ? responsive.descriptionSize : responsive.descriptionSize * 1.5,
    lineHeight: Platform.OS === 'ios' ? responsive.descriptionSize * 1.5 : responsive.descriptionSize * 2,
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
    height: 56,
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
    height: 56,
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
});

