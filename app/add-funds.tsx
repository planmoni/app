import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, Dimensions, useWindowDimensions, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeHavenAccount } from '@/hooks/useSafeHavenAccount';
import { useKYCProgress } from '@/hooks/useKYCProgress';

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
  
  const { session } = useAuth();
  const { account: safehavenAccount, isLoading: accountLoading, error: accountError, refreshAccount } = useSafeHavenAccount();
  const { checkTierCompletion } = useKYCProgress();

  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const middleName = session?.user?.user_metadata?.middle_name || '';
  const phoneNumber = session?.user?.user_metadata?.phone_number || "+2347034000000";
  const email = session?.user?.email || '';

  // const styles = createStyles(colors);
  const [virtualAccount, setVirtualAccount] = useState< VirtualAccount | null>(null);
  
  const [activeTab, setActiveTab] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine if we're on a small screen
  const isSmallScreen = screenWidth < 380;

  // Update virtual account state when SafeHaven account changes
  useEffect(() => {
    // Debounce updates to prevent excessive re-renders
    const timeoutId = setTimeout(() => {
      // Only set account if it has a real account number (not a placeholder)
      if (safehavenAccount && safehavenAccount.account_number && !safehavenAccount.account_number.startsWith('PENDING_')) {
        // Format account name as "PLANMONI/{ACCOUNT_NAME}"
        const formattedAccountName = `PLANMONI/${safehavenAccount.account_name.toUpperCase()}`;
        setVirtualAccount({
          account_number: safehavenAccount.account_number,
          bank_name: safehavenAccount.bank_name,
          account_name: formattedAccountName,
        });
      } else {
        setVirtualAccount(null);
      }
    }, 300); // Debounce by 300ms

    return () => clearTimeout(timeoutId);
  }, [safehavenAccount]);

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
        <Text style={styles.headerTitle}>Add funds</Text>
      </View>

      {/* <View style={styles.tabContainer}>
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
            Direct Deposit
            Direct Deposit
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
      </View> */}

      <Animated.ScrollView
        ref={scrollViewRef}
        // horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight }
        ]}
      >
        {/* Bank Transfer Tabs */}
        <View style={[styles.tabContent, { width: screenWidth }]}>
          <View style={styles.content}>


            {virtualAccount ? (
            <View style={styles.accountDetailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Your {virtualAccount.bank_name} Account Details</Text>
                <Text style={styles.description}>
              Transfer money to the account details below and it will automatically appear on your available balance.
            </Text>
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

              {safehavenAccount && safehavenAccount.status !== 'Active' && (
                <View style={styles.pendingNotice}>
                  <Info size={16} color="#F59E0B" />
                  <Text style={styles.pendingNoticeText}>
                    Your account is being activated. You'll be able to receive funds once it's active.
                  </Text>
                </View>
              )}
            </View>
            ) : (
              <View style={{ marginTop: 40, marginBottom: 24 }}>
                {accountLoading ? (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
                      Loading account information...
                    </Text>
                  </View>
                ) : accountError ? (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <Text style={{ fontSize: 14, color: colors.error || '#DC2626', marginBottom: 16, textAlign: 'center' }}>
                      Error loading account: {accountError}
                    </Text>
                    <Button
                      title="Retry"
                      onPress={refreshAccount}
                      style={styles.createAccountButton}
                    />
                  </View>
                ) : (
                  <>
                    <Text style={{ marginBottom: 16, fontWeight: 700, color: colors.text }}>Claim your bank account</Text>
                    <Text style={{ marginBottom: 24, fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                      {(() => {
                        const tierCompletion = checkTierCompletion();
                        if (tierCompletion.tier1) {
                          return 'You\'ve completed Tier 1 verification. Your SafeHaven account will be available soon. Please check back later or contact support if you need assistance.';
                        } else {
                          return 'Complete Tier 1 verification (Liveness, BVN, and NIN) to get your SafeHaven account number.';
                        }
                      })()}
                    </Text>
                    {(() => {
                      const tierCompletion = checkTierCompletion();
                      if (!tierCompletion.tier1) {
                        return (
                          <Button
                            title="Complete Tier 1 Verification"
                            onPress={() => router.push('/kyc-upgrade')}
                            style={styles.createAccountButton}
                          />
                        );
                      }
                      return (
                        <Button
                          title="Refresh Account"
                          onPress={refreshAccount}
                          style={styles.createAccountButton}
                        />
                      );
                    })()}
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Cards/Bank/USSD Tab (now Direct Deposit) */}
        {/* <View style={[styles.tabContent, { width: screenWidth }]}> 
          <View style={styles.content}>
            <Text style={styles.title}>Choose a <Text style={styles.highlight}>Linked Account</Text></Text>
            <Text style={styles.title}>Choose a <Text style={styles.highlight}>Linked Account</Text></Text>
            <Text style={styles.description}>
              Select your preferred payment option to add funds to your wallet.
            </Text>

            <View style={styles.paymentMethodsContainer}>
              {bankAccountsLoading ? (
                <PlanmoniLoader size="medium" description="Loading linked accounts..." />
              ) : bankAccounts.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 8 }}>No linked accounts found</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 24 }}>Link a bank account to use direct deposit.</Text>
                  <Button
                    title="Link New Bank Account"
                    onPress={() => setShowComingSoon(true)}
                    style={{ width: 220 }}
                  />
                </View>
              ) : (
                <>
                  {bankAccounts.map((account) => (
                    <View key={account.id} style={[styles.paymentMethod, { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }]}> 
                      <View style={styles.paymentMethodIcon}>
                        <Building2 size={24} color={colors.primary} />
                      </View>
                      <View style={styles.paymentMethodInfo}>
                        <Text style={styles.paymentMethodTitle}>{account.bank_name} •••• {account.account_number.slice(-4)}</Text>
                        <Text style={styles.paymentMethodDescription}>{account.account_name}</Text>
                      </View>
                      {account.is_default && (
                        <View style={{ backgroundColor: colors.backgroundTertiary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>Default</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  <Button
                    title="Link New Bank Account"
                    onPress={() => setShowComingSoon(true)}
                    style={{ marginTop: 16, width: 220, alignSelf: 'center' }}
                  />
                </>
              )}
            </View>

            <Modal
              visible={showComingSoon}
              transparent
              animationType="fade"
              onRequestClose={() => setShowComingSoon(false)}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 32, alignItems: 'center', maxWidth: 320 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Coming Soon</Text>
                  <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
                    Linking a new bank account will be available soon. Stay tuned!
                  </Text>
                  <Button title="Close" onPress={() => setShowComingSoon(false)} style={{ width: 120 }} />
                </View>
              </View>
            </Modal>
          </View>
        </View> */}
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
    padding: isSmallScreen ? 10 : 10,
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
    height: 55,
    borderRadius: 100,
    backgroundColor: colors.primary,
  },
  bankSelectionButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 10,
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
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  bankSelectionText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
  },
  createAccountButton: {
    backgroundColor: colors.primary,
    borderRadius: 100,
    height: 55,
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
  bankLogo: {
    width: 24,
    height: 24,
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
    borderRadius: 100,
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
    marginTop: 14,
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
  disabledPaymentMethod: {
    opacity: 0.5,
  },
  comingSoonTag: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    alignSelf: 'center',
  },
  comingSoonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  
  
  
});