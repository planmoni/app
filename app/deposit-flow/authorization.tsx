import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Clock, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Button from '@/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useInitiateMandate } from '@/hooks/useInitiateMandate';
import { useFundWallet } from '@/hooks/useFundWallet';
import { useUserMandates } from '@/hooks/useMandateStatus';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';

export default function AuthorizationScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const amount = params.amount as string;
  const methodId = params.methodId as string;
  const methodTitle = params.methodTitle as string;
  const newMethodType = params.newMethodType as string;
  const paymentType = params.paymentType as string;
  const monoAccountId = params.monoAccountId as string;
  const bankName = params.bankName as string;
  const { refreshWallet } = useBalance();
  const haptics = useHaptics();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // DirectDebit hooks
  const { mutate: initiateMandate, isPending: isCreatingMandate } = useInitiateMandate();
  const { mutate: fundWallet, isPending: isFunding } = useFundWallet();
  const { data: mandates, isLoading: isLoadingMandates } = useUserMandates();
  const { bankAccounts } = useRealtimeBankAccounts();
  
  // Find the bank account
  const bankAccount = bankAccounts.find(acc => acc.id === methodId || acc.mono_account_id === monoAccountId);

  const handleFundWallet = async () => {
    try {
      setIsProcessing(true);
      
      // For DirectDebit, check if mandate exists and is active
      if (paymentType === 'mono-directdebit' && bankAccount && monoAccountId) {
        const numericAmount = parseFloat(amount.replace(/,/g, ''));
        
        // Find active mandate for this bank account
        const activeMandate = mandates?.find(
          m => m.bank_account_id === bankAccount.id && m.status === 'active'
        );
        
        if (!activeMandate) {
          // No active mandate - create one first
          Alert.alert(
            'Mandate Required',
            'You need to authorize a mandate first. This allows us to debit your bank account only when you choose to fund your wallet, up to ₦1,000,000 total. You can cancel anytime.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessing(false) },
              {
                text: 'Authorize',
                onPress: async () => {
                  try {
                    initiateMandate(
                      {
                        bankAccountId: bankAccount.id,
                        monoAccountId: monoAccountId,
                        accountName: bankAccount.account_name,
                        accountNumber: bankAccount.account_number,
                        bankName: bankAccount.bank_name,
                        amount: 1000000, // Maximum authorization: ₦1,000,000
                      },
                      {
                        onSuccess: (data) => {
                          // If mandate URL is provided, open Mono widget for authorization
                          if (data.mono_url) {
                            // User needs to authorize via Mono widget
                            Alert.alert(
                              'Authorization Required',
                              'Please authorize the mandate using the Mono widget. After authorization, you can fund your wallet.',
                              [
                                { 
                                  text: 'OK',
                                  onPress: () => {
                                    setIsProcessing(false);
                                    // Navigate back - user will need to retry after authorization
                                  }
                                }
                              ]
                            );
                          } else if (data.status === 'active') {
                            // Mandate already active, proceed with debit
                            handleExecuteDebit(data.mandate.id, numericAmount);
                          } else {
                            setIsProcessing(false);
                            Alert.alert('Info', 'Mandate created. Please authorize it and try again.');
                          }
                        },
                        onError: (error) => {
                          haptics.error();
                          Alert.alert('Error', error.message || 'Failed to create mandate');
                          setIsProcessing(false);
                        },
                      }
                    );
                  } catch (error) {
                    haptics.error();
                    Alert.alert('Error', 'Failed to initiate mandate');
                    setIsProcessing(false);
                  }
                },
              },
            ]
          );
          return;
        }
        
        // Execute debit using active mandate
        handleExecuteDebit(activeMandate.id, numericAmount);
      } else {
        // For other payment methods, process normally (if needed)
        haptics.error();
        Alert.alert('Error', 'Invalid payment method');
        setIsProcessing(false);
      }
    } catch (error) {
      haptics.error();
      console.error('Error funding wallet:', error);
      setIsProcessing(false);
    }
  };

  const handleExecuteDebit = (mandateId: string, amount: number) => {
    fundWallet(
      {
        mandateId,
        amount,
        description: `Wallet funding: ₦${amount}`,
      },
      {
        onSuccess: () => {
          haptics.success();
          refreshWallet();
          router.replace({
            pathname: '/deposit-flow/success',
            params: {
              amount: amount.toString(),
              methodTitle: `${bankName || 'Bank'} • DirectDebit`,
            },
          });
        },
        onError: (error) => {
          haptics.error();
          Alert.alert('Payment Error', error.message || 'Failed to fund wallet');
          setIsProcessing(false);
        },
      }
    );
  };

  const handleMonoSuccess = () => {
    haptics.success();
    refreshWallet();
      router.replace({
        pathname: '/deposit-flow/success',
        params: {
          amount,
          methodTitle: `${bankName || 'Bank'} • DirectDebit`
        }
      });
  };

  const handleMonoError = (error: string) => {
    haptics.error();
    Alert.alert('Payment Error', error);
    setIsProcessing(false);
  };

  const getMethodTitle = (type: string): string => {
    switch (type) {
      case 'card':
        return 'New Card';
      case 'ussd':
        return 'USSD Payment';
      case 'bank-account':
        return 'Bank Account';
      case 'mono-pay':
        return `${bankName || 'Bank'} • DirectDebit`;
      default:
        return 'New Payment Method';
    }
  };

  // DirectPay removed - using DirectDebit with mandates instead

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 3</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Payment Authorization</Text>
          <Text style={styles.description}>Review your deposit details before proceeding.</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Deposit Summary</Text>
            </View>

            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>₦{amount}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Method</Text>
                <View style={styles.methodContainer}>
                  <Building2 size={16} color={colors.primary} />
                  <Text style={styles.methodText}>
                    {methodTitle || getMethodTitle(newMethodType)}
                  </Text>
                </View>
              </View>
              {methodId && <Text style={styles.defaultText}>Default Account</Text>}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Fee</Text>
                <Text style={styles.summaryValue}>₦0.00</Text>
              </View>

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₦{amount}</Text>
              </View>

              <View style={styles.estimateContainer}>
                <Clock size={16} color={colors.primary} />
                <Text style={styles.estimateLabel}>Estimated Time to Reflect</Text>
                <Text style={styles.estimateValue}>Instant - 5 minutes</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertTriangle size={20} color={colors.primary} />
              </View>
              <Text style={styles.infoTitle}>Security Notice</Text>
            </View>
            <Text style={styles.infoText}>
              Your transaction will require PIN verification for security.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={
          isProcessing || isCreatingMandate || isFunding 
            ? "Processing..." 
            : paymentType === 'mono-directdebit' 
              ? "Fund wallet now" 
              : "Fund wallet now"
        }
        onPress={handleFundWallet}
        disabled={isProcessing || isCreatingMandate || isFunding || isLoadingMandates}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
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
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  summaryHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  summaryContent: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  defaultText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 16,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  estimateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  estimateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
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
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});