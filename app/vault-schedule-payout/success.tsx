import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { formatDisplayDate, formatPayoutFrequency } from '@/lib/formatters';
import { replaceToVaultsHomeTab } from '@/lib/replaceToVaultsHomeTab';
import { Building2, X } from 'lucide-react-native';

export default function VaultScheduleSuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const mountedRef = useRef(true);

  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 768;

  const totalAmount = (params.totalAmount as string) || '0';
  const frequency = (params.frequency as string) || 'monthly';
  const payoutAmount = (params.payoutAmount as string) || '0';
  const startDate = (params.startDate as string) || '';
  const bankName = (params.bankName as string) || '';
  const accountNumber = (params.accountNumber as string) || '';
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string, 10) : undefined;

  const formatAmount = (amount: string) => {
    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(numericAmount)) return '₦0';
    return `₦${numericAmount.toLocaleString()}`;
  };

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
    };
  }, [haptics]);

  const handleBackToVault = () => {
    haptics.mediumImpact();
    replaceToVaultsHomeTab();
  };

  const styles = createStyles(colors, isSmallScreen, isMediumScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Schedule created</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.replace('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />

        <Text style={styles.title}>You are all set</Text>
        <Text style={styles.subtitle}>
          Your vault payout schedule is active. The total was committed from your vault, including
          applicable fees.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.amount}>{formatAmount(totalAmount)}</Text>
          <Text style={styles.description}>
            Paid out in {formatPayoutFrequency(frequency, dayOfWeek).toLowerCase()} installments
            of{' '}
            <Text style={styles.highlight}>{formatAmount(payoutAmount)}</Text>
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>First payout</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {formatDisplayDate(startDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {bankName} •••• {accountNumber.slice(-4)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bankRow}>
          <Building2 size={20} color={colors.textSecondary} />
          <Text style={styles.bankHint}>Bank transfers follow your schedule when processing runs.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Back to vault" onPress={handleBackToVault} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean, isMediumScreen: boolean) =>
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
    headerSpacer: {
      width: 40,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
      paddingBottom: 32,
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    summaryCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    amount: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    highlight: {
      fontWeight: '700',
      color: colors.text,
    },
    detailsContainer: {
      gap: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    bankRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 8,
    },
    bankHint: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    footer: {
      padding: 20,
      paddingBottom: 28,
      backgroundColor: colors.backgroundSecondary,
    },
  });
