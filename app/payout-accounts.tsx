import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ArrowLeft, Building2, Plus, ChevronRight, Trash2, Info } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutAccounts } from '@/hooks/useRealtimePayoutAccounts';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import EditPayoutAccountModal from '@/components/EditPayoutAccountModal';
import { useHaptics } from '@/hooks/useHaptics';

export default function PayoutAccountsScreen() {
  const { colors, isDark } = useTheme();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const haptics = useHaptics();
  
  const { 
    payoutAccounts, 
    isLoading, 
    error, 
    setDefaultAccount,
    deleteAccount
  } = useRealtimePayoutAccounts();

  const handleEditAccount = (account: any) => {
    haptics.selection();
    setSelectedAccount(account);
    setShowEditAccount(true);
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
      "Remove Account",
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

  const styles = createStyles(colors, isDark);

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
        <Text style={styles.headerTitle}>Payout Accounts</Text>
      </View>

      {isLoading && <PlanmoniLoader size="small" />}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Manage your bank accounts for receiving payouts
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.accountsList}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading payout accounts...</Text>
            </View>
          ) : payoutAccounts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No payout accounts found</Text>
              <Text style={styles.emptySubtext}>Add a bank account to receive payouts</Text>
            </View>
          ) : (
            payoutAccounts.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <View style={styles.bankInfo}>
                    <View style={styles.bankIcon}>
                      <Building2 size={24} color={colors.primary} />
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
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleEditAccount(account)}
                  >
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </Pressable>
                  
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
            <Text style={styles.addAccountText}>Add New Payout Account</Text>
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color={colors.primary} />
              </View>
              <Text style={styles.infoTitle}>About Payout Accounts</Text>
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

      <AddPayoutAccountModal
        isVisible={showAddAccount}
        onClose={() => {
          haptics.lightImpact();
          setShowAddAccount(false);
        }}
      />
      
      <EditPayoutAccountModal
        isVisible={showEditAccount}
        onClose={() => {
          haptics.lightImpact();
          setShowEditAccount(false);
          setSelectedAccount(null);
        }}
        account={selectedAccount}
      />
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
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
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
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
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
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
    borderLeftColor: colors.primary,
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
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
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
    backgroundColor: colors.primary,
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
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : colors.backgroundTertiary,
  },
  addAccountText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
});