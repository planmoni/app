import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

export default function WithdrawAmountScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  
  const { expensePlans } = useExpensePlans();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<TextInput>(null);

  const plan = expensePlans.find(p => p.id === planId);
  const currentBalance = (plan as any)?.current_balance || 0;
  const maxAmount = currentBalance;

  useEffect(() => {
    const timeout = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const formatAmount = (value: string) => {
    // Remove all non-numeric characters except decimal point
    let cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points - keep only the first one
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    
    // Split by decimal point
    const [integerPart, decimalPart] = cleanValue.split('.');
    
    // Format integer part with commas (only if it has digits)
    const formattedInteger = integerPart ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
    
    // Limit decimal part to 2 digits
    const limitedDecimalPart = decimalPart ? decimalPart.substring(0, 2) : '';
    
    // Return formatted amount with decimal part if it exists
    return limitedDecimalPart ? `${formattedInteger}.${limitedDecimalPart}` : formattedInteger;
  };

  const handleAmountChange = (value: string) => {
    const formattedValue = formatAmount(value);
    setAmount(formattedValue);
    setError(null);
  };

  const handleMaxPress = () => {
    haptics.selection();
    setAmount(formatAmount(maxAmount.toString()));
    setError(null);
  };

  const numericAmount = useMemo(() => {
    const num = parseFloat(amount.replace(/,/g, '') || '0');
    return isNaN(num) ? 0 : num;
  }, [amount]);

  const isValid = useMemo(() => {
    return numericAmount > 0 && numericAmount <= maxAmount;
  }, [numericAmount, maxAmount]);

  const handleContinue = () => {
    if (!amount) {
      setError('Please enter an amount');
      haptics.notification();
      return;
    }

    if (numericAmount <= 0) {
      setError('Amount must be greater than 0');
      haptics.notification();
      return;
    }

    if (numericAmount > maxAmount) {
      setError(`Amount cannot exceed available balance of ₦${maxAmount.toLocaleString()}`);
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/withdraw',
      params: {
        id: planId,
        amount: numericAmount.toString(),
      },
    });
  };

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Not Found</Text>
          <Pressable 
            onPress={() => {
              haptics.selection();
              router.back();
            }} 
            style={styles.closeButton}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.back();
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>How much would you like to withdraw?</Text>
          <Text style={styles.description}>
            Enter the amount you want to withdraw from "{plan.name}"
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={[
            styles.amountContainer,
            amount.trim() !== '' && styles.amountContainerFilled,
            error && styles.amountContainerError,
          ]}>
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
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>{formatBalance(maxAmount)}</Text>
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
        disabled={!isValid}
        hapticType="medium"
      />
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
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: 100,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    errorContainer: {
      backgroundColor: colors.errorLight || '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error || '#DC2626',
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
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
      minHeight: 64,
    },
    amountContainerFilled: {
      borderColor: colors.accent || colors.primary,
      backgroundColor: colors.accentBackground || colors.background,
    },
    amountContainerError: {
      borderColor: colors.error || '#DC2626',
    },
    currencySymbol: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
    balanceContainer: {
      marginBottom: 24,
    },
    balanceLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 8,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    balanceAmount: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    maxButton: {
      backgroundColor: colors.primary || '#1E3A8A',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    maxButtonText: {
      color: '#FFFFFF',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
    },
  });

