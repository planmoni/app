import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ArrowLeft, Home, CheckCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { replaceToVaultsHomeTab } from '@/lib/replaceToVaultsHomeTab';
import SuccessAnimation from '@/components/SuccessAnimation';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';

export default function MonoSuccessScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const [refreshing, setRefreshing] = useState(false);

  // Refresh balance again when success screen mounts (in case callback refetched too early)
  useEffect(() => {
    const t = setTimeout(() => {
      refreshWallet?.();
    }, 800);
    return () => clearTimeout(t);
  }, [refreshWallet]);
  const params = useLocalSearchParams<{
    amount: string;
    reference: string;
    fee?: string;
    totalCharged?: string;
    planId?: string;
    planName?: string;
    totalBudget?: string;
  }>();
  const amount = params.amount ?? '0';
  const reference = params.reference ?? '';
  const planId = params.planId as string | undefined;
  const planName = params.planName as string | undefined;
  const totalBudget = params.totalBudget as string | undefined;
  const feeNum = params.fee ? Number(params.fee) : 0;
  const totalChargedNum = params.totalCharged ? Number(params.totalCharged) : 0;
  const hasFee = feeNum > 0;

  const { addFundsToPlan } = useExpensePlans();
  const hasTransferredRef = useRef(false);
  const [fundingInProgress, setFundingInProgress] = useState(!!planId);
  const [fundingError, setFundingError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId || hasTransferredRef.current) return;
    hasTransferredRef.current = true;

    let cancelled = false;
    setFundingInProgress(true);
    setFundingError(null);

    const run = async () => {
      try {
        const amountNum = Number(String(amount).replace(/,/g, ''));
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          throw new Error('Invalid payment amount.');
        }

        const result = await addFundsToPlan(planId, amountNum);
        if (cancelled) return;

        replaceToVaultsHomeTab();
      } catch (e: any) {
        if (cancelled) return;
        setFundingError(e?.message || 'Failed to fund your vault. Please try again.');
        setFundingInProgress(false);
        hasTransferredRef.current = false; // allow retry if user navigates back
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [planId, amount, planName, totalBudget, addFundsToPlan, router]);

  const handleBackToDashboard = () => {
    haptics.mediumImpact();
    if (planId) {
      replaceToVaultsHomeTab();
      return;
    }
    router.replace('/(tabs)');
  };

  const handleViewTransaction = () => {
    haptics.lightImpact();
    router.push('/transactions');
  };

  const handleRefreshBalance = async () => {
    if (!reference || !session?.access_token) return;
    haptics.lightImpact();
    setRefreshing(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const verifyEndpoint = apiUrl
        ? `${apiUrl.replace(/\/$/, '')}/api/mono-verify-and-credit`
        : supabaseUrl
          ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mono-directpay-verify-and-credit`
          : null;
      if (verifyEndpoint) {
        await fetch(verifyEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reference }),
        });
      }
      await refreshWallet?.();
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = () =>
    new Date().toLocaleString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBackToDashboard} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment Successful</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(20, insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />
        <Text style={styles.title}>Payment Successful!</Text>
        {planId ? (
          <Text style={styles.subtitle}>
            {fundingError
              ? 'We couldn’t fund your vault'
              : fundingInProgress
                ? 'Funding your vault...'
                : 'Your vault has been funded'}
          </Text>
        ) : (
          <Text style={styles.subtitle}>Your funds have been added to your wallet</Text>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₦</Text>
            <Text style={styles.amount}>{amount ? Number(amount.replace(/,/g, '')).toLocaleString('en-NG') : '0'}</Text>
          </View>
          <Text style={styles.description}>
            has been added to your{'\n'}
            <Text style={styles.highlight}>Planmoni Wallet</Text>
          </Text>
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                {reference || 'N/A'}
              </Text>
            </View>
            {hasFee && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fee</Text>
                <Text style={styles.detailValue}>₦{feeNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}
            {hasFee && totalChargedNum > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total charged</Text>
                <Text style={styles.detailValue}>₦{totalChargedNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>Pay with Bank</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{formatDate()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <CheckCircle size={20} color={colors.success} />
            </View>
            <Text style={styles.infoTitle}>Wallet Updated</Text>
          </View>
          <Text style={styles.infoText}>
            Your wallet balance has been updated and is ready to use. You can use these funds for payout plans and other transactions.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Button title={planId ? 'Back to Vaults' : 'Back to Dashboard'} onPress={handleBackToDashboard} style={styles.primaryButton} icon={Home} />
        {!planId && (
          <>
            <Button title="View Transaction" onPress={handleViewTransaction} variant="outline" style={styles.secondaryButton} />
            <Text style={styles.refreshHint}>If your balance didn&apos;t update, tap below to sync.</Text>
            <Pressable
              onPress={handleRefreshBalance}
              disabled={refreshing}
              style={({ pressed }) => [styles.refreshButton, (pressed || refreshing) && styles.refreshButtonPressed]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RefreshCw size={18} color={colors.primary} />
              )}
              <Text style={styles.refreshButtonText}>
                {refreshing ? 'Refreshing...' : 'Refresh balance'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundSecondary },
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
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
    placeholder: { width: 40 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 24, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 32, textAlign: 'center', lineHeight: 24 },
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
    amountContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 12 },
    currencySymbol: { fontSize: 28, fontWeight: '700', color: colors.text, marginRight: 4 },
    amount: { fontSize: 36, fontWeight: '700', color: colors.text },
    description: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
    highlight: { color: colors.success, fontWeight: '600' },
    detailsContainer: { width: '100%', gap: 16 },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: { fontSize: 14, color: colors.textSecondary, flex: 1 },
    detailValue: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1, textAlign: 'right' },
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
    infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: (colors.success || '#22c55e') + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    infoTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    infoText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    footer: { padding: 24, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
    primaryButton: { backgroundColor: colors.primary, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    secondaryButton: { borderColor: colors.border, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    refreshHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 4,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    refreshButtonPressed: { opacity: 0.7 },
    refreshButtonText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  });
