import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Plus, Info, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState } from 'react';
import AddBankAccountModal from '@/components/AddBankAccountModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useBankAccounts } from '@/hooks/useBankAccounts';

export default function DestinationScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const { 
    bankAccounts, 
    loading, 
    error, 
    addBankAccount, 
    fetchBankAccounts 
  } = useBankAccounts();

  const handleContinue = () => {
    if (selectedAccountId) {
      const selectedAccount = bankAccounts.find(account => account.id === selectedAccountId);
      if (selectedAccount) {
        router.push({
          pathname: '/create-payout/rules',
          params: {
            ...params,
            bankAccountId: selectedAccountId,
            bankName: selectedAccount.bank_name,
            accountNumber: selectedAccount.account_number,
            accountName: selectedAccount.account_name
          }
        });
      }
    }
  };

  const handleAddAccount = async (account: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => {
    try {
      await addBankAccount({
        bank_name: account.bankName,
        account_number: account.accountNumber,
        account_name: account.accountName,
        is_default: bankAccounts.length === 0 // Make first account default
      });
      setShowAddAccount(false);
      await fetchBankAccounts();
    } catch (error) {
      console.error('Error adding bank account:', error);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Choose Payout Destination</Text>
        <Text style={styles.description}>
          Select a linked bank account or add a new one
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.accountsList}>
          {loading ? (
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
              <Pressable
                key={account.id}
                style={[
                  styles.accountOption,
                  selectedAccountId === account.id && styles.selectedAccount
                ]}
                onPress={() => setSelectedAccountId(account.id)}
              >
                <View style={styles.accountInfo}>
                  <View style={[
                    styles.bankIcon,
                    selectedAccountId === account.id && styles.selectedBankIcon
                  ]}>
                    <Building2 size={24} color={selectedAccountId === account.id ? '#1E3A8A' : colors.textSecondary} />
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
          )}

          <Pressable
            style={styles.addAccountButton}
            onPress={() => setShowAddAccount(true)}
          >
            <Plus size={20} color="#1E3A8A" />
            <Text style={styles.addAccountText}>Add New Bank Account</Text>
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
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Continue"
          onPress={handleContinue}
          style={styles.continueButton}
          disabled={selectedAccountId === null || loading}
        />
      </View>

      <AddBankAccountModal
        isVisible={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onAdd={handleAddAccount}
        loading={loading}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
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
    padding: 16,
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
    gap: 16,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBankIcon: {
    backgroundColor: '#EFF6FF',
  },
  accountDetails: {
    gap: 4,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  selectedText: {
    color: '#1E3A8A',
  },
  accountHolder: {
    fontSize: 14,
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
    borderColor: '#1E3A8A',
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
  },
  addAccountText: {
    fontSize: 14,
    color: '#1E3A8A',
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
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  continueButton: {
    backgroundColor: '#1E3A8A',
  },
});