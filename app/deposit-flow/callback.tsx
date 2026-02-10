import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';

export default function DepositCallbackScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const reference = (params.reference as string) ?? '';
  const status = (params.status as string) ?? '';
  const reason = (params.reason as string) ?? '';
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

      // Rely on webhook to credit the wallet. Show processing screen; realtime will
      // navigate to success when the webhook updates the payment row.
      if (isSuccess) {
        if (!cancelled) {
          router.replace({
            pathname: '/deposit-flow/mono-processing',
            params: { reference },
          });
        }
        setLoading(false);
        return;
      }

      // Status was failed/other — show processing/wait message instead of hard failure
      // (payment may still be settling; webhook can credit shortly)
      if (!cancelled) {
        router.replace({
          pathname: '/deposit-flow/mono-processing',
          params: { reference, waitMessage: 'true' },
        });
        setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reference, status, reason]);

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
