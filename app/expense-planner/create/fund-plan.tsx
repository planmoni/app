import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Wallet, CreditCard, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useWalletQuery } from '@/hooks/queries/useWalletQuery';
import PaystackLogo from '@/assets/banks/paystack.svg';

export default function FundPlanScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { availableBalance } = useWalletQuery();
  const params = useLocalSearchParams();
  const isSmallScreen = screenWidth < 380;

  const planId = params.planId as string;
  const planName = params.planName as string;
  const totalBudget = params.totalBudget as string;

  const styles = createStyles(colors, isDark, isSmallScreen, textSizeMultiplier);

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleFundFromWallet = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/fund-amount',
      params: {
        planId,
        planName,
        totalBudget,
        currentBalance: params.currentBalance || '0',
      },
    });
  };

  const handleFundWithPaystack = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/paystack-payment',
      params: {
        returnTo: '/expense-planner/create/fund-plan',
        planId,
        planName,
        totalBudget,
      },
    });
  };

  const handleFundWithMono = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: 'mono-directpay',
        planId,
        planName,
        totalBudget,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Fund Vault</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.closeButton}
          hitSlop={8}
        >
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Choose how to fund your vault</Text>
          <Text style={styles.subtitle}>
            Select a payment method to add money to your vault
          </Text>

          {planName && (
            <View style={styles.planInfoCard}>
              <Text style={styles.planInfoLabel}>Vault</Text>
              <Text style={styles.planInfoName}>{planName}</Text>
              <Text style={styles.planInfoAmount}>
                ₦{parseFloat(totalBudget || '0').toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.optionsContainer}>
            {/* Fund from Wallet Balance Option */}
            <Pressable
              style={styles.optionCard}
              onPress={handleFundFromWallet}
            >
              <View style={styles.optionIconContainer}>
                <Wallet size={24} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Fund from wallet balance</Text>
                <Text style={styles.optionDescription}>
                  Use your available balance of ₦{availableBalance.toLocaleString()}
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Fund with Paystack Option */}
            <Pressable
              style={styles.optionCard}
              onPress={handleFundWithPaystack}
            >
              <View style={styles.optionIconContainer}>
                <PaystackLogo width={24} height={24} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Fund with Paystack</Text>
                <Text style={styles.optionDescription}>
                  Add funds with Credit/Debit cards, Transfers, Direct Debit, USSD, and more.
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Fund with Mono Option */}
            <Pressable
              style={styles.optionCard}
              onPress={handleFundWithMono}
            >
              <View style={styles.optionIconContainer}>
                <CreditCard size={24} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Fund with Bank</Text>
                <Text style={styles.optionDescription}>
                  Add funds via Mono Direct Pay. Mono fees apply.
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

const createStyles = (
  colors: any,
  isDark: boolean,
  isSmallScreen: boolean,
  textSizeMultiplier: number
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
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
  title: {
    fontSize: getScaledFontSize(isSmallScreen ? 20 : 24, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 14 : 16, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  planInfoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planInfoLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planInfoName: {
    fontSize: getScaledFontSize(isSmallScreen ? 18 : 20, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  planInfoAmount: {
    fontSize: getScaledFontSize(isSmallScreen ? 24 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: colors.primary,
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
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: getScaledFontSize(isSmallScreen ? 13 : 14, textSizeMultiplier),
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

