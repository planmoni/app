import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Plus, ChevronRight, Check, Trash2, LocationEdit as Edit2, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import Button from '@/components/Button';
import HorizontalLoader from '@/components/HorizontalLoader';
import SafeFooter from '@/components/SafeFooter';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import EditPayoutAccountModal from '@/components/EditPayoutAccountModal';

export default function PayoutAccountsScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { 
    payoutAccounts, 
    isLoading, 
    error, 
    fetchPayoutAccounts, 
    setDefaultAccount, 
    deleteAccount 
  } = usePayoutAccounts();
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const handleSetDefault = async (accountId: string) => {
    try {
      haptics.selection();
      await setDefaultAccount(accountId);
    } catch (error) {
      console.error('Error setting default account:', error);
      haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      "Delete Account",
      `Are you sure you want to delete ${accountName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => haptics.lightImpact()
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              haptics.heavyImpact();
              await deleteAccount(accountId);
            } catch (error) {
              console.error('Error deleting account:', error);
              haptics.notification(Haptics.NotificationFeedbackType.Error);
            }
          }
        }
      ]
    );
  };

  const handleEditAccount = (account: any) => {
    haptics.selection();
    setSelectedAccount(account);
    setShowEditAccount(true);
  };

  const styles = createStyles(colors, isDark);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payout Accounts</Text>
        </View>
        <HorizontalLoader />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payout accounts...</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

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
        <Pressable 
          style={styles.addIconButton}
          onPress={() => {
            haptics.mediumImpact();
            setShowAddAccount(true);
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Manage accounts where you receive payouts from your plans
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              title="Retry" 
              onPress={fetchPayoutAccounts} 
              style={styles.retryButton}
              hapticType="medium"
            />
          </View>
        )}

        <View style={styles.accountsList}>
          {payoutAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <CreditCard size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>No payout accounts yet</Text>
              <Text style={styles.emptyStateDescription}>
                Add a bank account to receive payouts from your plans
              </Text>
              <Button 
                title="Add Account" 
                icon={Plus}
                onPress={() => {
                  haptics.mediumImpact();
                  setShowAddAccount(true);
                }}
                style={styles.emptyStateButton}
                hapticType="medium"
              />
            </View>
          ) : (
            payoutAccounts.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <View style={styles.accountIcon}>
                    <CreditCard size={24} color={colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.bankName}>{account.bank_name}</Text>
                    <Text style={styles.accountNumber}>•••• {account.account_number.slice(-4)}</Text>
                    <Text style={styles.accountName}>{account.account_name}</Text>
                    
                    <View style={styles.accountBadges}>
                      {account.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      
                      {account.status === 'pending' && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending Verification</Text>
                        </View>
                      )}
                      
                      {account.status === 'failed' && (
                        <View style={styles.failedBadge}>
                          <Text style={styles.failedBadgeText}>Verification Failed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                
                <View style={styles.accountActions}>
                  {!account.is_default && account.status === 'active' && (
                    <Pressable 
                      style={styles.actionButton}
                      onPress={() => handleSetDefault(account.id)}
                    >
                      <Check size={16} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Set Default</Text>
                    </Pressable>
                  )}
                  
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => handleEditAccount(account)}
                  >
                    <Edit2 size={16} color={colors.text} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </Pressable>
                  
                  {!account.is_default && (
                    <Pressable 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteAccount(account.id, account.bank_name)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
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
              Payout accounts are used to receive funds from your payout plans. All accounts must be verified before they can be used. Verification typically takes 1-2 business days.
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
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  addIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 100,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 20,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 120,
    backgroundColor: colors.primary,
  },
  accountsList: {
    marginBottom: 24,
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    minWidth: 160,
    backgroundColor: colors.primary,
  },
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  accountName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  accountBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defaultBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  failedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  failedBadgeText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
    borderColor: '#FECACA',
  },
  deleteButtonText: {
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
    backgroundColor: colors.backgroundTertiary,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
});