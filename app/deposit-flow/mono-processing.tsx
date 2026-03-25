import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Shown after Mono redirects with success. We do not call verify-and-credit;
 * the webhook will process the payment and update mono_directpay_payments.
 * This screen subscribes to the payment row and navigates to success when
 * the webhook sets status to 'successful'.
 */
export default function MonoProcessingScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{
    reference: string;
    waitMessage?: string;
    planId?: string;
    planName?: string;
    totalBudget?: string;
  }>();
  const reference = params.reference ?? '';
  const waitMessage = params.waitMessage === 'true';
  const planId = params.planId as string | undefined;
  const planName = params.planName as string | undefined;
  const totalBudget = params.totalBudget as string | undefined;
  const { refreshWallet } = useBalance();
  const [displayAmount, setDisplayAmount] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasNavigated = useRef(false);

  const goToSuccess = useCallback(
    async (amount: string, fee: string, totalCharged: string) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      try {
        await refreshWallet?.();
      } catch (_) {}
      router.replace({
        pathname: '/deposit-flow/mono-success',
        params: {
          amount,
          reference,
          fee,
          totalCharged,
          ...(planId && { planId }),
          ...(planName && { planName }),
          ...(totalBudget && { totalBudget }),
        },
      });
    },
    [reference, refreshWallet, planId, planName, totalBudget]
  );

  const checkAndNavigate = useCallback(
    async (row: { status: string; amount?: number; fee?: number; total_charged?: number }) => {
      if (row.status === 'successful') {
        const amount = row.amount != null ? String(Number(row.amount).toLocaleString()) : '0';
        const fee = row.fee != null ? String(Number(row.fee)) : '0';
        const totalCharged = row.total_charged != null ? String(Number(row.total_charged)) : '0';
        goToSuccess(amount, fee, totalCharged);
      }
    },
    [goToSuccess]
  );

  // Fetch initial payment row for display amount + current status
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('mono_directpay_payments')
        .select('amount, fee, total_charged, status')
        .eq('reference', reference)
        .single();
      if (cancelled) return;
      if (data?.amount != null) {
        setDisplayAmount(Number(data.amount).toLocaleString('en-NG'));
      }
      if (data?.status === 'successful') {
        checkAndNavigate(data as any);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, checkAndNavigate]);

  // Realtime: when webhook updates status to 'successful', go to success
  useEffect(() => {
    if (!reference) return;
    const channelName = `mono-dp-${reference.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mono_directpay_payments',
          filter: `reference=eq.${reference}`,
        },
        (payload: { new: any }) => {
          if (payload?.new && payload.new.status === 'successful') {
            checkAndNavigate(payload.new);
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [reference, checkAndNavigate]);

  const handleRefreshBalance = async () => {
    haptics.lightImpact();
    setRefreshing(true);
    try {
      await refreshWallet?.();
      const { data } = await supabase
        .from('mono_directpay_payments')
        .select('amount, fee, total_charged, status')
        .eq('reference', reference)
        .single();
      if (data?.status === 'successful') {
        checkAndNavigate(data as any);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackToDashboard = () => {
    haptics.mediumImpact();
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.centered}>
        <View style={styles.iconWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <Text style={styles.title}>Transaction processing</Text>
        <Text style={styles.message}>
          {waitMessage
            ? 'Your transaction is being processed. Please wait about 1 minute before performing any transaction.'
            : 'Your deposit is being processed. Funds will be added to your wallet shortly—our system is confirming the payment.'}
        </Text>
        <Text style={styles.waitNotice}>
          Please wait about 1 minute before performing any other transaction.
        </Text>
        {displayAmount != null && (
          <Text style={styles.amountLabel}>Amount: ₦{displayAmount}</Text>
        )}
        <Text style={styles.hint}>
          {waitMessage
            ? 'If you completed the payment, your balance will update shortly. You can refresh your balance or go back to Dashboard.'
            : 'You can wait here or go to Dashboard and refresh your balance in a moment.'}
        </Text>
        <View style={styles.buttons}>
          <Button
            title={refreshing ? 'Checking...' : 'Refresh balance'}
            onPress={handleRefreshBalance}
            disabled={refreshing}
            variant="outline"
            style={styles.button}
            icon={refreshing ? undefined : RefreshCw}
          />
          <Button
            title="Back to Dashboard"
            onPress={handleBackToDashboard}
            style={styles.button}
            icon={Home}
          />
        </View>
      </View>
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconWrap: {
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 16,
    },
    waitNotice: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    hint: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: 32,
    },
    buttons: {
      width: '100%',
      gap: 12,
    },
    button: {
      width: '100%',
    },
  });
