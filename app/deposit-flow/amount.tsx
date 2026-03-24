import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState, useRef, useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { calculateMonoDirectPayFee } from '@/lib/mono-fee';
import Constants from 'expo-constants';

export default function AmountScreen() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const methodId = params.methodId as string;
  const methodTitle = params.methodTitle as string;
  const newMethodType = params.newMethodType as string;
  const monoAccountId = params.monoAccountId as string;
  const accountId = params.accountId as string;
  const bankName = params.bankName as string;
  
  const [amount, setAmount] = useState('');
  const [isInitiatingDirectPay, setIsInitiatingDirectPay] = useState(false);
  const { balance, lockedBalance } = useBalance();
  const availableBalance = balance - lockedBalance; //the avialable balance logic
  const inputRef = useRef<TextInput>(null);

  const isMonoDirectPay = newMethodType === 'mono-directpay';
  const numericAmount = Number((amount || '0').replace(/,/g, ''));
  const feeInfo = useMemo(
    () => (isMonoDirectPay && numericAmount > 0 ? calculateMonoDirectPayFee(numericAmount) : null),
    [isMonoDirectPay, numericAmount]
  );
  const balanceFormatted = useMemo(
    () => availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [availableBalance]
  );
  const [balanceWhole, balanceDec] = balanceFormatted.split('.');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleContinue = async () => {
    if (newMethodType) {
      // If coming from a new payment method selection, route to the appropriate screen
      if (newMethodType === 'card') {
        router.push({
          pathname: '/add-card',
          params: {
            amount,
            fromDepositFlow: 'true'
          }
        });
      } else if (newMethodType === 'ussd') {
        router.push({
          pathname: '/add-ussd',
          params: {
            amount,
            fromDepositFlow: 'true'
          }
        });
      } else if (newMethodType === 'bank-account') {
        router.push({
          pathname: '/linked-accounts',
          params: {
            amount,
            fromDepositFlow: 'true'
          }
        });
      } else if (newMethodType === 'mono-directpay') {
        const amountNum = Number(amount.replace(/,/g, ''));
        if (!Number.isFinite(amountNum) || amountNum < 200) {
          Alert.alert('Invalid amount', 'Please enter at least ₦200.');
          return;
        }
        if (amountNum > 10_000_000) {
          Alert.alert('Invalid amount', 'Maximum amount is ₦10,000,000.');
          return;
        }
        const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl || !session?.access_token) {
          Alert.alert('Error', 'Unable to start payment. Please sign in again.');
          return;
        }
        setIsInitiatingDirectPay(true);
        try {
          const redirectUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mono-redirect`;
          const res = await fetch(`${supabaseUrl}/functions/v1/mono-directpay-initiate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ creditAmount: amountNum, redirect_url: redirectUrl }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            Alert.alert('Payment could not be started', data.error || 'Please try again.');
            return;
          }
          if (!data.mono_url) {
            Alert.alert('Error', 'Invalid response from server.');
            return;
          }
          router.push({
            pathname: '/deposit-flow/mono-directpay-widget',
            params: { monoUrl: data.mono_url },
          });
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
          setIsInitiatingDirectPay(false);
        }
      } else if (newMethodType === 'mono-pay') {
        // Navigate to authorization with Mono DirectDebit info
        router.push({
          pathname: '/deposit-flow/authorization',
          params: {
            amount,
            methodId: accountId,
            methodTitle: `${bankName || 'Bank'} • DirectDebit`,
            monoAccountId: monoAccountId,
            paymentType: 'mono-directdebit'
          }
        });
      }
    } else {
      // For existing payment methods, continue with normal flow
      router.replace({
        pathname: '/deposit-flow/authorization',
        params: {
          amount,
          methodId,
          methodTitle
        }
      });
    }
  };

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleAmountChange = (value: string) => {
    const formattedValue = formatAmount(value);
    setAmount(formattedValue);
  };

  const handleQuickAmount = (value: string) => {
    setAmount(value);
  };
  
  const styles = createStyles(colors, isSmallScreen, isMonoDirectPay);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds from Bank</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.stepText}>Step 2 of 3</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {isMonoDirectPay ? (
            <>
              <View style={styles.amountSection}>
                <Text style={styles.label}>Enter Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₦</Text>
                  <TextInput
                    ref={inputRef}
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={handleAmountChange}
                  />
                </View>
                <Text style={styles.amountHint}>
                  Min: ₦200 • Max: ₦10,000,000
                </Text>
              </View>

              {feeInfo && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Payment Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount</Text>
                    <Text style={styles.summaryValue}>
                      ₦{numericAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Processing fee (0.5%)</Text>
                    <Text style={[styles.summaryValue, styles.feeText]}>
                      ₦{feeInfo.baseFee.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  {feeInfo.stamp > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Stamp duty</Text>
                      <Text style={[styles.summaryValue, styles.feeText]}>
                        ₦{feeInfo.stamp.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>VAT (7.5%)</Text>
                    <Text style={[styles.summaryValue, styles.feeText]}>
                      ₦{feeInfo.vat.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                    <Text style={styles.summaryTotalLabel}>You will be charged</Text>
                    <Text style={styles.summaryTotalValue}>
                      ₦{feeInfo.totalCharged.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.infoText}>Powered by Mono.</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>How much do you want to add?</Text>

              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={handleAmountChange}
                />
              </View>

              {feeInfo && (
                <View style={styles.feeCard}>
                  <Text style={styles.feeCardTitle}>Fee breakdown</Text>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Processing fee (0.5%)</Text>
                    <Text style={styles.feeValue}>₦{feeInfo.baseFee.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                  {feeInfo.stamp > 0 && (
                    <View style={styles.feeRow}>
                      <Text style={styles.feeLabel}>Stamp duty</Text>
                      <Text style={styles.feeValue}>₦{feeInfo.stamp.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>VAT (7.5%)</Text>
                    <Text style={styles.feeValue}>₦{feeInfo.vat.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLabel}>Total fee</Text>
                    <Text style={styles.feeTotalValue}>₦{feeInfo.fee.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLabel}>You will be charged</Text>
                    <Text style={styles.feeTotalValue}>₦{feeInfo.totalCharged.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isInitiatingDirectPay ? 'Opening...' : 'Continue'}
        onPress={handleContinue}
        disabled={!amount || isInitiatingDirectPay}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean, isMonoDirectPay: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBar: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: isSmallScreen ? 16 : 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  // Paystack-aligned styles for Mono
  amountSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  amountHint: {
    fontSize: isSmallScreen ? 12 : 13,
    color: colors.textSecondary,
    marginTop: 8,
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: isSmallScreen ? 14 : 15,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
    color: colors.text,
  },
  feeText: {
    color: colors.textSecondary,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Non-Mono styles
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  quickAmount: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountActive: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.primary,
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickAmountTextActive: {
    color: colors.primary,
  },
  balanceContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  feeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  feeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  feeValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 8,
  },
  feeTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feeTotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});