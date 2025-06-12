import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { 
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Shield, Calendar, Wallet, TrendingUp } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const SLIDES = [
  {
    id: '1',
    title: 'Stabilize Your Cashflow',
    description: 'Put some money aside, get paid on a schedule & say goodbye to irregular income. ',
    image: require('@/assets/images/SmartSavings.png'),
    icon: Wallet,
    color: '#EFF6FF',
    iconColor: '#3B82F6',
  },
  {
    id: '2',
    title: 'Pay Yourself Whenever You Like',
    description: 'Receive payouts weekly, monthly, or however you choose — just like a salary.',
    image: require('@/assets/images/PayYourselfOnTime.png'),
    icon: Calendar,
    color: '#F0FDF4',
    iconColor: '#22C55E',
  },
  {
    id: '3',
    title: 'Gain Control Over Your Financial Life',
    description: 'No impulse spending. Your money stays locked until your chosen payday.',
    image: require('@/assets/images/StayInControl.png'),
    icon: Shield,
    color: '#FEF3C7',
    iconColor: '#D97706',
  },
  {
    id: '4',
    title: 'Build A Healthy Money Habits',
    description: 'Automate discipline and achieve long-term financial goals effortlessly.',
    image: require('@/assets/images/BuildHealthyHabits.png'),
    icon: TrendingUp,
    color: '#F3E8FF',
    iconColor: '#9333EA',
  },
];

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const scrollX = useSharedValue(0);
  const currentIndex = useSharedValue(0);

  // Redirect to tabs if user is already authenticated
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      currentIndex.value = Math.round(scrollX.value / width);
    },
  });

  const handleGetStarted = () => {
    router.push('/(auth)/onboarding/first-name');
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  // Calculate responsive dimensions
  const isSmallScreen = height < 700;
  const logoHeight = isSmallScreen ? 50 : 80;
  const imageHeight = Math.min(height * 0.3, 280);
  const verticalPadding = isSmallScreen ? 20 : 40;
  const buttonHeight = isSmallScreen ? 44 : 56;
  const titleSize = isSmallScreen ? 22 : 28;
  const descriptionSize = isSmallScreen ? 14 : 16;

  const styles = createStyles(colors, isDark, {
    logoHeight,
    imageHeight,
    verticalPadding,
    buttonHeight,
    titleSize,
    descriptionSize,
    height,
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={isDark 
            ? require('@/assets/images/PlanmoniDarkMode.png')
            : require('@/assets/images/Planmoni.png')
          }
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.sliderContainer}>
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={styles.slider}
        >
          {SLIDES.map((slide) => (
            <View key={slide.id} style={[styles.slide, { width }]}>
              <Image 
                source={slide.image}
                style={styles.slideImage}
                resizeMode="contain"
              />
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.pagination}>
          {SLIDES.map((_, index) => {
            const dotStyle = useAnimatedStyle(() => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];
              
              const dotWidth = interpolate(
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

              return {
                width: withSpring(dotWidth),
                opacity: withSpring(opacity),
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
      </View>

      <View style={styles.footer}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          style={styles.getStartedButton}
        />
        <Button
          title="Already have an account? Sign In"
          onPress={handleSignIn}
          variant="outline"
          style={styles.signInButton}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, responsive: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: responsive.verticalPadding,
    paddingBottom: responsive.verticalPadding / 2,
  },
  logo: {
    width: 150,
    height: responsive.logoHeight,
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slider: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
    height: responsive.imageHeight,
    marginBottom: responsive.verticalPadding / 2,
  },
  slideTitle: {
    fontSize: responsive.titleSize,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  slideDescription: {
    fontSize: responsive.descriptionSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: responsive.descriptionSize * 1.5,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: responsive.verticalPadding / 2,
  },
  dot: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  footer: {
    padding: responsive.verticalPadding / 2,
    paddingBottom: responsive.verticalPadding,
  },
  getStartedButton: {
    backgroundColor: colors.primary,
    marginBottom: 12,
    height: responsive.buttonHeight,
  },
  signInButton: {
    borderColor: colors.border,
    marginBottom: 0,
    height: responsive.buttonHeight,
  },
});