import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Building2, CreditCard, Smartphone, Ban as Bank } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const haptics = useHaptics();
  const { paymentMethods, isLoading, error, setDefaultMethod, deletePaymentMethod } = usePaymentMethods();

  const handleMethodSelect = (methodId: string) => {
    haptics.selection();
    setSelectedMethodId(methodId);
  };

  const handleContinue = () => {
    if (selectedMethodId) {
      haptics.mediumImpact();
      const selectedMethod = paymentMethods.find(method => method.id === selectedMethodId);
      router.replace({
        pathname: '/deposit-flow/amount',
        params: {
          methodId: selectedMethodId,
          methodTitle: selectedMethod ? 
            `${selectedMethod.type === 'card' ? selectedMethod.card_type?.toUpperCase() : selectedMethod.bank} •••• ${selectedMethod.last_four}` : 
            'Selected Method'
        }
      });
    }
  };

  // These handlers now navigate to the amount screen first with the method type
  const handleAddCard = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: 'card'
      }
    });
  };

  const handleAddUSSD = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: 'ussd'
      }
    });
  };
  
  const handleAddBankAccount = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: 'bank-account'
      }
    });
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      haptics.mediumImpact();
      await setDefaultMethod(methodId);
      haptics.success();
    } catch (error) {
      haptics.error();
      console.error('Error setting default method:', error);
    }
  };

  const handleDelete = async (methodId: string) => {
    try {
      haptics.warning();
      await deletePaymentMethod(methodId);
      
      // If the deleted method was selected, clear the selection
      if (selectedMethodId === methodId) {
        setSelectedMethodId(null);
      }
      
      haptics.success();
    } catch (error) {
      haptics.error();
      console.error('Error deleting payment method:', error);
    }
  };

  const styles = createStyles(colors);

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
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
        <Text style={styles.stepText}>Step 1 of 3</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Select Payment Method</Text>
          <Text style={styles.description}>Choose your preferred payment option to add funds.</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading payment methods...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <>
              {paymentMethods.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
                  
                  {paymentMethods.map((method) => (
                    <Pressable 
                      key={method.id}
                      style={[
                        styles.paymentMethod,
                        selectedMethodId === method.id && styles.selectedMethod
                      ]}
                      onPress={() => handleMethodSelect(method.id)}
                    >
                      <View style={styles.methodLeft}>
                        <View style={styles.methodIconContainer}>
                          {method.type === 'card' ? (
                            <CreditCard size={24} color={colors.primary} />
                          ) : (
                            <Building2 size={24} color={colors.primary} />
                          )}
                        </View>
                        <View style={styles.methodInfo}>
                          <Text style={styles.methodTitle}>
                            {method.type === 'card' 
                              ? `${method.card_type?.toUpperCase() || 'Card'} •••• ${method.last_four}`
                              : `${method.bank || 'Bank'} •••• ${method.last_four}`
                            }
                          </Text>
                          <Text style={styles.methodSubtitle}>
                            {method.is_default ? 'Default' : method.type === 'card' 
                              ? `Expires ${method.exp_month}/${method.exp_year}`
                              : 'Bank Account'
                            }
                          </Text>
                        </View>
                      </View>
                      <View style={styles.radioContainer}>
                        <View style={[
                          styles.radioOuter,
                          selectedMethodId === method.id && styles.radioOuterSelected
                        ]}>
                          {selectedMethodId === method.id && (
                            <View style={styles.radioInner} />
                          )}
                        </View>
                        <Pressable 
                          style={styles.actionButton}
                          onPress={() => handleSetDefault(method.id)}
                        >
                          <Text style={styles.actionText}>
                            {method.is_default ? 'Default' : 'Set Default'}
                          </Text>
                        </Pressable>
                        <Pressable 
                          style={styles.actionButton}
                          onPress={() => handleDelete(method.id)}
                        >
                          <Text style={[styles.actionText, styles.deleteText]}>Remove</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add New Payment Method</Text>
                
                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddCard}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <CreditCard size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Debit/Credit Card</Text>
                      <Text style={styles.methodSubtitle}>Visa, Mastercard, Verve</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>

                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddUSSD}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <Smartphone size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>USSD</Text>
                      <Text style={styles.methodSubtitle}>Use USSD Code to pay</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
                
                <Pressable 
                  style={styles.newMethodButton}
                  onPress={handleAddBankAccount}
                >
                  <View style={styles.methodLeft}>
                    <View style={styles.methodIconContainer}>
                      <Bank size={24} color={colors.primary} />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodTitle}>Link Bank Account</Text>
                      <Text style={styles.methodSubtitle}>Add your bank account for transfers</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={!selectedMethodId || isLoading}
        hapticType="medium"
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
    padding: 16,
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
    height: 4,
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
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 16,
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedMethod: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    marginLeft: 0,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  methodSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  deleteText: {
    color: colors.error,
  },
  newMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});