import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info, CheckCircle } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import ClaimAccountModal from '@/components/ClaimAccountModal';

export default function BankTransferScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { checkTierCompletion, progress } = useKYCProgress();
  const isSmallScreen = screenWidth < 380;

  const [hasAccount, setHasAccount] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<{
    account_number: string;
    account_name: string;
    bank_name: string;
  } | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark, isSmallScreen), [colors, isDark, isSmallScreen]);

  // Check if user has an account
  useEffect(() => {
    const checkAccount = async () => {
      if (!session?.user?.id) {
        setAccountLoading(false);
        return;
      }

      try {
        setAccountLoading(true);
        const { data, error } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number, account_name, status')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .not('account_number', 'ilike', 'PENDING_%')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error checking account:', error);
          setHasAccount(false);
          setAccountInfo(null);
        } else if (data && data.account_number && !data.account_number.startsWith('PENDING_')) {
          setHasAccount(true);
          setAccountInfo({
            account_number: data.account_number,
            account_name: data.account_name || 'N/A',
            bank_name: 'SAFEHAVEN MFB',
          });
        } else {
          setHasAccount(false);
          setAccountInfo(null);
        }
      } catch (error) {
        console.error('Error checking account:', error);
        setHasAccount(false);
        setAccountInfo(null);
      } finally {
        setAccountLoading(false);
      }
    };

    checkAccount();
  }, [session?.user?.id]);

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

  const handleQuickTransfer = () => {
    haptics.mediumImpact();
    // Navigate to virtual account page or show virtual account details
    // For now, we'll show a toast - this can be updated when virtual account functionality is ready
    showToast('Virtual account feature coming soon', 'info');
  };

  const handleClaimAccount = () => {
    haptics.mediumImpact();
    setShowClaimModal(true);
  };

  const handleClaimSuccess = () => {
    setShowClaimModal(false);
    // Refresh account info
    const checkAccount = async () => {
      if (!session?.user?.id) return;

      try {
        const { data } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number, account_name, status')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .not('account_number', 'ilike', 'PENDING_%')
          .maybeSingle();

        if (data && data.account_number && !data.account_number.startsWith('PENDING_')) {
          setHasAccount(true);
          setAccountInfo({
            account_number: data.account_number,
            account_name: data.account_name || 'N/A',
            bank_name: 'SAFEHAVEN MFB',
          });
        }
      } catch (error) {
        console.error('Error refreshing account:', error);
      }
    };

    checkAccount();
  };

  // Check if KYC Tier 1 is complete
  const tierCompletion = checkTierCompletion();
  const isTier1Complete = tierCompletion.tier1;

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
          {accountLoading ? (
            <View style={styles.loadingContainer}>
              <PlanmoniLoader size="medium" description="Loading account details..." />
            </View>
          ) : hasAccount && accountInfo ? (
            // User has account - show account details
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
                  Bank transfers can take up to 2 minutes before reflecting on your wallet. We will notify you immediately when your transfer arrives.
                </Text>
              </View>
            </>
          ) : (
            // User doesn't have account - show claim account message
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

      {/* Claim Account Modal */}
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