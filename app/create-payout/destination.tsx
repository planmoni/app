import { View, Text, StyleSheet, Pressable, useWindowDimensions, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Plus, Info, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState, useEffect, useCallback } from 'react';
import AddBankAccountModal from '@/components/AddBankAccountModal';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';
import { useRealtimePayoutAccounts } from '@/hooks/useRealtimePayoutAccounts';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

export default function DestinationScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'payout' | 'linked'>('payout');
  const { width } = useWindowDimensions();
  const haptics = useHaptics();
  
  // Get both account types
  const { 
    payoutAccounts, 
    isLoading: payoutAccountsLoading, 
    error: payoutAccountsError,
    fetchPayoutAccounts
  } = useRealtimePayoutAccounts();
  
  const { 
    bankAccounts, 
    isLoading: bankAccountsLoading, 
    error: bankAccountsError,
    fetchBankAccounts
  } = useRealtimeBankAccounts();

  // Combine loading and error states
  const isLoading = payoutAccountsLoading || bankAccountsLoading;
  const error = payoutAccountsError || bankAccountsError;
  
  // Refreshing state
  const [refreshing, setRefreshing] = useState(false);

  // Set default selection based on the active tab type
  useEffect(() => {
    if (accountType === 'payout' && payoutAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = payoutAccounts.find(account => account.is_default);
      setSelectedAccountId(defaultAccount?.id || payoutAccounts[0].id);
    } else if (accountType === 'linked' && bankAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = bankAccounts.find(account => account.is_default);
      setSelectedAccountId(defaultAccount?.id || bankAccounts[0].id);
    }
  }, [payoutAccounts, bankAccounts, selectedAccountId, accountType]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (accountType === 'payout') {
        await fetchPayoutAccounts();
      } else {
        await fetchBankAccounts();
      }
    } catch (error) {
      console.error('Error refreshing accounts:', error);
    } finally {
      setRefreshing(false);
    }
  }, [accountType, fetchPayoutAccounts, fetchBankAccounts]);

  const handleContinue = () => {
    if (selectedAccountId) {
      haptics.mediumImpact();
      
      let selectedAccount;
      let accountName, bankName, accountNumber;
      
      if (accountType === 'payout') {
        selectedAccount = payoutAccounts.find(account => account.id === selectedAccountId);
        if (selectedAccount) {
          accountName = selectedAccount.account_name;
          bankName = selectedAccount.bank_name;
          accountNumber = selectedAccount.account_number;
        }
      } else {
        selectedAccount = bankAccounts.find(account => account.id === selectedAccountId);
        if (selectedAccount) {
          accountName = selectedAccount.account_name;
          bankName = selectedAccount.bank_name;
          accountNumber = selectedAccount.account_number;
        }
      }
      
      if (selectedAccount) {
        router.push({
          pathname: '/create-payout/rules',
          params: {
            ...params,
            bankAccountId: accountType === 'linked' ? selectedAccountId : null,
            payoutAccountId: accountType === 'payout' ? selectedAccountId : null,
            bankName,
            accountNumber,
            accountName
          }
        });
      }
    }
  };

  // Responsive styles based on screen width
  const isSmallScreen = width < 380;

  const styles = createStyles(colors, isSmallScreen);

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
        <Text style={styles.headerTitle}>New Payout plan</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper 
        contentContainerStyle={styles.scrollContent}
        disableScrollView={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <Text style={styles.title}>Choose Payout Destination</Text>
          <Text style={styles.description}>
            Select a bank account to receive your payouts
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.accountTypeSelector}>
            <Pressable
              style={[
                styles.accountTypeOption,
                accountType === 'payout' && styles.activeAccountType
              ]}
              onPress={() => {
                haptics.selection();
                setAccountType('payout');
                setSelectedAccountId(null);
              }}
            >
              <Text style={[
                styles.accountTypeText,
                accountType === 'payout' && styles.activeAccountTypeText
              ]}>
                Payout Accounts
              </Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.accountTypeOption,
                accountType === 'linked' && styles.activeAccountType
              ]}
              onPress={() => {
                haptics.selection();
                setAccountType('linked');
                setSelectedAccountId(null);
              }}
            >
              <Text style={[
                styles.accountTypeText,
                accountType === 'linked' && styles.activeAccountTypeText
              ]}>
                Linked Accounts
              </Text>
            </Pressable>
          </View>

          <View style={styles.accountsList}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading bank accounts...</Text>
              </View>
            ) : accountType === 'payout' ? (
              payoutAccounts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No payout accounts found</Text>
                  <Text style={styles.emptySubtext}>Add a payout account to continue</Text>
                </View>
              ) : (
                payoutAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.accountOption,
                      selectedAccountId === account.id && styles.selectedAccount
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccountId(account.id);
                      setAccountType('payout');
                    }}
                  >
                    <View style={styles.accountInfo}>
                      <View style={[
                        styles.bankIcon,
                        selectedAccountId === account.id && styles.selectedBankIcon
                      ]}>
                        <Building2 size={isSmallScreen ? 20 : 24} color={selectedAccountId === account.id ? '#1E3A8A' : colors.textSecondary} />
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={[
                          styles.accountName,
                          selectedAccountId === account.id && styles.selectedText
                        ]}>
                          {account.bank_name} •••• {account.account_number.slice(-4)}
                        </Text>
                        <Text style={styles.accountHolder}>{account.account_name}</Text>
                        {account.is_default && (
                          <View style={styles.defaultTag}>
                            <Text style={styles.defaultText}>Default Account</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      selectedAccountId === account.id && styles.radioOuterSelected
                    ]}>
                      {selectedAccountId === account.id && (
                        <Check size={16} color="#1E3A8A" />
                      )}
                    </View>
                  </Pressable>
                ))
              )
            ) : (
              bankAccounts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No linked accounts found</Text>
                  <Text style={styles.emptySubtext}>Add a linked account to continue</Text>
                </View>
              ) : (
                bankAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.accountOption,
                      selectedAccountId === account.id && styles.selectedAccount
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedAccountId(account.id);
                      setAccountType('linked');
                    }}
                  >
                    <View style={styles.accountInfo}>
                      <View style={[
                        styles.bankIcon,
                        selectedAccountId === account.id && styles.selectedBankIcon
                      ]}>
                        <Building2 size={isSmallScreen ? 20 : 24} color={selectedAccountId === account.id ? '#1E3A8A' : colors.textSecondary} />
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={[
                          styles.accountName,
                          selectedAccountId === account.id && styles.selectedText
                        ]}>
                          {account.bank_name} •••• {account.account_number.slice(-4)}
                        </Text>
                        <Text style={styles.accountHolder}>{account.account_name}</Text>
                        {account.is_default && (
                          <View style={styles.defaultTag}>
                            <Text style={styles.defaultText}>Default Account</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      selectedAccountId === account.id && styles.radioOuterSelected
                    ]}>
                      {selectedAccountId === account.id && (
                        <Check size={16} color="#1E3A8A" />
                      )}
                    </View>
                  </Pressable>
                ))
              )
            )}

            <Pressable
              style={styles.addAccountButton}
              onPress={() => {
                haptics.mediumImpact();
                setShowAddAccount(true);
              }}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.addAccountText}>
                Add New {accountType === 'payout' ? 'Payout' : 'Bank'} Account
              </Text>
            </Pressable>
          </View>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.noticeText}>
              Your funds will be securely transferred to your selected bank account on the scheduled dates.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={selectedAccountId === null || isLoading}
        hapticType="medium"
      />

      {accountType === 'payout' ? (
        <AddPayoutAccountModal
          isVisible={showAddAccount}
          onClose={(newAccountId) => {
            haptics.lightImpact();
            setShowAddAccount(false);
            // If a new account was added, select it
            if (newAccountId) {
              setSelectedAccountId(newAccountId);
            }
          }}
        />
      ) : (
        <AddBankAccountModal
          isVisible={showAddAccount}
          onClose={() => {
            haptics.lightImpact();
            setShowAddAccount(false);
          }}
          onAdd={async (account) => {
            // This is handled by the modal
          }}
          loading={isLoading}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
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
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 22 : 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  accountTypeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 4,
  },
  accountTypeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeAccountType: {
    backgroundColor: colors.primary,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeAccountTypeText: {
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  accountsList: {
    gap: 12,
    marginBottom: 24,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedAccount: {
    backgroundColor: '#F0F9FF',
    borderColor: '#1E3A8A',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 12 : 16,
    flex: 1,
  },
  bankIcon: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: isSmallScreen ? 20 : 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBankIcon: {
    backgroundColor: '#EFF6FF',
  },
  accountDetails: {
    gap: 4,
    flex: 1,
  },
  accountName: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  selectedText: {
    color: '#1E3A8A',
  },
  accountHolder: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
  },
  defaultTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  defaultText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  radioOuterSelected: {
    borderColor: '#1E3A8A',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
  },
  addAccountText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    borderRadius: 12,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: 20,
  },
});