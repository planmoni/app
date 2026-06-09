import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Animated, FadeIn, FadeInDown } from '@/lib/reanimatedSafe';
import SuccessAnimation from '@/components/SuccessAnimation';

export default function Tier1SuccessScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();

  // Auto-redirect to home after 3 seconds
  useEffect(() => {
    // Wait a bit to ensure router is ready
    const timer = setTimeout(() => {
      try {
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback: try again after a short delay
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleGoHome = () => {
    haptics.mediumImpact();
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View
          entering={FadeIn.duration(600)}
          style={styles.iconContainer}
        >
          <SuccessAnimation />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          style={styles.textContainer}
        >
          <Text style={styles.title}>Tier 1 Verification Complete!</Text>
          <Text style={styles.subtitle}>
            Congratulations! You've successfully completed Tier 1 verification.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          style={styles.benefitsContainer}
        >
          <View style={styles.benefitCard}>
            <Text style={styles.benefitTitle}>Your Benefits</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Deposit up to ₦100,000 daily
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Enhanced account security
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Access to all Tier 1 features
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(600).delay(600)}
          style={styles.actionContainer}
        >
          <Pressable
            style={styles.button}
            onPress={handleGoHome}
          >
            <Text style={styles.buttonText}>Go to Home</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.autoRedirectText}>
            Redirecting automatically in 5 seconds...
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      marginBottom: 32,
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    benefitsContainer: {
      width: '100%',
      marginBottom: 40,
    },
    benefitCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benefitTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    benefitIcon: {
      fontSize: 20,
      color: colors.success,
      marginRight: 12,
      fontWeight: 'bold',
    },
    benefitText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    actionContainer: {
      width: '100%',
      alignItems: 'center',
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      minWidth: 200,
      marginBottom: 16,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    autoRedirectText: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });
}

