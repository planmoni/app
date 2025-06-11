import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions, ScrollView } from 'react-native';
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
    title: 'Save Smarter',
    description: 'Lock your funds safely and release them based on your schedule.',
    image: require('@/assets/images/SmartSavings.png'),
    icon: Wallet,
    color: '#EFF6FF',
    iconColor: '#3B82F6',
  },
  {
    id: '2',
    title: 'Pay Yourself On Time',
    description: 'Receive payouts weekly, monthly, or however you choose — just like a salary.',
    image: require('@/assets/images/PayYourselfOnTime.png'),
    icon: Calendar,
    color: '#F0FDF4',
    iconColor: '#22C55E',
  },
  {
    id: '3',
    title: 'Stay in Control',
    description: 'No impulse spending. Your money stays locked until your chosen payday.',
    image: require('@/assets/images/StayInControl.png'),
    icon: Shield,
    color: '#FEF3C7',
    iconColor: '#D97706',
  },
  {
    id: '4',
    title: 'Build Healthy Habits',
    description: 'Automate discipline and achieve long-term financial goals effortlessly.',
    image: require('@/assets/images/BuildHealthyHabits.png'),
    icon: TrendingUp,
    color: '#F3E8FF',
    iconColor: '#9333EA',
  },
];

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
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
    router.push('/(auth)/signup');
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  const styles = createStyles(colors, isDark);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
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
    </ScrollView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    width: 200,
    height: 80,
  },
  sliderContainer: {
    flex: 1,
    minHeight: 400,
  },
  slider: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideImage: {
    width: '100%',
    height: 280,
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  dot: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  getStartedButton: {
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  signInButton: {
    borderColor: colors.border,
    marginBottom: 32,
  },
  regulatoryInfo: {
    alignItems: 'flex-start',
  },
  regulatoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ndicLogo: {
    width: 60,
    height: 24,
    opacity: isDark ? 0.8 : 1,
  },
  cbnLogo: {
    width: 24,
    height: 24,
    opacity: isDark ? 0.8 : 1,
  },
  regulatoryText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});