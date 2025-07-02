import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Calendar, Lock, Info, Shield, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AddCardScreen() {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const { addFunds } = useBalance();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const amount = params.amount as string;
  const fromDepositFlow = params.fromDepositFlow === 'true';
  
  const [amountInput, setAmountInput] = useState(amount || '100');
  const [saveCard, setSaveCard] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check payment status periodically
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (paymentUrl) {
      interval = setInterval(async () => {
        try {
          // Extract reference from payment URL
          const url = new URL(paymentUrl);
          const reference = url.searchParams.get('reference');
          
          if (reference) {
            // Verify payment directly with Paystack
            const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
              headers: {
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY}`,
                'Content-Type': 'application/json'
              },
            });
            
            const data = await response.json();
            
            if (data.status && data.data?.status === 'success') {
              clearInterval(interval);
              setShowPaymentModal(false);
              setPaymentUrl('');
              
              // Store card information if save_card is true
              if (saveCard && data.data.authorization) {
                const authorization = data.data.authorization;
                
                // Store the card token in database
                const { error: dbError } = await supabase
                  .from('payment_methods')
                  .insert({
                    user_id: session?.user?.id,
                    type: 'card',
                    provider: 'paystack',
                    token: authorization.authorization_code,
                    last_four: authorization.last4,
                    exp_month: authorization.exp_month,
                    exp_year: authorization.exp_year,
                    card_type: authorization.card_type,
                    bank: authorization.bank,
                    is_default: false
                  });

                if (dbError) {
                  console.error('❌ Error storing card token:', dbError);
                } else {
                  console.log('✅ Card token stored in database');
                }
              }
              
              haptics.success();
              showToast('Card added successfully!', 'success');
              
              if (fromDepositFlow && amount) {
                router.replace({
                  pathname: '/deposit-flow/authorization',
                  params: {
                    amount,
                    methodTitle: `Card •••• ${data.data.authorization?.last4 || '****'}`
                  }
                });
              } else {
                router.back();
              }
            }
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
        }
      }, 3000); // Check every 3 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [paymentUrl, session, fromDepositFlow, amount, haptics, showToast, saveCard]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validate amount
    const amountValue = parseFloat(amountInput);
    if (!amountInput || isNaN(amountValue)) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amountValue < 100) {
      newErrors.amount = 'Minimum amount is ₦100';
    } else if (amountValue > 1000000) {
      newErrors.amount = 'Maximum amount is ₦1,000,000';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCard = async () => {
    if (!validateForm()) {
      haptics.error();
      showToast('Please correct the errors in the form', 'error');
      return;
    }
    
    try {
      setIsLoading(true);
      haptics.impact();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Generate unique reference
      const reference = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize Paystack payment directly
      const paymentData = {
        email: session.user.email,
        amount: (parseInt(amountInput) * 100).toString(), // Convert to kobo
        currency: 'NGN',
        reference: reference,
        callback_url: `${process.env.EXPO_PUBLIC_APP_URL || 'https://your-app.com'}/payment/callback`,
        channels: ['card'], // Only allow card payments
        metadata: {
          user_id: session.user.id,
          payment_type: 'card_payment',
          save_card: saveCard
        }
      };

      console.log('🚀 Initializing Paystack payment:', {
        user_id: session.user.id,
        email: session.user.email,
        amount: amountInput,
        reference: reference
      });

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      if (data.status && data.data?.authorization_url) {
        // Open Paystack Checkout
        setPaymentUrl(data.data.authorization_url);
        setShowPaymentModal(true);
        
        // Open the payment URL
        const supported = await Linking.canOpenURL(data.data.authorization_url);
        if (supported) {
          await Linking.openURL(data.data.authorization_url);
        } else {
          showToast('Unable to open payment page', 'error');
        }
      } else {
        throw new Error('Invalid response from Paystack');
      }
      
    } catch (err) {
      haptics.error();
      const errorMessage = err instanceof Error ? err.message : 'Failed to add card';
      showToast(`Error: ${errorMessage}`, 'error');
      console.error('Error initializing payment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPayment = async () => {
    if (paymentUrl) {
      const supported = await Linking.canOpenURL(paymentUrl);
      if (supported) {
        await Linking.openURL(paymentUrl);
      } else {
        showToast('Unable to open payment page', 'error');
      }
    }
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
        <Text style={styles.headerTitle}>Add Card</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Add a Debit or Credit Card</Text>
          <Text style={styles.description}>
            Add your card details securely through Paystack's secure payment gateway
          </Text>

          <View style={styles.cardPreview}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardType}>SECURE PAYMENT</Text>
              <CreditCard size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.cardNumberPreview}>
              •••• •••• •••• ••••
            </Text>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.cardholderLabel}>PAYMENT GATEWAY</Text>
                <Text style={styles.cardholderPreview}>
                  PAYSTACK SECURE
                </Text>
              </View>
              <View>
                <Text style={styles.expiryLabel}>PROCESSED BY</Text>
                <Text style={styles.expiryPreview}>
                  PAYSTACK
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount to Charge</Text>
              <View style={[styles.inputContainer, errors.amount && styles.inputError]}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  placeholderTextColor={colors.textTertiary}
                  value={amountInput}
                  onChangeText={(text) => {
                    // Only allow numbers
                    const numbers = text.replace(/[^0-9]/g, '');
                    setAmountInput(numbers);
                    if (errors.amount) {
                      setErrors({...errors, amount: ''});
                    }
                  }}
                  keyboardType="numeric"
                />
              </View>
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
              <Text style={styles.helperText}>
                A small charge will be made to verify your card. This amount will be refunded.
              </Text>
            </View>

            <View style={styles.checkboxContainer}>
              <Pressable 
                style={styles.checkbox}
                onPress={() => setSaveCard(!saveCard)}
              >
                <View style={[styles.checkboxBox, saveCard && styles.checkboxChecked]}>
                  {saveCard && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.checkboxLabel}>Save this card for future payments</Text>
              </Pressable>
            </View>

            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <Shield size={20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                Your card information is securely processed by Paystack. We never store your full card details on our servers.
              </Text>
            </View>

            <View style={styles.processInfo}>
              <View style={styles.processIconContainer}>
                <Info size={20} color={colors.primary} />
              </View>
              <Text style={styles.processText}>
                You will be redirected to Paystack's secure payment page to enter your card details.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Proceed to Payment"
        onPress={handleAddCard}
        loading={isLoading}
        disabled={isLoading}
        hapticType="medium"
      />
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Text style={styles.modalDescription}>
              Please complete your payment on the Paystack page. You can return to this app once payment is complete.
            </Text>
            
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.modalButton}
                onPress={handleOpenPayment}
              >
                <ExternalLink size={20} color={colors.primary} />
                <Text style={styles.modalButtonText}>Open Payment Page</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  cardPreview: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    height: 200,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardNumberPreview: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 2,
    marginVertical: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardholderLabel: {
    color: '#FFFFFF80',
    fontSize: 10,
    marginBottom: 4,
  },
  cardholderPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  expiryLabel: {
    color: '#FFFFFF80',
    fontSize: 10,
    marginBottom: 4,
  },
  expiryPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  checkboxContainer: {
    marginTop: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  securityIconContainer: {
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  processInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  processIconContainer: {
    marginTop: 2,
  },
  processText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxHeight: '80%',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: colors.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});