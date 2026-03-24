import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const styles = createStyles(colors, isDark, isSmallScreen);

  const handleBack = () => {
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
    router.push('/paystack-payment');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add funds</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Select a payment method to add money to your wallet
          </Text>

          <View style={styles.optionsContainer}>
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
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.optionCard} onPress={handleFundWithBank}>
              <View style={styles.optionIconContainer}>
                <Building2 size={24} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Add funds from Bank</Text>
                <Text style={styles.optionDescription}>
                  One-time payment via your bank.
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
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
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? 12 : 16,
      paddingVertical: isSmallScreen ? 12 : 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      padding: isSmallScreen ? 16 : 20,
    },
    subtitle: {
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 22,
    },
    optionsContainer: {
      gap: 16,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: isSmallScreen ? 16 : 20,
      gap: 16,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
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
      fontSize: isSmallScreen ? 15 : 15,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: isSmallScreen ? 13 : 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
