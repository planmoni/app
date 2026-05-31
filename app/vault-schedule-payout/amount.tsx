import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useState, useEffect, useRef, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function VaultScheduleAmountScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const { expensePlans, isLoading } = useExpensePlans();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const haptics = useHaptics();
  const amountInputRef = useRef<TextInput>(null);

  const plan = useMemo(
    () => expensePlans.find((p) => p.id === planId),
    [expensePlans, planId]
  );

  const currentBalance = (plan as any)?.current_balance ?? 0;
  const totalBudget = plan?.total_budget ?? 0;
  const maxVaultAmount = Math.min(
    Number(currentBalance) || 0,
    Number(totalBudget) > 0 ? Number(totalBudget) : Number(currentBalance) || 0
  );

  const balanceFormatted = maxVaultAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [balanceWhole, balanceDec] = balanceFormatted.split('.');

  useEffect(() => {
    if (params.totalAmount) {
      setAmount((params.totalAmount as string).replace(/,/g, ''));
    }
  }, [params.totalAmount]);

  useEffect(() => {
    const t = setTimeout(() => amountInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleContinue = () => {
    if (!amount) {
      setError('Please enter an amount');
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (numericAmount < 1000) {
      setError('Minimum amount is ₦1,000');
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (numericAmount > maxVaultAmount) {
      setError('Amount exceeds your vault spendable balance for this plan');
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/create-payout/frequency-selection',
      params: {
        totalAmount: amount,
        vaultPlanId: planId,
        vaultMaxAmount: String(maxVaultAmount),
        vaultMaturityDate: plan?.start_date || '',
      },
    });
  };

  const formatAmount = (value: string) => {
    let cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('');
    }
    const [integerPart, decimalPart] = cleanValue.split('.');
    const formattedInteger = integerPart
      ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : '';
    const limitedDecimalPart = decimalPart ? decimalPart.substring(0, 2) : '';
    return limitedDecimalPart
      ? `${formattedInteger}.${limitedDecimalPart}`
      : formattedInteger;
  };

  const handleAmountChange = (value: string) => {
    setAmount(formatAmount(value));
    setError(null);
  };

  const handleMaxPress = () => {
    haptics.selection();
    setAmount(formatAmount(maxVaultAmount.toString()));
    setError(null);
  };

  const styles = createStyles(colors);

  if (!planId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Missing plan</Text>
      </SafeAreaView>
    );
  }

  if (isLoading && !plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.description}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Plan not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vault payout schedule</Text>
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

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '25%' }]} />
        </View>
        <Text style={styles.stepText}>Step 1 of 4</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>How much should we schedule?</Text>
          <Text style={styles.description}>
            This amount will be committed from your vault in one go, including any applicable fees.
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View
            style={[
              styles.amountContainer,
              amount.trim() !== '' && styles.amountContainerFilled,
              error && styles.amountContainerError,
            ]}
          >
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
            />
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Max (vault cap)</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>
                ₦{balanceWhole}
                <Text style={{ color: colors.textTertiary }}>.{balanceDec ?? '00'}</Text>
              </Text>
              <Pressable style={styles.maxButton} onPress={handleMaxPress}>
                <Text style={styles.maxButtonText}>Max</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!amount}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
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
      marginRight: 8,
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
      marginLeft: 8,
    },
    progressContainer: {
      padding: 20,
      paddingBottom: 0,
      backgroundColor: colors.surface,
    },
    progressBar: {
      height: 2,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#1E3A8A',
      borderRadius: 2,
    },
    stepText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    content: {
      padding: 20,
      paddingTop: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 0,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    amountContainerFilled: {
      borderColor: '#1E3A8A',
    },
    amountContainerError: {
      borderColor: colors.error,
    },
    currencySymbol: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      paddingVertical: 12,
    },
    balanceContainer: {
      marginTop: 8,
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    balanceAmount: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    maxButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 8,
    },
    maxButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1E3A8A',
    },
  });
