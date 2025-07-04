import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, Dimensions, useWindowDimensions, ToastAndroid, Modal } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info, ChevronRight, CreditCard, Smartphone, Building2, CheckCircle, Clock } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimePaystackAccount } from '@/hooks/useRealtimePaystackAccount';

const { width } = Dimensions.get('window');
type VirtualAccount = {
  account_number: string;
  bank_name: string;
  account_name: string;
};

export default function AddFundsScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const { session, signOut } = useAuth();
  const { account: paystackAccount, isLoading: accountLoading } = useRealtimePaystackAccount();

  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const middleName = session?.user?.user_metadata?.middle_name || '';
  const phoneNumber = session?.user?.user_metadata?.phone_number || "+2347034000000";
  const email = session?.user?.email || '';

  // const styles = createStyles(colors);
  const [virtualAccount, setVirtualAccount] = useState< VirtualAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine if we're on a small screen
  const isSmallScreen = screenWidth < 380;

  const banks = [
    { id: 'wema', name: 'Wema Bank', code: 'wema-bank' },
    { id: 'paystack', name: 'Paystack Titan', code: 'titan-paystack' }
  ];

  // Update virtual account state when paystack account changes
  useEffect(() => {
    if (paystackAccount && paystackAccount.account_number) {
      setVirtualAccount({
        account_number: paystackAccount.account_number,
        bank_name: paystackAccount.bank_name,
        account_name: paystackAccount.account_name,
      });
    } else {
      setVirtualAccount(null);
    }
  }, [paystackAccount]);

  const handleCopyAccountNumber = async (accountNumber : string) => {
    console.log("Account number to copy:", accountNumber); // ✅ Debug
    haptics.selection();
    try {
      if (!accountNumber) {
        showToast('No account number available', 'error');
        return;
      }
  
      await Clipboard.setStringAsync(accountNumber);
      showToast('Account number copied to clipboard', 'success');
    } catch (error) {
      console.error("Clipboard error:", error);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyPress = () => {
    if (virtualAccount) {
      handleCopyAccountNumber(virtualAccount.account_number);
    }
  };
  
  const handleBankSelection = (bankId: string) => {
    setSelectedBank(bankId);
    setShowBankModal(false);
  };

  const handleCreateVirtualAccount = async () => {
    setIsLoading(true);

    try {
      // 1. Create Customer
      const customerPayload = {
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phoneNumber,
      };

      const customerResponse = await fetch('https://api.paystack.co/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`
        },
        body: JSON.stringify(customerPayload),
      });

      const customerResult = await customerResponse.json();
      if (!customerResponse.ok || !customerResult.status) {
        ToastAndroid.show(customerResult.message || 'Failed to create customer', ToastAndroid.SHORT);
        setIsLoading(false);
        return;
      }

      const customerId = customerResult.data.id;
      const customerCode = customerResult.data.customer_code;

      // 2. Create Dedicated Account
      const selectedBankData = banks.find(bank => bank.id === selectedBank);
      const accountPayload = {
        customer: customerId,
        preferred_bank: selectedBankData?.code || 'titan-paystack',
      };

      const accountResponse = await fetch('https://api.paystack.co/dedicated_account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`
        },
        body: JSON.stringify(accountPayload),
      });

      const accountResult = await accountResponse.json();
      if (!accountResponse.ok || !accountResult.status) {
        ToastAndroid.show(accountResult.message || 'Failed to create account', ToastAndroid.SHORT);
        setIsLoading(false);
        return;
      }

      const accountData = accountResult.data;
      
      // 3. Insert into Supabase
      const { error } = await supabase
        .from('paystack_accounts')
        .insert([{
          user_id: (await supabase.auth.getUser()).data.user?.id,
          customer_code: customerCode,
          bank_name: accountData.bank.name,
          account_number: accountData.account_number,
          account_name: accountData.account_name,
          accountId: accountData.id,
          is_active: accountData.active || false, // Check if account is immediately active
        }])
        .select();
      
      console.log("Database error:", error);
      if (error) {
        ToastAndroid.show('Failed to save account to database', ToastAndroid.SHORT);
        setIsLoading(false);
        return;
      }

      // Set virtual account state
      setVirtualAccount({
        account_number: accountData.account_number,
        bank_name: accountData.bank.name,
        account_name: accountData.account_name,
      });

      // Show appropriate message based on account status
      if (accountData.active) {
        ToastAndroid.show('Virtual account created and activated successfully', ToastAndroid.SHORT);
      } else {
        ToastAndroid.show('Virtual account created successfully. It will be activated shortly.', ToastAndroid.SHORT);
      }

    } catch (error) {
      console.error('Something went wrong', error);
      ToastAndroid.show('Something went wrong', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoreDepositMethods = () => {
    haptics.mediumImpact();
    router.push('/deposit-flow/payment-methods');
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const handleTabPress = (index: number) => {
    haptics.selection();
    setActiveTab(index);
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleScrollEnd = (event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (newIndex !== activeTab) {
      setActiveTab(newIndex);
    }
  };

  // Handle navigation to deposit flow with payment method type
  const handleNavigateToDepositFlow = (methodType: string) => {
    haptics.mediumImpact();
    router.push({
      pathname: '/deposit-flow/amount',
      params: {
        newMethodType: methodType
      }
    });
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

  // Calculate footer height including safe area
  const footerHeight = 80 + insets.bottom;

  // Calculate tab indicator position and width
  const tabWidth = screenWidth / 2;
  const indicatorTranslateX = Animated.multiply(
    Animated.divide(scrollX, screenWidth),
    tabWidth
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds</Text>
      </View>

      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 0 && styles.activeTab]} 
          onPress={() => handleTabPress(0)}
        >
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
            Bank Transfer
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 1 && styles.activeTab]} 
          onPress={() => handleTabPress(1)}
        >
          <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
            Cards/Bank/USSD
          </Text>
        </Pressable>
        <Animated.View 
          style={[
            styles.tabIndicator, 
            { 
              transform: [{ translateX: indicatorTranslateX }] 
            }
          ]} 
        />
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight }
        ]}
      >
        {/* Bank Transfer Tab */}
        <View style={[styles.tabContent, { width: screenWidth }]}>
          <View style={styles.content}>
            <Text style={styles.title}>Add funds via <Text style={styles.highlight}>Bank Transfer</Text></Text>
            <Text style={styles.description}>
              Money transfered to these account details will automatically appear on your available balance.
            </Text>

            {virtualAccount ? (
            <View style={styles.accountDetailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{virtualAccount.bank_name} Account Details</Text>
                {/* {paystackAccount && (
                  <View style={[
                    styles.statusIndicator,
                    paystackAccount.is_active ? styles.statusActive : styles.statusPending
                  ]}>
                    {paystackAccount.is_active ? (
                      <CheckCircle size={16} color="#22C55E" />
                    ) : (
                      <Clock size={16} color="#F59E0B" />
                    )}
                    <Text style={[
                      styles.statusText,
                      paystackAccount.is_active ? styles.statusTextActive : styles.statusTextPending
                    ]}>
                      {paystackAccount.is_active ? 'Active' : 'Pending Activation'}
                    </Text>
                  </View>
                )} */}
              </View>

              <View style={styles.fieldsContainer}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <View style={styles.accountNumberContainer}>
                    <Text style={styles.accountNumber}>{virtualAccount.account_number}</Text>
                    <Pressable onPress={handleCopyPress} style={styles.copyButton}>
                      <Copy size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>{virtualAccount.bank_name}</Text>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>{virtualAccount.account_name}</Text>
                  </View>
                </View>
              </View>

              {paystackAccount && !paystackAccount.is_active && (
                <View style={styles.pendingNotice}>
                  <Info size={16} color="#F59E0B" />
                  <Text style={styles.pendingNoticeText}>
                    Your virtual account is being activated. You'll be able to receive funds once it's active.
                  </Text>
                </View>
              )}
            </View>
            ) : (
              <View style={{ marginTop: 40, marginBottom: 24 }}>
                <Text style={{ fontWeight: 900, color: "#f3f3f3" }}>Create Virtual Account</Text>
                
                {/* Bank Selection Button */}
                <Pressable 
                  style={[
                    styles.bankSelectionButton,
                    selectedBank && styles.bankSelectionButtonSelected
                  ]}
                  onPress={() => setShowBankModal(true)}
                >
                  <View style={styles.bankSelectionContent}>
                    <View style={styles.bankSelectionLeft}>
                      <Text style={styles.bankSelectionLabel}>Select Bank</Text>
                      <Text style={styles.bankSelectionText}>
                        {selectedBank ? banks.find(bank => bank.id === selectedBank)?.name : 'Choose your preferred bank'}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </View>
                </Pressable>

                <Button
                  title="Create Account"
                  onPress={handleCreateVirtualAccount}
                  isLoading={isLoading}
                  disabled={!selectedBank}
                  style={[
                    styles.createAccountButton,
                    !selectedBank && styles.createAccountButtonDisabled
                  ]}
                />
              </View>
            )}
          </View>
        </View>

        {/* Cards/Bank/USSD Tab */}
        <View style={[styles.tabContent, { width: screenWidth }]}>
          <View style={styles.content}>
            <Text style={styles.title}>Choose a <Text style={styles.highlight}>Payment Method</Text></Text>
            <Text style={styles.description}>
              Select your preferred payment option to add funds to your wallet.
            </Text>

            <View style={styles.paymentMethodsContainer}>
              <Pressable 
                style={styles.paymentMethod}
                onPress={() => handleNavigateToDepositFlow('card')}
              >
                <View style={styles.paymentMethodIcon}>
                  <CreditCard size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Debit/Credit Card</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds using your card</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable 
                style={styles.paymentMethod}
                onPress={() => handleNavigateToDepositFlow('ussd')}
              >
                <View style={styles.paymentMethodIcon}>
                  <Smartphone size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>USSD Transfer</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds using USSD code</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable 
                style={styles.paymentMethod}
                onPress={() => handleNavigateToDepositFlow('bank-account')}
              >
                <View style={styles.paymentMethodIcon}>
                  <Building2 size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Bank Account</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds from your bank account</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Fixed footer with safe area padding */}
      <View style={[
        styles.footer, 
        { paddingBottom: Math.max(16, insets.bottom) }
      ]}>
        <Button 
          title="Done"
          onPress={handleDone}
          style={styles.doneButton}
          hapticType="medium"
        />
      </View>

      {/* Bank Selection Modal */}
      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Bank</Text>
              <Text style={styles.modalSubtitle}>Choose your preferred bank for the virtual account</Text>
            </View>
            
            <View style={styles.bankOptionsContainer}>
              {banks.map(bank => (
                <Pressable
                  key={bank.id}
                  onPress={() => handleBankSelection(bank.id)}
                  style={[
                    styles.bankOption,
                    selectedBank === bank.id && styles.selectedBankOption
                  ]}
                >
                  <View style={styles.bankOptionIcon}>
                    <Building2 size={24} color={selectedBank === bank.id ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={styles.bankOptionInfo}>
                    <Text style={[
                      styles.bankOptionText,
                      selectedBank === bank.id && styles.selectedBankOptionText
                    ]}>
                      {bank.name}
                    </Text>
                    <Text style={styles.bankOptionDescription}>
                      {bank.id === 'wema' ? 'Traditional banking partner' : 'Digital payment solution'}
                    </Text>
                  </View>
                  {selectedBank === bank.id && (
                    <View style={styles.selectedIndicator}>
                      <View style={styles.selectedDot} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowBankModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              {selectedBank && (
                <Pressable
                  onPress={() => setShowBankModal(false)}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmButtonText}>Confirm Selection</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
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
  headerTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '25%', // 50% of tab width (which is 50% of screen)
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    left: '12.5%', // Center in first tab by default
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: isSmallScreen ? 16 : 20,
  },
  title: {
    fontSize: isSmallScreen ? 15 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  highlight: {
    color: colors.primary,
  },
  description: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 20 : 24,
    lineHeight: 20,
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: isSmallScreen ? 20 : 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  cardTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  fieldsContainer: {
    padding: isSmallScreen ? 16 : 20,
    gap: isSmallScreen ? 16 : 20,
  },
  field: {
    marginBottom: 0, // Using gap in fieldsContainer instead
  },
  fieldLabel: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  accountNumber: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldValueContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  fieldValue: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  paymentMethodsContainer: {
    gap: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  bankSelectionButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  bankSelectionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  bankSelectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankSelectionLeft: {
    flex: 1,
  },
  bankSelectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  bankSelectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  createAccountButton: {
    backgroundColor: colors.primary,
  },
  createAccountButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  bankOptionsContainer: {
    marginBottom: 24,
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  selectedBankOption: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  bankOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bankOptionInfo: {
    flex: 1,
  },
  bankOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  bankOptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedBankOptionText: {
    color: colors.primary,
    fontWeight: '600',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.surface,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  statusPending: {
    borderColor: colors.textSecondary,
    backgroundColor: colors.backgroundTertiary,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  statusTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  statusTextPending: {
    color: colors.textSecondary,
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  pendingNoticeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginLeft: 8,
  },
});