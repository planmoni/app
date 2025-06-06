import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Building2, Plus, ChevronRight, Trash2, TriangleAlert as AlertTriangle, Clock, Check, Info } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  status: 'active' | 'pending' | 'failed';
  lastUsed?: string;
  usedIn?: string[];
};

export default function LinkedAccountsScreen() {
  const { colors } = useTheme();
  const [accounts] = useState<BankAccount[]>([
    {
      id: '1',
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'John Doe',
      isDefault: true,
      status: 'active',
      lastUsed: 'Just now',
      usedIn: ['Monthly Salary', 'House Rent'],
    },
    {
      id: '2',
      bankName: 'First Bank',
      accountNumber: '9876543210',
      accountName: 'John Doe',
      isDefault: false,
      status: 'pending',
      lastUsed: '2 days ago',
      usedIn: ['Car Purchase'],
    },
    {
      id: '3',
      bankName: 'UBA',
      accountNumber: '5432109876',
      accountName: 'John Doe',
      isDefault: false,
      status: 'failed',
    },
  ]);

  const handleAddAccount = () => {
    // Navigate to add account flow
  };

  const handleRemoveAccount = (accountId: string) => {
    // Show confirmation dialog and remove account
  };

  const handleMakeDefault = (accountId: string) => {
    // Update default account
  };

  const handleRetryVerification = (accountId: string) => {
    // Retry account verification
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Linked Bank Accounts</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Manage your linked bank accounts for receiving payouts
        </Text>

        <View style={styles.accountsList}>
          {accounts.map((account) => (
            <View key={account.id} style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.bankInfo}>
                  <View style={styles.bankIcon}>
                    <Building2 size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.bankDetails}>
                    <Text style={styles.bankName}>{account.bankName}</Text>
                    <Text style={styles.accountNumber}>•••• {account.accountNumber.slice(-4)}</Text>
                  </View>
                </View>
                {account.status === 'active' && (
                  <View style={styles.statusTag}>
                    <Check size={12} color="#22C55E" />
                    <Text style={styles.statusText}>Verified</Text>
                  </View>
                )}
                {account.status === 'pending' && (
                  <View style={[styles.statusTag, styles.pendingTag]}>
                    <Clock size={12} color="#D97706" />
                    <Text style={[styles.statusText, styles.pendingText]}>Pending</Text>
                  </View>
                )}
                {account.status === 'failed' && (
                  <View style={[styles.statusTag, styles.failedTag]}>
                    <AlertTriangle size={12} color="#EF4444" />
                    <Text style={[styles.statusText, styles.failedText]}>Failed</Text>
                  </View>
                )}
              </View>

              <View style={styles.accountContent}>
                <Text style={styles.accountName}>{account.accountName}</Text>
                {account.isDefault && (
                  <Text style={styles.defaultText}>Default Account</Text>
                )}
                {account.lastUsed && (
                  <Text style={styles.lastUsedText}>Last used {account.lastUsed}</Text>
                )}
                {account.usedIn && account.usedIn.length > 0 && (
                  <View style={styles.usageContainer}>
                    <Text style={styles.usageText}>Used in: </Text>
                    {account.usedIn.map((vault, index) => (
                      <Text key={vault} style={styles.vaultName}>
                        {vault}{index < account.usedIn!.length - 1 ? ', ' : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {account.status === 'failed' && (
                <View style={styles.errorMessage}>
                  <View style={styles.errorIconContainer}>
                    <AlertTriangle size={16} color="#EF4444" />
                  </View>
                  <Text style={styles.errorText}>
                    Verification failed. Please check your account details and try again.
                  </Text>
                </View>
              )}

              <View style={styles.accountActions}>
                {!account.isDefault && account.status === 'active' && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleMakeDefault(account.id)}
                  >
                    <Text style={styles.actionButtonText}>Make Default</Text>
                  </Pressable>
                )}
                {account.status === 'failed' && (
                  <Pressable
                    style={[styles.actionButton, styles.retryButton]}
                    onPress={() => handleRetryVerification(account.id)}
                  >
                    <Text style={[styles.actionButtonText, styles.retryButtonText]}>
                      Retry Verification
                    </Text>
                  </Pressable>
                )}
                {!account.isDefault && (
                  <Pressable
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemoveAccount(account.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                      Remove
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color="#3B82F6" />
              </View>
              <Text style={styles.infoTitle}>Account Verification</Text>
            </View>
            <Text style={styles.infoText}>
              All bank accounts must be verified before they can be used for payouts. Verification typically takes 1-2 business days.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Add New Account"
          onPress={handleAddAccount}
          style={styles.addButton}
          icon={Plus}
        />
      </View>
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
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#22C55E',
  },
  pendingTag: {
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    color: '#D97706',
  },
  failedTag: {
    backgroundColor: '#FEE2E2',
  },
  failedText: {
    color: '#EF4444',
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
  lastUsedText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  usageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  usageText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  vaultName: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorIconContainer: {
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
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
  retryButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  retryButtonText: {
    color: '#3B82F6',
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
});