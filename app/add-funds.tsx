import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { X, ArrowRight, Building2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import PaystackLogo from '@/assets/banks/paystack.svg';
import SafeHavenLogo from '@/assets/banks/safe_haven_bank.svg';

export default function AddFundsScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const isSmallScreen = screenWidth < 380;
  const slide = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const styles = createStyles(colors, isDark, isSmallScreen);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const close = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleBankTransfer = () => {
    haptics.mediumImpact();
    router.push('/bank-transfer');
  };

  const handleFundWithBank = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: { newMethodType: 'mono-directpay' },
    });
  };

  const handleCards = () => {
    haptics.mediumImpact();
    router.replace('/paystack-payment');
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={styles.handle} />
        <Pressable
          onPress={close}
          style={styles.closeButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={18} color={colors.text} />
        </Pressable>
        <View style={styles.header}>
          <Text style={styles.title}>Add funds</Text>
          <Text style={styles.subtitle}>
            Choose how you want to add money to your wallet
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(20, insets.bottom + 8) },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Pressable style={styles.optionCard} onPress={handleBankTransfer}>
            <View style={styles.optionIconContainer}>
              <SafeHavenLogo width={24} height={24} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Your Account Details</Text>
              <Text style={styles.optionDescription}>
                Transfer money directly from your bank account with no fees
              </Text>
            </View>
            <ArrowRight size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable style={styles.optionCard} onPress={handleFundWithBank}>
            <View style={styles.optionIconContainer}>
              <Building2 size={22} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Add funds from Bank</Text>
              <Text style={styles.optionDescription}>
                One-time payment via your bank.
              </Text>
            </View>
            <ArrowRight size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable style={styles.optionCard} onPress={handleCards}>
            <View style={styles.optionIconContainer}>
              <PaystackLogo width={24} height={24} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Fund with Paystack</Text>
              <Text style={styles.optionDescription}>
                Add funds with various payment methods. Paystack fees apply.
              </Text>
            </View>
            <ArrowRight size={18} color={colors.textSecondary} />
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'transparent',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
    },
    sheet: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '82%',
      paddingTop: 10,
      position: 'relative',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : '#E2E8F0',
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingTop: 8,
      paddingRight: 64,
      paddingBottom: 16,
    },
    title: {
      fontSize: isSmallScreen ? 20 : 22,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: colors.text,
      marginBottom: 6,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 2,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: isSmallScreen ? 16 : 20,
      gap: 12,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.card : colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      gap: 14,
    },
    optionIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
