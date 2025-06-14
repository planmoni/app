import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Building2, Plus, ChevronRight, Trash2, Info } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import HorizontalLoader from '@/components/HorizontalLoader';
import SafeFooter from '@/components/SafeFooter';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeBankAccounts } from '@/hooks/useRealtimeBankAccounts';
import AddBankAccountModal from '@/components/AddBankAccountModal';
import { useHaptics } from '@/hooks/useHaptics';

export default function LinkedAccountsScreen() {
  const { colors } = useTheme();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const haptics = useHaptics();
  
  const { 
    bankAccounts, 
    isLoading, 
    error, 
    addBankAccount, 
    fetchBankAccounts,
    setDefaultAccount,
    deleteAccount
  } = useRealtimeBankAccounts();

  const handleAddAccount = async (account: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => {
    try {
      haptics.success();
      await addBankAccount({
        bank_name: account.bankName,
        account_number: account.accountNumber,
        account_name: account.accountName,
        is_default: bankAccounts.length === 0 // Make first account default
      });
      setShowAddAccount(false);
    } catch (error) {
      haptics.error();
      console.error('Error adding bank account:', error);
    }
  };

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
        <Text style={styles.headerTitle}>Linked Bank Accounts</Text>
      </View>

      {isLoading && <HorizontalLoader />}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Manage your linked bank accounts for receiving payouts
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
                      <Building2 size={24} color="#3B82F6" />
                    </View>
                    <View style={styles.bankDetails}>
                      <Text style={styles.bankName}>{account.bank_name}</Text>
                      <Text style={styles.accountNumber}>•••• {account.account_number.slice(-4)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.accountContent}>
                  <Text style={styles.accountName}>{account.account_name}</Text>
                  {account.is_default && (
                    <Text style={styles.defaultText}>Default Account</Text>
                  )}
                </View>

                <View style={styles.accountActions}>
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
                </View>
              </View>
            ))
          )}

          <Pressable
            style={styles.addAccountButton}
            onPress={() => {
              haptics.mediumImpact();
              setShowAddAccount(true);
            }}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.addAccountText}>Add New Bank Account</Text>
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color="#3B82F6" />
              </View>
              <Text style={styles.infoTitle}>About Bank Accounts</Text>
            </View>
            <Text style={styles.infoText}>
              These bank accounts will be used to receive your automated payouts. You can add multiple accounts and set one as default.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Add New Account"
          onPress={() => {
            haptics.mediumImpact();
            setShowAddAccount(true);
          }}
          style={styles.addButton}
          icon={Plus}
          hapticType="medium"
        />
      </View>

      <AddBankAccountModal
        isVisible={showAddAccount}
        onClose={() => {
          haptics.lightImpact();
          setShowAddAccount(false);
        }}
        onAdd={handleAddAccount}
        loading={isLoading}
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
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
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
    color: '#3B82F6',
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
    borderLeftColor: '#3B82F6',
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
});