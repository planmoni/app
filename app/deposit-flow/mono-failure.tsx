import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { XCircle, AlertTriangle, ArrowLeft, RefreshCw, Home, Wallet } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { supabase } from '@/lib/supabase';

export default function MonoFailureScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams<{ reason?: string; reference?: string; errorType?: string }>();
  const reason = params.reason ?? 'Payment was not successful.';
  const reference = params.reference ?? '';
  const errorType = (params.errorType as string) || 'payment'; // 'payment' | 'cancelled' | 'load_error'

  const getErrorDetails = () => {
    switch (errorType) {
      case 'cancelled':
        return {
          title: 'Payment Cancelled',
          message: 'You cancelled the payment. No funds were charged.',
          icon: XCircle,
          color: colors.warning || '#f59e0b',
        };
      case 'load_error':
        return {
          title: 'Couldn’t Load Payment',
          message: reason || 'Check your internet connection and try again.',
          icon: AlertTriangle,
          color: colors.error || '#ef4444',
        };
      default:
        return {
          title: 'Payment Failed',
          message: reason || 'The payment could not be completed. Please try again.',
          icon: AlertTriangle,
          color: colors.error || '#ef4444',
        };
    }
  };

  const errorDetails = getErrorDetails();
  const ErrorIcon = errorDetails.icon;

  const handleTryAgain = () => {
    haptics.mediumImpact();
    router.back();
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleRefreshBalance = async () => {
    if (!reference || !session?.access_token) return;
    haptics.mediumImpact();
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
        const res = await fetch(verifyEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reference }),
        });
        if (res.ok) {
          await refreshWallet?.();
          const { data: row } = await supabase
            .from('mono_directpay_payments')
            .select('amount, fee, total_charged')
            .eq('reference', reference)
            .single();
          const amount = row?.amount != null ? String(Number(row.amount).toLocaleString()) : '0';
          const fee = row?.fee != null ? String(Number(row.fee)) : '0';
          const totalCharged = row?.total_charged != null ? String(Number(row.total_charged)) : '0';
          router.replace({
            pathname: '/deposit-flow/mono-success',
            params: { amount, reference, fee, totalCharged },
          });
          return;
        }
      }
    } catch (_) {}
    setRefreshing(false);
  };

  const styles = createStyles(colors, errorDetails.color);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBackToDashboard} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment Status</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(20, insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <ErrorIcon size={64} color={errorDetails.color} strokeWidth={1.5} />
          </View>
        </View>
        <Text style={styles.title}>{errorDetails.title}</Text>
        <Text style={styles.subtitle}>{errorDetails.message}</Text>

        {reference ? (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Reference</Text>
            <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
              {reference}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {errorType !== 'cancelled' && (
          <Button title="Try Again" onPress={handleTryAgain} style={styles.primaryButton} icon={RefreshCw} disabled={refreshing} />
        )}
        {reference && errorType !== 'cancelled' && (
          <Button
            title={refreshing ? 'Checking…' : 'Refresh balance'}
            onPress={handleRefreshBalance}
            variant="outline"
            style={styles.secondaryButton}
            icon={refreshing ? undefined : Wallet}
            disabled={refreshing}
          />
        )}
        <Button
          title={errorType === 'cancelled' ? 'Back to Dashboard' : 'Go to Dashboard'}
          onPress={handleBackToDashboard}
          variant={errorType === 'cancelled' ? 'primary' : 'outline'}
          style={errorType === 'cancelled' ? styles.primaryButton : styles.secondaryButton}
          icon={Home}
        />
      </View>
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, errorColor: string) =>
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
    iconContainer: { marginBottom: 24 },
    iconBackground: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: errorColor + '20',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: errorColor + '40',
    },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 32, textAlign: 'center', lineHeight: 24 },
    detailsCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
    detailValue: { fontSize: 14, fontWeight: '500', color: colors.text },
    footer: { padding: 24, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
    primaryButton: { backgroundColor: colors.primary, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    secondaryButton: { borderColor: colors.border, height: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  });
