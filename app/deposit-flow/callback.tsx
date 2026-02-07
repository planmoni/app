import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function DepositCallbackScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const reference = (params.reference as string) ?? '';
  const status = (params.status as string) ?? '';
  const reason = (params.reason as string) ?? '';
  const { refreshWallet } = useBalance();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!reference || !status) {
        if (!cancelled) {
          setError('Missing payment details.');
          setLoading(false);
        }
        return;
      }

      const isSuccess = status === 'successful' || status === 'success';
      const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const verifyEndpoint = apiUrl
        ? `${apiUrl.replace(/\/$/, '')}/api/mono-verify-and-credit`
        : supabaseUrl
          ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mono-directpay-verify-and-credit`
          : null;

      const tryVerifyAndCredit = async (): Promise<boolean> => {
        if (!verifyEndpoint || !session?.access_token) return false;
        try {
          const res = await fetch(verifyEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ reference }),
          });
          return res.ok;
        } catch (_) {
          return false;
        }
      };

      const goToSuccess = async () => {
        try {
          await refreshWallet?.();
        } catch (_) {}
        let amount = '0', fee = '0', totalCharged = '0';
        try {
          const { data: row } = await supabase
            .from('mono_directpay_payments')
            .select('amount, fee, total_charged')
            .eq('reference', reference)
            .single();
          amount = row?.amount != null ? String(Number(row.amount).toLocaleString()) : '0';
          fee = row?.fee != null ? String(Number(row.fee)) : '0';
          totalCharged = row?.total_charged != null ? String(Number(row.total_charged)) : '0';
        } catch (_) {}
        if (!cancelled) {
          router.replace({
            pathname: '/deposit-flow/mono-success',
            params: { amount, reference, fee, totalCharged },
          });
        }
      };

      if (isSuccess) {
        const ok = await tryVerifyAndCredit();
        if (ok) {
          await new Promise((r) => setTimeout(r, 600));
          await goToSuccess();
        } else {
          // Verify-and-credit failed (network or 4xx/5xx). Only show success if payment row is already successful (e.g. webhook credited).
          try {
            const { data: row } = await supabase
              .from('mono_directpay_payments')
              .select('status')
              .eq('reference', reference)
              .single();
            if (row?.status === 'successful') {
              await goToSuccess();
            } else if (!cancelled) {
              router.replace({
                pathname: '/deposit-flow/mono-failure',
                params: {
                  reason: 'Payment verified but we couldn’t add funds. Tap "Refresh balance" to retry.',
                  reference,
                  errorType: 'payment',
                },
              });
            }
          } catch (_) {
            if (!cancelled) {
              router.replace({
                pathname: '/deposit-flow/mono-failure',
                params: {
                  reason: 'Payment verified but we couldn’t add funds. Tap "Refresh balance" to retry.',
                  reference,
                  errorType: 'payment',
                },
              });
            }
          }
        }
        setLoading(false);
        return;
      }

      // Status was failed/other (e.g. "Network request failed" when redirect URL failed to load).
      // Still try verify-and-credit once: if payment actually succeeded on Mono, we can show success.
      const credited = await tryVerifyAndCredit();
      if (credited) {
        await goToSuccess();
        setLoading(false);
        return;
      }

      if (!cancelled) {
        router.replace({
          pathname: '/deposit-flow/mono-failure',
          params: {
            reason: reason || 'Payment was not successful.',
            reference,
            errorType: 'payment',
          },
        });
        setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reference, status, reason, refreshWallet, session?.access_token]);

  const styles = createStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Completing your deposit...</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Payment incomplete</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={() => router.replace('/deposit-flow/payment-methods')}
            style={styles.button}
          />
          <Button
            title="Back to Dashboard"
            onPress={() => router.replace('/(tabs)')}
            variant="outline"
            style={styles.button}
          />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return null;
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
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      width: '100%',
      marginBottom: 12,
    },
  });
