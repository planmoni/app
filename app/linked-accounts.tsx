import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Building2, Plus, ChevronRight, Trash2, TriangleAlert as AlertTriangle, Clock, Check, Info, Link2 } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '@/components/Button';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';
// import AddBankAccountModal from '@/components/AddBankAccountModal';
import { useHaptics } from '@/hooks/useHaptics';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
// import { MonoProvider, useMonoConnect } from '@mono.co/connect-react-native';
// import { useMonoAccountLinking } from '@/hooks/useMonoAccountLinking';
import { supabase } from '@/lib/supabase';
import { DeviceInfoService } from '@/lib/device-info';

// Mono Link Account Button Component
function LinkAccountButton({ colors, bankAccountsCount }: { colors: any; bankAccountsCount: number }) {
  // const { init } = useMonoConnect();
  const haptics = useHaptics();

  const handlePress = () => {
    if (bankAccountsCount >= 2) {
      haptics.error();
      Alert.alert(
        'Maximum Accounts Reached',
        'You can only link a maximum of 2 bank accounts. Please remove an existing account before adding a new one.',
        [{ text: 'OK' }]
      );
      return;
    }

    haptics.lightImpact();
    Alert.alert("Update in Progress", "Bank account linking is currently being updated. Please try again later.");
  };

  const isDisabled = bankAccountsCount >= 2;

  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: isDisabled ? colors.border : colors.primary,
        borderRadius: 12,
        backgroundColor: isDisabled ? colors.backgroundSecondary : colors.backgroundTertiary,
        opacity: isDisabled ? 0.5 : 1,
      }}
      onPress={handlePress}
      disabled={isDisabled}
    >
      <Link2 size={20} color={isDisabled ? colors.textSecondary : colors.primary} />
      <Text style={{ fontSize: 14, fontWeight: '500', color: isDisabled ? colors.textSecondary : colors.text }}>
        {isDisabled ? 'Maximum Accounts Reached' : 'Link with Mono'}
      </Text>
    </Pressable>
  );
}

export default function LinkedAccountsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  // const [showAddAccount, setShowAddAccount] = useState(false);
  const [monoCustomerId, setMonoCustomerId] = useState<string | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false); // Default to false since we aren't loading Mono
  const haptics = useHaptics();
  const { addFunds } = useBalance();
  const params = useLocalSearchParams();
  const amount = params.amount as string;
  const fromDepositFlow = params.fromDepositFlow === 'true';
  const selectForPayment = params.selectForPayment === 'true';
  
  const { 
    bankAccounts, 
    isLoading, 
    error, 
    addBankAccount, 
    fetchBankAccounts,
    setDefaultAccount,
    deleteAccount
  } = useRealtimeBankAccounts();

  // Use Mono account linking hook
  // const { linkAccount } = useMonoAccountLinking();

  /*
  // Check and create Mono customer if needed
  useEffect(() => {
    const setupMonoCustomer = async () => {
       // ... (Mono Customer Setup Logic commented out)
    };

    setupMonoCustomer();
  }, [session?.user?.id]);
  */

  /*
  const handleMonoSuccess = async (data: any) => {
     // ... (Mono Success Logic)
  };
  */
  
  // SECURITY: Validate Mono configuration before creating config
  const monoPublicKey = process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || '';
  
  /*
  // According to Mono README, for existing customers:
  // data: { customer: { id: '...' } }
  const monoConfig = monoPublicKey ? {
    publicKey: monoPublicKey,
    scope: 'auth' as const,
    data: monoCustomerId ? {
      customer: { id: monoCustomerId }
    } : undefined, // If no ID, Mono can prompt or we can pass details
    onClose: () => {
      console.log('Widget closed');
      haptics.lightImpact();
    },
    onSuccess: handleMonoSuccess,
    onEvent: (eventName: string, data: any) => {
      console.log('Mono event:', eventName);
      console.log('Mono event data:', data);
    },
    reference: `planmoni_${session?.user?.id || 'unknown'}_${Date.now()}`,
  } : null;
  */

  // const config = {
  //   selectedInstitution: {
  //     id: "694c2fc08eb43faed732589d",
  //     auth_method: "internet_banking"
  //   }
  // }
  
  // connect.init(monoConfig);
  // connect.init(config);
  
  const handleMakeDefault = async (accountId: string) => {
    try {
      haptics.success();
      await setDefaultAccount(accountId);
    } catch (error) {
      haptics.error();
      console.error('Error setting default account:', error);
    }
  };

  const handleRemoveAccount = async (accountId: string, accountName: string) => {
    haptics.warning();
    Alert.alert(
      "Remove Bank Account",
      `Are you sure you want to remove ${accountName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => haptics.lightImpact()
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              haptics.heavyImpact();
              await deleteAccount(accountId);
            } catch (error) {
              haptics.error();
              console.error('Error removing account:', error);
            }
          }
        }
      ]
    );
  };

  const styles = createStyles(colors);

  /*
  // Show error if Mono public key is missing (critical configuration error)
  if (!monoPublicKey) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        // ... Error UI
      </SafeAreaView>
    );
  }
  */

  // Show loading if customer ID is being set up
  if (isLoadingCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Linked Bank Accounts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" />
          <Text style={styles.loadingText}>Setting up account linking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
  // Show error if Mono config cannot be created (missing customer ID)
  if (!monoConfig) {
    return (
       // ... Error UI
    );
  }
  */

  return (
    // <MonoProvider {...monoConfig}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Linked Bank Accounts</Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <PlanmoniLoader size="medium" />
            <Text style={styles.loadingText}>Loading bank accounts...</Text>
          </View>
        )}

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.subtitle}>
            {fromDepositFlow 
              ? `Add a bank account to deposit ₦${amount}`
              : 'Manage your linked bank accounts for adding payments'
            }
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

        <View style={styles.accountsList}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading bank accounts...</Text>
            </View>
          ) : bankAccounts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No bank accounts found</Text>
              <Text style={styles.emptySubtext}>Add a bank account to continue</Text>
            </View>
          ) : (
            bankAccounts.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <View style={styles.bankInfo}>
                    <View style={styles.bankIcon}>
                      <Building2 size={24} color="#1E3A8A" />
                    </View>
                    <View style={styles.bankDetails}>
                      <Text style={styles.bankName}>{account.bank_name}</Text>
                      <Text style={styles.accountNumber}>•••• {account.account_number.slice(-4)}</Text>
                    </View>
                  </View>
                  <View style={styles.statusTag}>
                    <Check size={12} color="#22C55E" />
                    <Text style={styles.statusText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.accountContent}>
                  <Text style={styles.accountName}>{account.account_name}</Text>
                  {account.is_default && (
                    <Text style={styles.defaultText}>Default Account</Text>
                  )}
                </View>

                <View style={styles.accountActions}>
                  {fromDepositFlow ? (
                    <Pressable
                      style={[styles.actionButton, styles.payButton]}
                      onPress={() => {
                        haptics.mediumImpact();
                        router.replace({
                          pathname: '/deposit-flow/authorization',
                          params: {
                            amount,
                            methodId: account.id,
                            methodTitle: `${account.bank_name} • DirectDebit`,
                            monoAccountId: account.mono_account_id,
                            bankName: account.bank_name,
                            paymentType: 'mono-directdebit'
                          }
                        });
                      }}
                    >
                      <Text style={[styles.actionButtonText, styles.payButtonText]}>
                        Select for Payment
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      {!account.is_default && (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleMakeDefault(account.id)}
                        >
                          <Text style={styles.actionButtonText}>Make Default</Text>
                        </Pressable>
                      )}
                      {!account.is_default && (
                        <Pressable
                          style={[styles.actionButton, styles.removeButton]}
                          onPress={() => handleRemoveAccount(account.id, account.account_name)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                          <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                            Remove
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))
          )}

          {/* <View style={styles.addAccountOptions}>
            <Pressable
              style={styles.addAccountButton}
              onPress={() => setShowAddAccount(true)}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.addAccountText}>Add Bank Account Manually</Text>
            </Pressable>

            <LinkAccountButton colors={colors} bankAccountsCount={bankAccounts.length} />
          </View> */}
          
          <LinkAccountButton colors={colors} bankAccountsCount={bankAccounts.length} />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color="#1E3A8A" />
              </View>
              <Text style={styles.infoTitle}>Account Verification</Text>
            </View>
            <Text style={styles.infoText}>
              All bank accounts must be verified before they can be used for payouts. Verification typically takes 1-2 business days.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* <View style={styles.footer}>
        <Button
          title="Add New Account"
          onPress={() => setShowAddAccount(true)}
          style={styles.addButton}
          icon={Plus}
        />
      </View> */}

      {/* <AddBankAccountModal
        isVisible={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onAdd={handleAddAccount}
        loading={isLoading}
      /> */}
      
      <SafeFooter />
    </SafeAreaView>
    // </MonoProvider>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  accountsList: {
    gap: 16,
    marginBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.errorLight || '#FEF2F2',
    borderWidth: 1,
    borderColor: colors.error || '#EF4444',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
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
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: {
    gap: 4,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  accountNumber: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  accountContent: {
    marginBottom: 16,
  },
  accountName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  defaultText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '500',
    marginBottom: 4,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  removeButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  removeButtonText: {
    color: '#EF4444',
  },
  payButton: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  addButton: {
    backgroundColor: '#1E3A8A',
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
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  addAccountOptions: {
    gap: 12,
  },
  monoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 12,
  },
  monoButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledPaymentNote: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginTop: 8,
  },
  disabledPaymentText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
  },
});