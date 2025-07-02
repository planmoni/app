import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Smartphone, Copy, Info, Phone, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { useBalance } from '@/contexts/BalanceContext';
import { useUSSD } from '@/hooks/useUSSD';
import { useBanks, Bank } from '@/hooks/useBanks';

export default function AddUSSDScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const { addFunds } = useBalance();
  const { 
    initializeUSSD, 
    checkPaymentStatus, 
    checkUSSDAvailability,
    bankAvailability,
    isLoading, 
    isVerifying,
    isCheckingAvailability 
  } = useUSSD();
  const { banks, isLoading: banksLoading } = useBanks();
  const params = useLocalSearchParams();
  const amountFromParams = params.amount as string;
  const fromDepositFlow = params.fromDepositFlow === 'true';
  
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [amount, setAmount] = useState(amountFromParams || '');
  const [ussdCode, setUssdCode] = useState('');
  const [reference, setReference] = useState('');
  const [paymentInitiated, setPaymentInitiated] = useState(false);

  // Check USSD availability when component mounts
  useEffect(() => {
    checkUSSDAvailability();
  }, []);

  // Filter banks that support USSD (only the 4 banks supported by Paystack)
  const ussdBanks = banks.filter(bank => {
    const paystackSupportedBanks = [
      '058', // GTBank
      '033', // UBA
      '232', // Sterling Bank
      '057', // Zenith Bank
    ];
    return paystackSupportedBanks.includes(bank.code);
  });

  // Get available banks based on real-time check
  const availableBanks = ussdBanks.filter(bank => {
    const availability = bankAvailability.find(av => av.bankCode === bank.code);
    return availability?.isAvailable;
  });

  // Get unavailable banks for display
  const unavailableBanks = ussdBanks.filter(bank => {
    const availability = bankAvailability.find(av => av.bankCode === bank.code);
    return availability && !availability.isAvailable;
  });

  // Generate USSD codes for supported banks (these are the actual USSD codes users will dial)
  const getUSSDCode = (bankCode: string) => {
    const ussdCodes: { [key: string]: string } = {
      '058': '*737#', // GTBank
      '033': '*919#', // UBA
      '232': '*822#', // Sterling Bank
      '057': '*966#', // Zenith Bank
    };
    return ussdCodes[bankCode] || '*000#';
  };

  const handleBankSelect = (bank: Bank) => {
    haptics.selection();
    setSelectedBank(bank);
    setUssdCode(''); // Clear previous USSD code
    setPaymentInitiated(false);
  };

  const handleAmountChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
    setUssdCode(''); // Clear USSD code when amount changes
    setPaymentInitiated(false);
  };

  const handleCopyCode = () => {
    haptics.selection();
    // In a real app, you would copy the code to clipboard
    showToast('USSD code copied to clipboard', 'success');
  };

  const handleInitializePayment = async () => {
    if (!selectedBank) {
      haptics.error();
      showToast('Please select a bank', 'error');
      return;
    }
    
    if (!amount) {
      haptics.error();
      showToast('Please enter an amount', 'error');
      return;
    }

    haptics.impact();

    try {
      const result = await initializeUSSD(amount, selectedBank.code, '');
      
      if (result?.status === 'success' && result.data) {
        setUssdCode(result.data.ussd_code);
        setReference(result.data.reference);
        setPaymentInitiated(true);
        haptics.success();
        showToast('USSD payment initialized successfully', 'success');
      }
    } catch (error) {
      haptics.error();
      console.error('Error initializing USSD payment:', error);
    }
  };

  const handleCheckPayment = async () => {
    if (!reference) {
      showToast('No payment reference found', 'error');
      return;
    }

    haptics.impact();
    const success = await checkPaymentStatus(reference);
    
    if (success) {
      if (fromDepositFlow) {
        router.replace('/deposit-flow/success');
      } else {
        router.back();
      }
    }
  };

  const handleContinue = async () => {
    if (paymentInitiated && ussdCode) {
      // Show confirmation dialog
      Alert.alert(
        'Complete USSD Payment',
        'Have you completed the USSD payment?',
        [
          {
            text: 'Not Yet',
            style: 'cancel'
          },
          {
            text: 'Yes, Check Status',
            onPress: handleCheckPayment
          }
        ]
      );
    } else {
      await handleInitializePayment();
    }
  };

  const handleRefreshAvailability = async () => {
    haptics.impact();
    await checkUSSDAvailability();
    showToast('Bank availability updated', 'success');
  };

  const styles = createStyles(colors, isDark);

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
        <Text style={styles.headerTitle}>USSD Payment</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Pay with USSD</Text>
          <Text style={styles.description}>
            Make a payment using your bank's USSD code. Currently, GTBank is the most reliable option.
          </Text>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Select Bank</Text>
                <Pressable 
                  style={styles.refreshButton} 
                  onPress={handleRefreshAvailability}
                  disabled={isCheckingAvailability}
                >
                  <RefreshCw 
                    size={16} 
                    color={colors.primary} 
                    style={isCheckingAvailability ? { opacity: 0.5 } : undefined}
                  />
                </Pressable>
              </View>
              {isCheckingAvailability ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Checking bank availability...</Text>
                </View>
              ) : banksLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading banks...</Text>
                </View>
              ) : (
                <>
                  {availableBanks.length > 0 ? (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.banksContainer}
                    >
                      {availableBanks.map(bank => (
                        <Pressable
                          key={bank.id}
                          style={[
                            styles.bankOption,
                            selectedBank?.id === bank.id && styles.selectedBankOption
                          ]}
                          onPress={() => handleBankSelect(bank)}
                        >
                          <Text style={[
                            styles.bankName,
                            selectedBank?.id === bank.id && styles.selectedBankName
                          ]}>
                            {bank.name}
                            <Text style={styles.availableBadge}> • Available</Text>
                          </Text>
                          <Text style={[
                            styles.bankCode,
                            selectedBank?.id === bank.id && styles.selectedBankCode
                          ]}>
                            {getUSSDCode(bank.code)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.noBanksContainer}>
                      <Text style={styles.noBanksText}>No banks currently available</Text>
                    </View>
                  )}
                  
                  {unavailableBanks.length > 0 && (
                    <View style={styles.unavailableSection}>
                      <Text style={styles.unavailableTitle}>Temporarily Unavailable:</Text>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.banksContainer}
                      >
                        {unavailableBanks.map(bank => {
                          const availability = bankAvailability.find(av => av.bankCode === bank.code);
                          return (
                            <View key={bank.id} style={styles.unavailableBankOption}>
                              <Text style={styles.unavailableBankName}>
                                {bank.name}
                                <Text style={styles.unavailableBadge}> • Unavailable</Text>
                              </Text>
                              <Text style={styles.unavailableBankCode}>
                                {getUSSDCode(bank.code)}
                              </Text>
                              {availability?.error && (
                                <Text style={styles.errorText}>{availability.error}</Text>
                              )}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textTertiary}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  editable={!fromDepositFlow}
                />
              </View>
              <Text style={styles.helperText}>
                Minimum amount: ₦100
              </Text>
            </View>

            {ussdCode && (
              <View style={styles.ussdCodeContainer}>
                <View style={styles.ussdCodeHeader}>
                  <Text style={styles.ussdCodeLabel}>USSD Code</Text>
                  <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                    <Copy size={16} color={colors.primary} />
                    <Text style={styles.copyText}>Copy</Text>
                  </Pressable>
                </View>
                <View style={styles.ussdCodeBox}>
                  <Text style={styles.ussdCode}>{ussdCode}</Text>
                </View>
                <Text style={styles.ussdInstructions}>
                  Dial this code on your phone to complete the payment
                </Text>
                {paymentInitiated && (
                  <View style={styles.paymentStatusContainer}>
                    <Text style={styles.paymentStatusText}>
                      Payment initiated. Complete the USSD transaction on your phone.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.infoContainer}>
              <Info size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                USSD payments are processed immediately. Make sure you have sufficient balance in your account and complete the transaction within 10 minutes. Some banks may have temporary service interruptions.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={paymentInitiated ? "Check Payment Status" : "Continue"}
        onPress={handleContinue}
        loading={isLoading || isVerifying}
        disabled={!selectedBank || !amount || isLoading || isVerifying}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  form: {
    gap: 24,
  },
  formGroup: {
    gap: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  banksContainer: {
    paddingVertical: 8,
    gap: 12,
  },
  bankOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  selectedBankOption: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  selectedBankName: {
    color: colors.primary,
  },
  bankCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedBankCode: {
    color: colors.primary,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    color: colors.text,
  },
  helperText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },
  ussdCodeContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ussdCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ussdCodeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  ussdCodeBox: {
    backgroundColor: isDark ? colors.backgroundSecondary : colors.surface,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ussdCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  ussdInstructions: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  paymentStatusContainer: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0',
  },
  paymentStatusText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  availableBadge: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 4,
  },
  unavailableSection: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  unavailableBankOption: {
    padding: 8,
  },
  unavailableBankName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  unavailableBankCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  unavailableBadge: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
  },
  noBanksContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noBanksText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});