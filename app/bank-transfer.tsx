import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info, CheckCircle, RefreshCw, X } from 'lucide-react-native';
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

type AccountInfo = {
  account_number: string;
  account_name: string;
  bank_name: string;
};

const ACCOUNT_LOADING_CAP_MS = 12_000;

export default function BankTransferScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session, isAuthReady } = useAuth();
  const isSmallScreen = screenWidth < 380;

  const [hasAccount, setHasAccount] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

    // Wait for token refresh after long idle before hitting PostgREST.
    if (!isAuthReady) {
      return;
    }

    try {
      // Only show full-screen spinner when we have nothing to paint.
      if (!hasCachedDataRef.current) {
        setAccountLoading(true);
      }
      setFetchError(null);

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
          setFetchError(error.message || 'Failed to load account details');
        }
        return;
      }

      applyAccountData(data);
      if (data?.account_number) {
        hasCachedDataRef.current = true;
        void writeCache(CACHE_KEYS.safehavenAccount(session.user.id), data);
      } else if (!hasCachedDataRef.current) {
        setFetchError(null);
      }
    } catch (error: any) {
      console.error('Error checking account:', error);
      if (!hasCachedDataRef.current) {
        setFetchError(error?.message || 'Failed to load account details');
      }
    } finally {
      setAccountLoading(false);
    }
  }, [session?.user?.id, isAuthReady, applyAccountData]);

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
      if (isAuthReady) {
        void fetchAccount();
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, isAuthReady, fetchAccount, applyAccountData]);

  // Cap spinner so resume cannot leave the screen loading forever.
  useEffect(() => {
    if (!accountLoading || accountInfo) return;
    const timer = setTimeout(() => {
      setAccountLoading(false);
      if (!hasCachedDataRef.current) {
        setFetchError((prev) => prev || 'Loading timed out. Tap retry.');
      }
    }, ACCOUNT_LOADING_CAP_MS);
    return () => clearTimeout(timer);
  }, [accountLoading, accountInfo]);

  useRegisterForegroundRefetch(
    'bank-transfer',
    3,
    fetchAccount,
    !!session?.user?.id && isAuthReady
  );

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleClose = () => {
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

  const handleClaimSuccess = useCallback(() => {
    setShowClaimModal(false);
    void fetchAccount();
  }, [fetchAccount]);

  const handleCloseClaimModal = useCallback(() => {
    setShowClaimModal(false);
  }, []);

  const handleRetryFetch = () => {
    haptics.lightImpact();
    setFetchError(null);
    if (!accountInfo) setAccountLoading(true);
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

  const showLoader = accountLoading && !accountInfo && !fetchError;
  const showError = !!fetchError && !accountInfo;
  const showClaimCta = !showLoader && !showError && !hasAccount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bank Transfer</Text>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={18} color={colors.text} />
        </Pressable>
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
          {showLoader ? (
            <View style={styles.loadingContainer}>
              <PlanmoniLoader size="medium" description="Loading account details..." />
            </View>
          ) : showError ? (
            <View style={styles.noAccountContainer}>
              <Text style={styles.noAccountMessage}>
                {fetchError || 'Could not load account details.'}
              </Text>
              <Pressable style={styles.claimButton} onPress={handleRetryFetch}>
                <Text style={styles.claimButtonText}>Retry</Text>
              </Pressable>
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
          ) : showClaimCta ? (
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
          ) : null}
        </View>
      </ScrollView>

      <ClaimAccountModal
        isVisible={showClaimModal}
        onClose={handleCloseClaimModal}
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
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: isSmallScreen ? 16 : 24,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 16 : 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  fieldsContainer: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountNumber: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  copyButton: {
    padding: 4,
  },
  fieldValueContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  transferNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: isDark ? 'rgba(30, 58, 138, 0.15)' : '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  transferNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  refreshButton: {
    marginBottom: 8,
  },
  noAccountContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 16,
  },
  noAccountMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
