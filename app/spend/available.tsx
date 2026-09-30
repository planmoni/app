import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Send, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { useBalance } from '@/contexts/BalanceContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';

export default function SpendAvailableScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const amount = parseFloat(params.amount as string) || 0;
  
  const { expensePlansBalance, refreshWallet } = useBalance() as any;
  const { payoutAccounts, fetchPayoutAccounts } = usePayoutAccounts();
  const [isProcessing, setIsProcessing] = useState(false);

  const availableToSpend = expensePlansBalance || amount;

  useEffect(() => {
    fetchPayoutAccounts();
  }, []);

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const handleBack = () => {
    haptics.selection();
    router.back();
  };

  const handleSchedule = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/create-payout/schedule',
      params: {
        amount: availableToSpend.toString(),
        source: 'available_to_spend',
      },
    });
  };

  const handleWithdraw = async () => {
    if (availableToSpend <= 0) {
      Alert.alert('No Funds', 'There are no funds available to withdraw.');
      haptics.notification();
      return;
    }

    if (!payoutAccounts || payoutAccounts.length === 0) {
      Alert.alert(
        'No Account',
        'Please add a payout account first to withdraw funds.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Account', onPress: () => router.push('/payout-accounts') },
        ]
      );
      haptics.notification();
      return;
    }

    const defaultAccount = payoutAccounts.find(acc => acc.is_default) || payoutAccounts[0];
    
    Alert.alert(
      'Withdraw Available to Spend',
      `Withdraw ${formatBalance(availableToSpend)} to ${defaultAccount.bank_name} ••••${defaultAccount.account_number.slice(-4)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'default',
          onPress: async () => {
            haptics.mediumImpact();
            setIsProcessing(true);
            
            try {
              // Get session token
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (!currentSession) {
                Alert.alert('Error', 'Please log in to continue.');
                haptics.notification();
                return;
              }

              // Call edge function to withdraw available to spend
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/withdraw-available-to-spend`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentSession.access_token}`,
                  },
                  body: JSON.stringify({
                    amount: availableToSpend,
                    accountId: defaultAccount.id,
                  }),
                }
              );

              const result = await response.json();

              if (!response.ok || !result.success) {
                console.error('Error withdrawing available to spend:', result);
                Alert.alert('Error', result.error || 'Failed to withdraw funds. Please try again.');
                haptics.notification();
                return;
              }

              // Refresh wallet balance
              await refreshWallet('spend');

              haptics.notification();
              Alert.alert(
                'Withdrawal Successful',
                `${formatBalance(availableToSpend)} has been transferred to your account.`,
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error processing withdrawal:', error);
              Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
              haptics.notification();
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Available to Spend</Text>
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
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available to Spend</Text>
          <Text style={styles.balanceAmount}>{formatBalance(availableToSpend)}</Text>
          <Text style={styles.balanceSubtext}>
            Extra funds from budgets
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={[styles.actionButton, styles.scheduleButton]}
            onPress={handleSchedule}
            disabled={isProcessing}
          >
            <Calendar size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, styles.scheduleButtonText]}>
              Schedule
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={handleWithdraw}
            disabled={isProcessing || availableToSpend <= 0}
          >
            <Send size={20} color={colors.primary} />
            <Text style={[styles.actionButtonText, styles.withdrawButtonText]}>
              Withdraw
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    balanceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 40 : 36, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    balanceSubtext: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    actionsContainer: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    scheduleButton: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
    },
    withdrawButton: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary + '30',
    },
    actionButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
    },
    scheduleButtonText: {
      color: colors.text,
    },
    withdrawButtonText: {
      color: colors.primary,
    },
  });

