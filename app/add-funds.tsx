import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, AppState } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Copy, Info, Shield, ChevronRight } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { formatCurrency } from '@/lib/formatters';
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
  const { getTierInfo } = useKYCProgress();
  const [safehavenAccount, setSafehavenAccount] = useState<any>(null);
  const [safehavenAccountLoading, setSafehavenAccountLoading] = useState(true);
  const [tierInfo, setTierInfo] = useState<any>(null);
  const [tierInfoLoading, setTierInfoLoading] = useState(true);
  const [todayDepositAmount, setTodayDepositAmount] = useState<number>(0);

  // const styles = createStyles(colors);
  const [virtualAccount, setVirtualAccount] = useState< VirtualAccount | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine if we're on a small screen
  const isSmallScreen = screenWidth < 380;

  // Fetch SafeHaven account from database - optimized query
  useEffect(() => {
    const fetchSafehavenAccount = async () => {
      if (!session?.user?.id) {
        setSafehavenAccountLoading(false);
        return;
      }

      try {
        setSafehavenAccountLoading(true);
        // Use single() instead of maybeSingle() for better performance when account exists
        const { data, error } = await supabase
          .from('safehaven_accounts')
          .select('account_number, account_name, status')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .not('account_number', 'ilike', 'PENDING_%')
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error fetching SafeHaven account:', error);
          setSafehavenAccount(null);
        } else if (data) {
          setSafehavenAccount(data);
        } else {
          setSafehavenAccount(null);
        }
      } catch (err) {
        console.warn('Error fetching SafeHaven account:', err);
        setSafehavenAccount(null);
      } finally {
        setSafehavenAccountLoading(false);
      }
    };

    fetchSafehavenAccount();
  }, [session?.user?.id]);

  // Fetch tier information - optimized to load faster
  useEffect(() => {
    const fetchTierInfo = async () => {
      if (!session?.user?.id) {
        setTierInfoLoading(false);
        return;
      }

      try {
        setTierInfoLoading(true);
        
        // Fetch tier info
        const info = await getTierInfo();
        
        // Ensure we have tier limits, if not fetch directly from database
        if (info && (!info.tier_limits || !info.tier_limits.max_daily_deposit)) {
          const currentTier = info.current_tier || 0;
          const tierToFetch = currentTier === 0 ? 1 : currentTier;
          
          // Fetch tier limits directly from database
          const { data: limits, error: limitsError } = await supabase.rpc('get_tier_deposit_limits', {
            p_tier_number: tierToFetch
          });
          
          if (!limitsError && limits && limits[0]) {
            info.tier_limits = {
              tier_number: limits[0].tier_number,
              tier_name: limits[0].tier_name,
              tier_description: '',
              max_daily_deposit: limits[0].max_daily_deposit,
              max_weekly_deposit: limits[0].max_weekly_deposit,
              max_monthly_deposit: limits[0].max_monthly_deposit,
              max_single_deposit: limits[0].max_single_deposit,
              max_account_balance: limits[0].max_account_balance,
              requirements: {}
            };
          }
        }
        
        setTierInfo(info);
      } catch (err) {
        console.error('Error fetching tier info:', err);
      } finally {
        setTierInfoLoading(false);
      }
    };

    fetchTierInfo();
  }, [session?.user?.id, getTierInfo]);

  // Fetch today's deposit amount
  const fetchTodayDeposits = React.useCallback(async () => {
    if (!session?.user?.id) {
      return;
    }

    try {
      // Get start and end of today in GMT+1 (resets at 00:00 GMT+1)
      // GMT+1 is UTC+1, meaning 00:00 GMT+1 = 23:00 UTC the previous day
      const now = new Date();
      
      // Convert current UTC time to GMT+1 by subtracting 1 hour
      const nowGMT1 = new Date(now.getTime() - (1 * 60 * 60 * 1000));
      
      // Get the date components in GMT+1
      const yearGMT1 = nowGMT1.getUTCFullYear();
      const monthGMT1 = nowGMT1.getUTCMonth();
      const dateGMT1 = nowGMT1.getUTCDate();
      
      // Create start of day in GMT+1 (00:00:00 GMT+1)
      // This is equivalent to 23:00:00 UTC the previous day
      const startOfDayGMT1 = new Date(Date.UTC(yearGMT1, monthGMT1, dateGMT1, 0, 0, 0, 0));
      
      // Convert GMT+1 start of day to UTC: subtract 1 hour
      // 00:00 GMT+1 = 23:00 UTC previous day
      const startOfDayUTC = new Date(startOfDayGMT1.getTime() - (1 * 60 * 60 * 1000));
      
      // End of day is start + 24 hours
      const endOfDayUTC = new Date(startOfDayUTC.getTime() + (24 * 60 * 60 * 1000));

      // Query today's completed deposits
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', session.user.id)
        .eq('type', 'deposit')
        .eq('status', 'completed')
        .gte('created_at', startOfDayUTC.toISOString())
        .lt('created_at', endOfDayUTC.toISOString());

      if (error) {
        console.error('Error fetching today\'s deposits:', error);
        return;
      }

      // Sum up today's deposits (amount is stored in naira, not kobo)
      const totalToday = (transactions || []).reduce((sum: number, tx: { amount: number }) => sum + Number(tx.amount), 0);
      setTodayDepositAmount(totalToday);
    } catch (err) {
      console.error('Error calculating today\'s deposits:', err);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    
    // Initial fetch
    fetchTodayDeposits();

    // Refresh every 5 minutes instead of every minute to reduce load
    const interval = setInterval(() => {
      fetchTodayDeposits();
    }, 300000); // Check every 5 minutes

    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchTodayDeposits();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session?.user?.id, fetchTodayDeposits]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (session?.user?.id) {
        fetchTodayDeposits();
      }
    }, [session?.user?.id, fetchTodayDeposits])
  );

  // Update virtual account state when safehaven account changes
  useEffect(() => {
    if (safehavenAccount && safehavenAccount.account_number) {
      setVirtualAccount({
        account_number: safehavenAccount.account_number,
        bank_name: 'SAFEHAVEN MFB',
        account_name: safehavenAccount.account_name,
      });
    } else {
      setVirtualAccount(null);
    }
  }, [safehavenAccount]);

  // COMMENTED OUT: Update virtual account state when paystack account changes
  // useEffect(() => {
  //   if (paystackAccount && paystackAccount.account_number) {
  //     setVirtualAccount({
  //       account_number: paystackAccount.account_number,
  //       bank_name: paystackAccount.bank_name,
  //       account_name: paystackAccount.account_name,
  //     });
  //   } else {
  //     setVirtualAccount(null);
  //   }
  // }, [paystackAccount]);

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

  // Handle upgrade button press
  const handleUpgrade = () => {
    haptics.mediumImpact();
    router.push('/kyc-upgrade');
  };

  // Memoize styles to prevent recalculation on every render
  const styles = useMemo(() => createStyles(colors, isDark, isSmallScreen), [colors, isDark, isSmallScreen]);

  // Calculate footer height including safe area
  const footerHeight = 80 + insets.bottom;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add funds</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight }
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <View style={styles.content}>


            {safehavenAccountLoading ? (
              <View style={{ marginTop: 40, alignItems: 'center' }}>
                <PlanmoniLoader size="medium" description="Loading account details..." />
              </View>
            ) : virtualAccount ? (
              <>
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

                  {/* {safehavenAccount && safehavenAccount.status !== 'Active' && (
                    <View style={styles.pendingNotice}>
                      <Info size={16} color="#F59E0B" />
                      <Text style={styles.pendingNoticeText}>
                        Your account is being activated. You'll be able to receive funds once it's active.
                      </Text>
                    </View>
                  )} */}
                </View>

                {/* Transfer Timing Notice */}
                <View style={styles.transferNotice}>
                  <Info size={18} color={colors.primary} />
                  <Text style={styles.transferNoticeText}>
                    Bank transfers can take up to 2 mins before reflecting on your wallet, we will notify you immediately your transfer arrives.
                  </Text>
                </View>

                {/* Tier Limit Reminder */}
                {!tierInfoLoading && tierInfo?.tier_limits && (
                  <View style={styles.tierReminderCard}>
                    <View style={styles.tierReminderHeader}>
                      <View style={styles.tierReminderTextContainer}>
                        <Text style={styles.tierReminderTitle}>
                          {tierInfo.current_tier === 0 ? 'Unverified' : `Tier ${tierInfo.current_tier}`} Limits
                        </Text>
                        <Text style={styles.tierReminderSubtitle}>
                          Single transaction: {formatCurrency((tierInfo.tier_limits.max_single_deposit || 0))}
                        </Text>
                        {tierInfo.tier_limits.max_daily_deposit && (
                          <Text style={styles.tierReminderDailyRemaining}>
                            Daily limit remaining: {formatCurrency(Math.max(0, ((tierInfo.tier_limits.max_daily_deposit || 0)) - todayDepositAmount))}
                          </Text>
                        )}
                      </View>
                      {tierInfo.current_tier !== undefined && tierInfo.current_tier !== null && tierInfo.current_tier < 3 && (
                        <Pressable 
                          style={styles.upgradeTextButton}
                          onPress={handleUpgrade}
                        >
                          <Text style={styles.upgradeTextButtonText}>
                            Upgrade to Tier {tierInfo.current_tier + 1}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                    
                    {tierInfo.can_upgrade && (
                      <Pressable 
                        style={styles.upgradeButton}
                        onPress={handleUpgrade}
                      >
                        <Text style={styles.upgradeButtonText}>Upgrade Tier</Text>
                        <ChevronRight size={18} color={colors.primary} />
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={{ marginTop: 40, marginBottom: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
                  No account found
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                  Please complete KYC to create your SafeHaven account.
                </Text>
              </View>
            )}
        </View>
      </ScrollView>

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
  content: {
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
    height: 60,
    borderRadius: 24,
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
    borderRadius: 24,
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
    borderRadius: 24,
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
  tierReminderCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 16 : 20,
    marginTop: 16,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  tierReminderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tierReminderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tierReminderTextContainer: {
    flex: 1,
  },
  tierReminderTitle: {
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  tierReminderSubtitle: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tierReminderDailyRemaining: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
    color: colors.primary,
  },
  upgradeTextButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  upgradeTextButtonText: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
    color: colors.primary,
  },
  transferNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: isSmallScreen ? 14 : 16,
    marginBottom: isSmallScreen ? 20 : 24,
    gap: 12,
  },
  transferNoticeText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: 20,
  },
});