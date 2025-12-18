import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Download, ArrowLeft, Home, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import SuccessAnimation from '@/components/SuccessAnimation';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';

export default function PaystackPaymentSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  
  const amount = params.amount as string;
  const reference = params.reference as string;
  const email = params.email as string;
  const planId = params.planId as string | undefined;
  const planName = params.planName as string | undefined;

  const isPlanFunding = !!planId;

  const handleBackToDashboard = () => {
    haptics.mediumImpact();
    if (isPlanFunding && planId) {
      // Navigate to plan details page
      router.replace(`/expense-planner/${planId}`);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleViewPlan = () => {
    haptics.mediumImpact();
    if (planId) {
      router.push(`/expense-planner/${planId}`);
    }
  };

  const handleClose = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleViewTransaction = () => {
    haptics.lightImpact();
    // Navigate to transactions page
    router.push('/transactions');
  };

  const formatDate = () => {
    return new Date().toLocaleString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBackToDashboard}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment Successful</Text>
        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={8}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />

        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>
          {isPlanFunding 
            ? `Your funds have been added to ${planName || 'your plan'}`
            : 'Your funds have been added to your wallet'}
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₦</Text>
            <Text style={styles.amount}>{amount ? parseFloat(amount).toLocaleString('en-NG') : '0'}</Text>
          </View>
          <Text style={styles.description}>
            has been added to {isPlanFunding ? (
              <>
                your{'\n'}
                <Text style={styles.highlight}>{planName || 'Plan'}</Text>
              </>
            ) : (
              <>
                your{'\n'}
                <Text style={styles.highlight}>Planmoni Wallet</Text>
              </>
            )}
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction Reference</Text>
              <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                {reference || 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>Paystack</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{formatDate()}</Text>
            </View>
            {email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{email}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <CheckCircle size={20} color={colors.success} />
            </View>
            <Text style={styles.infoTitle}>
              {isPlanFunding ? 'Plan Funded' : 'Wallet Updated'}
            </Text>
          </View>
          <Text style={styles.infoText}>
            {isPlanFunding
              ? `Your plan has been funded successfully. The funds are now available in your plan wallet and ready to use.`
              : 'Your wallet balance has been updated and is ready to use. You can now use these funds for your expense plans and other transactions.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {isPlanFunding ? (
          <>
            <Button
              title={`View ${planName || 'Plan'}`}
              onPress={handleViewPlan}
              style={styles.dashboardButton}
              icon={Home}
            />
            <Button
              title="Back to Dashboard"
              onPress={() => {
                haptics.mediumImpact();
                router.replace('/(tabs)');
              }}
              variant="outline"
              style={styles.transactionButton}
            />
          </>
        ) : (
          <>
            <Button
              title="Back to Dashboard"
              onPress={handleBackToDashboard}
              style={styles.dashboardButton}
              icon={Home}
            />
            <Button
              title="View Transaction"
              onPress={handleViewTransaction}
              variant="outline"
              style={styles.transactionButton}
            />
          </>
        )}
      </View>

      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      alignItems: 'center',
    },
    title: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
      lineHeight: 24,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      marginBottom: 12,
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginRight: 4,
    },
    amount: {
      fontSize: getScaledFontSize(36, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    description: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    highlight: {
      color: colors.success,
      fontWeight: '600',
    },
    detailsContainer: {
      width: '100%',
      gap: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      flex: 1,
    },
    detailValue: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    infoIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.success + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    infoTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    infoText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 20,
    },
    footer: {
      padding: 24,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    dashboardButton: {
      backgroundColor: colors.primary,
      height: 55,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    transactionButton: {
      borderColor: colors.border,
      height: 55,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
  });
