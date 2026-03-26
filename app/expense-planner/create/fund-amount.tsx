import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useRealtimeWallet } from '@/hooks/useRealtimeWallet';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function FundAmountScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const { availableBalance } = useRealtimeWallet();
  const { addFundsToPlan } = useExpensePlans();
  
  const planId = params.planId as string;
  const planName = params.planName as string;
  const totalBudget = parseFloat((params.totalBudget as string) || '0');
  const currentBalance = parseFloat((params.currentBalance as string) || '0');
  
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSmallScreen = screenWidth < 380;

  const remainingToAllocate = useMemo(() => {
    return Math.max(0, totalBudget - currentBalance);
  }, [totalBudget, currentBalance]);

  // Maximum amount is the minimum of available balance and remaining to allocate
  const maxAmount = useMemo(() => {
    return Math.min(availableBalance, remainingToAllocate);
  }, [availableBalance, remainingToAllocate]);

  const formatAmount = (value: string) => {
    // Remove all non-numeric characters except decimal point
    let cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return cleanValue;
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatAmount(text);
    const numValue = parseFloat(formatted.replace(/,/g, '') || '0');
    
    // Cap the amount at the maximum allowed
    if (!isNaN(numValue) && numValue > maxAmount) {
      setAmount(maxAmount.toString());
    } else {
      setAmount(formatted);
    }
  };

  const numericAmount = useMemo(() => {
    const num = parseFloat(amount.replace(/,/g, '') || '0');
    return isNaN(num) ? 0 : num;
  }, [amount]);

  const newBalanceAfterAdd = useMemo(() => {
    return currentBalance + numericAmount;
  }, [currentBalance, numericAmount]);

  const isValid = useMemo(() => {
    return numericAmount > 0 && numericAmount <= maxAmount;
  }, [numericAmount, maxAmount]);

  const errorMessage = useMemo(() => {
    if (numericAmount <= 0 && amount.trim() !== '') {
      return 'Amount must be greater than 0';
    }
    if (numericAmount > availableBalance) {
      return `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`;
    }
    if (numericAmount > remainingToAllocate) {
      return `Maximum amount is ₦${remainingToAllocate.toLocaleString()} (remaining balance needed)`;
    }
    return null;
  }, [numericAmount, availableBalance, remainingToAllocate, amount]);

  const handleContinue = async () => {
    if (!isValid) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsLoading(true);

    try {
      const result = await addFundsToPlan(planId, numericAmount);
      
      if (result && result.success) {
        haptics.success();
        // Navigate to success screen
        router.replace({
          pathname: '/expense-planner/create/fund-amount-success',
          params: {
            planId,
            planName,
            amountAdded: numericAmount.toString(),
            newBalance: (result.new_plan_balance || newBalanceAfterAdd).toString(),
            totalBudget: totalBudget.toString(),
          },
        });
      } else {
        const errorMsg = (result as any)?.error || 'Failed to add funds';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error adding funds:', error);
      haptics.error();
      Alert.alert(
        'Error',
        error.message || 'Failed to add funds to plan. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleUseMaximum = () => {
    haptics.selection();
    setAmount(maxAmount.toString());
  };

  const styles = createStyles(colors, isDark, isSmallScreen, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds to Plan</Text>
        <Pressable 
          onPress={handleBack} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.wrapperContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount Input Section - Moved to Top */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>How much would you like to add?</Text>
            <View
              style={[
                styles.amountInputContainer,
                errorMessage && styles.amountInputContainerError,
                isValid && amount.trim() !== '' && styles.amountInputContainerValid,
              ]}
            >
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus
              />
            </View>
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}

            {/* Use Maximum Button */}
            {remainingToAllocate > 0 && maxAmount > 0 && (
              <Pressable 
                style={styles.useMaxButton}
                onPress={handleUseMaximum}
              >
                <Text style={styles.useMaxText}>
                  Use Maximum (₦{maxAmount.toLocaleString()})
                </Text>
              </Pressable>
            )}
            
            {/* Available Balance and Total Budget under input */}
            {/* <View style={styles.balanceInfoRow}>
              <View style={styles.balanceInfoItem}>
                <Text style={styles.balanceInfoLabel}>Available Balance</Text>
                <Text style={styles.balanceInfoAmount}>
                  ₦{availableBalance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.balanceInfoItem}>
                <Text style={styles.balanceInfoLabel}>Total Budget</Text>
                <Text style={styles.balanceInfoAmount}>
                  ₦{totalBudget.toLocaleString()}
                </Text>
              </View>
            </View> */}
          </View>


          {/* Preview Section */}
          {isValid && numericAmount > 0 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>New Plan Balance</Text>
              <Text style={styles.previewAmount}>
                ₦{newBalanceAfterAdd.toLocaleString()}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Add Funds"
        onPress={handleContinue}
        disabled={!isValid || isLoading}
        hapticType="medium"
        loading={isLoading}
      />
    </SafeAreaView>
  );
}

const createStyles = (
  colors: any,
  isDark: boolean,
  isSmallScreen: boolean,
  textSizeMultiplier: number
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
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
  headerTitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
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
  wrapperContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
    paddingBottom: 100,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  amountInputContainerError: {
    borderColor: '#EF4444',
  },
  amountInputContainerValid: {
    borderColor: colors.primary,
  },
  currencySymbol: {
    fontSize: getScaledFontSize(isSmallScreen ? 24 : 28, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: getScaledFontSize(isSmallScreen ? 24 : 28, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  errorText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: '#EF4444',
    marginTop: 8,
  },
  useMaxButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  useMaxText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.primary,
    fontWeight: '600',
  },
  balanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  balanceInfoItem: {
    flex: 1,
  },
  balanceInfoLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceInfoAmount: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  previewLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  previewAmount: {
    fontSize: getScaledFontSize(isSmallScreen ? 24 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: colors.primary,
  },
});

