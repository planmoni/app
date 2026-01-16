import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CreditCard, Shield, Lock, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { usePaystack } from 'react-native-paystack-webview';
import { supabase } from '@/lib/supabase';
import { useBalance } from '@/contexts/BalanceContext';
import Constants from 'expo-constants';

export default function PaystackPaymentScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { refreshWallet } = useBalance();
  const params = useLocalSearchParams();
  
  // Get Paystack hook - provider is always rendered (with placeholder key if needed)
  const { popup } = usePaystack();
  
  // Extract planId if this is a plan funding payment
  const planId = params.planId as string | undefined;

  const isSmallScreen = screenWidth < 380;
  const styles = createStyles(colors, isDark, isSmallScreen);

  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const MIN_AMOUNT = 1000;
  const MAX_AMOUNT = 5000000;

  const handleBack = () => {
    haptics.lightImpact();
    router.back();30
  };

  const handleClose = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const formatAmount = (value: string) => {
    // Remove non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');

    // Format with commas
    if (numericValue) {
      const formatted = parseFloat(numericValue).toLocaleString('en-NG');
      return formatted;
    }
    return '';
  };

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
  };

  const getNumericAmount = () => {
    return parseFloat(amount) || 0;
  };

  // Calculate Paystack fee: 1.5% + NGN 100
  // Fee is calculated on the amount user wants to add (what they'll receive)
  const calculatePaystackFee = (amount: number): number => {
    if (amount <= 0) return 0;
    const percentageFee = amount * 0.015; // 1.5%
    const flatFee = 100; // NGN 100
    return percentageFee + flatFee;
  };

  // Calculate total amount to pay (amount user wants + fee)
  const getTotalAmountToPay = (): number => {
    const numericAmount = getNumericAmount();
    if (numericAmount <= 0) return 0;
    const fee = calculatePaystackFee(numericAmount);
    return numericAmount + fee;
  };

  const isValidAmount = () => {
    const numericAmount = getNumericAmount();
    return numericAmount >= MIN_AMOUNT && numericAmount <= MAX_AMOUNT;
  };

  const handlePayment = async () => {
    if (!isValidAmount()) {
      showToast(
        `Amount must be between ₦${MIN_AMOUNT.toLocaleString()} and ₦${MAX_AMOUNT.toLocaleString()}`,
        'error'
      );
      return;
    }

    // Check if Paystack is available
    if (!popup || !popup.checkout) {
      console.error('🔴 Paystack popup is not available. Make sure PaystackProvider is set up correctly.');
      showToast('Payment service is not available. Please try again later.', 'error');
      return;
    }

    // Check if public key is available (this should be handled by PaystackProvider, but double-check)
    // Check both LIVE and regular keys
    const publicKey = 
      Constants.expoConfig?.extra?.EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY ||
      Constants.expoConfig?.extra?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ||
      process.env.EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY ||
      process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
    
    if (!publicKey || publicKey === 'pk_test_placeholder') {
      console.error('🔴 Paystack public key is not configured!');
      showToast('Payment configuration error. Please set EXPO_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY or EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY in your .env file and restart the app.', 'error');
      return;
    }

    console.log('🔵 Starting payment process...');
    haptics.mediumImpact();
    setIsLoading(true);

    try {
      // Get the current user session
      console.log('🔵 Getting user session...');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('🔴 No session found');
        showToast('Please log in to continue', 'error');
        setIsLoading(false);
        return;
      }

      console.log('🔵 Session found, getting user profile...');
      // Get user profile to get email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', session.user.id)
        .single();

      if (!profile?.email) {
        console.log('🔴 No email found in profile');
        showToast('Unable to get user email', 'error');
        setIsLoading(false);
        return;
      }

      console.log('✅ Opening Paystack modal...');
      const totalAmount = getTotalAmountToPay();
      console.log('🔵 Payment details:', {
        email: profile.email,
        amountToAdd: getNumericAmount(),
        fee: calculatePaystackFee(getNumericAmount()),
        totalAmount: totalAmount,
        amountInKobo: totalAmount * 100,
      });

      // Generate reference for transaction
      const reference = `PMN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Trigger Paystack checkout
      // Note: Amount should be in the base currency unit (NGN), not kobo
      // The package will convert it to kobo internally (multiplies by 100)
      // Payment methods are configured via defaultChannels in PaystackProvider
      // We charge the total amount (amount user wants + fee)
      // Pass the amount to credit (before fees) in metadata so webhook can credit correct amount
      popup.checkout({
        email: profile.email,
        amount: totalAmount, // Total amount including fee (package converts to kobo)
        reference: reference,
        metadata: {
          amount_to_credit: getNumericAmount(), // Amount user will receive (before fees)
          fee: calculatePaystackFee(getNumericAmount()),
          total_paid: totalAmount,
          payment_type: 'paystack_checkout',
          user_id: session.user.id,
        },
        onSuccess: (res: any) => {
          console.log('✅ Payment successful:', res);
          setIsProcessing(true);
          
          // Verify payment (pass planId if available)
          verifyPayment(reference, profile.email, planId);
        },
        onCancel: () => {
          console.log('⚠️ Payment cancelled by user');
          // Navigate to failure screen with cancelled status
          router.push({
            pathname: '/paystack-payment/failure',
            params: {
              amount: getNumericAmount().toString(),
              reference: reference,
              errorType: 'cancelled',
              error: 'Payment was cancelled by user',
            },
          });
        },
      });

      setIsLoading(false);
    } catch (error) {
      console.error('🔴 Payment initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment';
      
      // Navigate to failure screen for initialization errors
      router.push({
        pathname: '/paystack-payment/failure',
        params: {
          amount: getNumericAmount().toString(),
          reference: `INIT-${Date.now()}`,
          errorType: 'payment',
          error: errorMessage,
        },
      });
      
      setIsLoading(false);
    }
  };

  const verifyPayment = async (reference: string, email: string, planId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Navigate to failure screen
        router.replace({
          pathname: '/paystack-payment/failure',
          params: {
            amount: getNumericAmount().toString(),
            reference: reference,
            errorType: 'verification',
            error: 'Session expired. Please log in again',
            ...(planId && { planId }),
          },
        });
        return;
      }

      // Call verify-paystack-payment edge function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-paystack-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reference: reference,
            planId: planId || null,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh wallet balance only if not a plan payment
        if (!planId) {
          await refreshWallet();
        }

        haptics.success();

        // Navigate to success screen
        router.replace({
          pathname: '/paystack-payment/success',
          params: {
            amount: getNumericAmount().toString(),
            reference: reference,
            email: email,
            ...(planId && { planId }),
            ...(planId && params.planName && { planName: params.planName as string }),
          },
        });
      } else {
        // Navigate to failure screen with verification error
        const errorMessage = data.error || 'Payment verification failed';
        router.replace({
          pathname: '/paystack-payment/failure',
          params: {
            amount: getNumericAmount().toString(),
            reference: reference,
            errorType: 'verification',
            error: errorMessage,
            ...(planId && { planId }),
          },
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      // Navigate to failure screen with error details
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify payment';
      router.replace({
        pathname: '/paystack-payment/failure',
        params: {
          amount: getNumericAmount().toString(),
          reference: reference,
          errorType: 'verification',
          error: errorMessage,
          ...(planId && { planId }),
        },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds with Paystack</Text>
        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={8}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Amount Input Section */}
          <View style={styles.amountSection}>
            <Text style={styles.label}>Enter Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                value={formatAmount(amount)}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                editable={!isLoading && !isProcessing}
              />
            </View>
            <Text style={styles.amountHint}>
              Min: ₦{MIN_AMOUNT.toLocaleString()} • Max: ₦{MAX_AMOUNT.toLocaleString()}
            </Text>
          </View>

          {/* Payment Summary */}
          {getNumericAmount() > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Payment Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  ₦{getNumericAmount().toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paystack Fee (1.5% + ₦100)</Text>
                <Text style={[styles.summaryValue, styles.feeText]}>
                  ₦{calculatePaystackFee(getNumericAmount()).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          )}

          {/* Security Badges */}
          <View style={styles.securitySection}>
            
          </View>

          {/* Info Text */}
          <Text style={styles.infoText}>
            Powered by Paystack.
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(16, insets.bottom) },
        ]}
      >
        <Pressable
          style={[
            styles.payButton,
            (!isValidAmount() || isLoading || isProcessing) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!isValidAmount() || isLoading || isProcessing}
        >
          {isLoading || isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>
              {isProcessing
                ? 'Verifying Payment...'
                : `Pay ₦${getTotalAmountToPay().toLocaleString()}`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) =>
  StyleSheet.create({
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
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
    headerTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      padding: isSmallScreen ? 16 : 20,
    },
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
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    feeText: {
      color: colors.textSecondary,
    },
    securitySection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    securityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    securityText: {
      fontSize: isSmallScreen ? 12 : 13,
      color: colors.primary,
      fontWeight: '500',
    },
    infoText: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
    footer: {
      padding: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    payButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payButtonDisabled: {
      opacity: 0.5,
    },
    payButtonText: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '700',
      color: '#fff',
    },
  });