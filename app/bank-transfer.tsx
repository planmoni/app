import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info, CheckCircle } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import * as Clipboard from 'expo-clipboard';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import ClaimAccountModal from '@/components/ClaimAccountModal';
import { useSafehavenDepositWatcher } from '@/hooks/useSafehavenDepositWatcher';
import { useBalance } from '@/contexts/BalanceContext';
import Button from '@/components/Button';
import { RefreshCw } from 'lucide-react-native';

type AccountInfo = {
  account_number: string;
  account_name: string;
  bank_name: string;
};

export default function BankTransferScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session } = useAuth();
  const isSmallScreen = screenWidth < 380;

  const [hasAccount, setHasAccount] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const hasCachedDataRef = useRef(false);
  const { refreshWallet } = useBalance();
  const { checkNow } = useSafehavenDepositWatcher({
    enabled: hasAccount && !!session?.user?.id,
    pollIntervalMs: 5000,
  });

  const styles = useMemo(() => createStyles(colors, isDark, isSmallScreen), [colors, isDark, isSmallScreen]);

  const applyAccountData = useCallback((data: { account_number: string; account_name?: string } | null) => {
    if (data?.account_number && !data.account_number.startsWith('PENDING_')) {
      setHasAccount(true);
      setAccountInfo({
        account_number: data.account_number,
        account_name: data.account_name || 'N/A',
        bank_name: 'SAFEHAVEN MFB',
      });
      return;
    }
    setHasAccount(false);
    setAccountInfo(null);
  }, []);

  const fetchAccount = useCallback(async () => {
    if (!session?.user?.id) {
      setAccountLoading(false);
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setAccountLoading(true);
      }

      const { data, error } = await fetchWithRetry(
        () =>
          supabase
            .from('safehaven_accounts')
            .select('id, account_number, account_name, status')
            .eq('user_id', session.user.id)
            .eq('is_deleted', false)
            .not('account_number', 'ilike', 'PENDING_%')
            .maybeSingle(),
        'SafeHaven account'
      ) as { data: { account_number: string; account_name?: string } | null; error: any };

      if (error && error.code !== 'PGRST116') {
        console.warn('Error checking account:', error);
        if (!hasCachedDataRef.current) {
          applyAccountData(null);
        }
        return;
      }

      applyAccountData(data);
      if (data?.account_number) {
        void writeCache(CACHE_KEYS.safehavenAccount(session.user.id), data);
      }
    } catch (error) {
      console.error('Error checking account:', error);
      if (!hasCachedDataRef.current) {
        applyAccountData(null);
      }
    } finally {
      setAccountLoading(false);
    }
  }, [session?.user?.id, applyAccountData]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setAccountLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        const cached = await readCache<{ account_number: string; account_name?: string }>(
          CACHE_KEYS.safehavenAccount(session.user.id)
        );
        if (cached && isMounted) {
          applyAccountData(cached);
          setAccountLoading(false);
          hasCachedDataRef.current = true;
        }
      } catch (_) {}

      if (!isMounted) return;
      void fetchAccount();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, fetchAccount, applyAccountData]);

  useRegisterForegroundRefetch('bank-transfer', 3, fetchAccount, !!session?.user?.id);

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleCopyAccountNumber = async (accountNumber: string) => {
    haptics.selection();
    try {
      if (!accountNumber) {
        showToast('No account number available', 'error');
        return;
      }

      await Clipboard.setStringAsync(accountNumber);
      showToast('Account number copied to clipboard', 'success');
    } catch (error) {
      console.error('Clipboard error:', error);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleClaimAccount = () => {
    haptics.mediumImpact();
    setShowClaimModal(true);
  };

  const handleClaimSuccess = () => {
    setShowClaimModal(false);
    void fetchAccount();
  };

  const handleRefreshBalance = async () => {
    haptics.lightImpact();
    setRefreshingBalance(true);
    try {
      await checkNow();
      await refreshWallet();
      showToast('Balance updated', 'success');
    } catch {
      showToast('Could not refresh balance. Try again shortly.', 'error');
    } finally {
      setRefreshingBalance(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bank Transfer</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {accountLoading && !accountInfo ? (
            <View style={styles.loadingContainer}>
              <PlanmoniLoader size="medium" description="Loading account details..." />
            </View>
          ) : hasAccount && accountInfo ? (
            <>
              <View style={styles.accountDetailsCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerIconContainer}>
                    <CheckCircle size={24} color={colors.primary} />
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.cardTitle}>Your Account Details</Text>
                    <Text style={styles.cardSubtitle}>
                      Transfer money to this account and it will appear in your wallet
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldsContainer}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Account Number</Text>
                    <View style={styles.accountNumberContainer}>
                      <Text style={styles.accountNumber}>{accountInfo.account_number}</Text>
                      <Pressable
                        onPress={() => handleCopyAccountNumber(accountInfo.account_number)}
                        style={styles.copyButton}
                      >
                        <Copy size={20} color={colors.primary} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Bank Name</Text>
                    <View style={styles.fieldValueContainer}>
                      <Text style={styles.fieldValue}>{accountInfo.bank_name}</Text>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Account Name</Text>
                    <View style={styles.fieldValueContainer}>
                      <Text style={styles.fieldValue}>{accountInfo.account_name}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.transferNotice}>
                <Info size={18} color={colors.primary} />
                <Text style={styles.transferNoticeText}>
                  Your balance updates automatically when your transfer arrives—usually within seconds. Tap refresh below if it has not updated yet.
                </Text>
              </View>

              <Button
                title={refreshingBalance ? 'Checking…' : 'Refresh balance'}
                onPress={handleRefreshBalance}
                disabled={refreshingBalance}
                variant="outline"
                style={styles.refreshButton}
                icon={refreshingBalance ? undefined : RefreshCw}
              />
            </>
          ) : (
            <>
              <View style={styles.noAccountContainer}>
                <Text style={styles.noAccountMessage}>
                  You currently do not have a SafeHaven account, Claim your account now.
                </Text>
                <Pressable
                  style={styles.claimButton}
                  onPress={handleClaimAccount}
                >
                  <Text style={styles.claimButtonText}>Claim your account</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <ClaimAccountModal
        isVisible={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        accountNumber="01177 XXXXX"
        bankName="SAFEHAVEN MFB"
        accountName={`PLANMONI/${(session?.user?.user_metadata?.first_name || 'YOUR').toUpperCase()} ${(session?.user?.user_metadata?.last_name || 'NAME').toUpperCase()}`}
        onClaim={handleClaimSuccess}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: isSmallScreen ? 16 : 20,
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  fieldsContainer: {
    padding: isSmallScreen ? 16 : 20,
    gap: 20,
  },
  field: {
    marginBottom: 0,
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
  transferNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: isSmallScreen ? 14 : 16,
    gap: 12,
  },
  transferNoticeText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: 16,
  },
  noAccountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  noAccountMessage: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingVertical: isSmallScreen ? 14 : 16,
    paddingHorizontal: isSmallScreen ? 32 : 40,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimButtonText: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#fff',
  },
});
