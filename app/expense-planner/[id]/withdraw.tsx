import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Check, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { ExpenseBucket } from '@/types/expense-planner';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';

export default function WithdrawScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  
  const { payoutAccounts, isLoading: accountsLoading, fetchPayoutAccounts } = usePayoutAccounts();
  const { buckets } = useExpenseBuckets(planId);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Set default account if available
    if (payoutAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = payoutAccounts.find(acc => acc.is_default) || payoutAccounts[0];
      setSelectedAccountId(defaultAccount.id);
    }
  }, [payoutAccounts]);

  const handleBucketToggle = (bucketId: string) => {
    haptics.selection();
    setSelectedBuckets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bucketId)) {
        newSet.delete(bucketId);
      } else {
        newSet.add(bucketId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    haptics.selection();
    if (selectedBuckets.size === buckets.length) {
      setSelectedBuckets(new Set());
    } else {
      setSelectedBuckets(new Set(buckets.map(b => b.id)));
    }
  };

  const calculateTotalWithdrawal = () => {
    return buckets
      .filter(b => selectedBuckets.has(b.id))
      .reduce((sum, bucket) => {
        // TODO: Use actual locked amount from bucket
        const lockedAmount = bucket.target_amount; // Placeholder
        return sum + lockedAmount;
      }, 0);
  };

  const handleWithdraw = async () => {
    if (!selectedAccountId) {
      Alert.alert('Account Required', 'Please select a payout account');
      haptics.notification();
      return;
    }

    if (selectedBuckets.size === 0) {
      Alert.alert('No Buckets Selected', 'Please select at least one expense bucket to withdraw from');
      haptics.notification();
      return;
    }

    const totalAmount = calculateTotalWithdrawal();
    if (totalAmount <= 0) {
      Alert.alert('Invalid Amount', 'Selected buckets have no funds to withdraw');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsProcessing(true);

    try {
      // TODO: Implement actual withdrawal logic
      // await withdrawExpenseFunds(selectedBuckets, selectedAccountId);
      
      Alert.alert(
        'Withdrawal Initiated',
        `₦${totalAmount.toLocaleString()} will be transferred to your selected account.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedAccount = payoutAccounts.find(acc => acc.id === selectedAccountId);
  const totalAmount = calculateTotalWithdrawal();

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.back();
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Select payout account</Text>
        <Text style={styles.sectionDescription}>
          Choose where you want to receive the withdrawn funds
        </Text>

        <View style={styles.accountsContainer}>
          {payoutAccounts.map(account => (
            <Pressable
              key={account.id}
              style={[
                styles.accountCard,
                selectedAccountId === account.id && styles.accountCardSelected,
              ]}
              onPress={() => {
                haptics.selection();
                setSelectedAccountId(account.id);
              }}
            >
              <View style={styles.accountInfo}>
                <View style={styles.accountIcon}>
                  <Text style={styles.accountIconText}>
                    {account.bank_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountDetails}>
                  <Text style={styles.accountName}>{account.account_name}</Text>
                  <Text style={styles.accountNumber}>
                    {account.account_number.slice(-4).padStart(account.account_number.length, '•')}
                  </Text>
                  <Text style={styles.bankName}>{account.bank_name}</Text>
                </View>
              </View>
              {selectedAccountId === account.id && (
                <View style={styles.checkIcon}>
                  <Check size={20} color={colors.primary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.addAccountButton}
          onPress={() => {
            haptics.selection();
            setShowAddAccount(true);
          }}
        >
          <Plus size={20} color={colors.primary} />
          <Text style={styles.addAccountText}>Add New Account</Text>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.bucketsSection}>
          <View style={styles.bucketsHeader}>
            <Text style={styles.sectionTitle}>Select buckets to withdraw</Text>
            <Pressable onPress={handleSelectAll}>
              <Text style={styles.selectAllText}>
                {selectedBuckets.size === buckets.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.bucketsContainer}>
            {buckets.map(bucket => {
              const isSelected = selectedBuckets.has(bucket.id);
              // TODO: Use actual locked amount
              const lockedAmount = bucket.target_amount; // Placeholder
              
              return (
                <Pressable
                  key={bucket.id}
                  style={[
                    styles.bucketCard,
                    isSelected && styles.bucketCardSelected,
                  ]}
                  onPress={() => handleBucketToggle(bucket.id)}
                >
                  <View style={styles.bucketInfo}>
                    <Text style={styles.bucketName}>{bucket.name}</Text>
                    <Text style={styles.bucketAmount}>
                      ₦{lockedAmount.toLocaleString()} available
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.bucketCheck}>
                      <Check size={20} color={colors.primary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {totalAmount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Withdrawal</Text>
            <Text style={styles.summaryAmount}>₦{totalAmount.toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>

      <FloatingButton
        title="Withdraw"
        onPress={handleWithdraw}
        disabled={!selectedAccountId || selectedBuckets.size === 0 || isProcessing}
        hapticType="medium"
      />

      <AddPayoutAccountModal
        isVisible={showAddAccount}
        onClose={async (newAccount) => {
          haptics.lightImpact();
          setShowAddAccount(false);
          if (newAccount) {
            await fetchPayoutAccounts();
            setSelectedAccountId(newAccount.id);
          }
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
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
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    accountsContainer: {
      gap: 12,
      marginBottom: 16,
    },
    accountCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accountCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    accountInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    accountIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    accountIconText: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    accountDetails: {
      flex: 1,
    },
    accountName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    accountNumber: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 2,
    },
    bankName: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textTertiary,
    },
    checkIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      marginBottom: 24,
    },
    addAccountText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 24,
    },
    bucketsSection: {
      marginBottom: 24,
    },
    bucketsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    selectAllText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    bucketsContainer: {
      gap: 12,
    },
    bucketCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bucketCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    bucketInfo: {
      flex: 1,
    },
    bucketName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    bucketAmount: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    bucketCheck: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    summaryAmount: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
  });

