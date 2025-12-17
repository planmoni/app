import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Check, Plus, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';

export default function ScheduleWithdrawalScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  
  const { expensePlans } = useExpensePlans();
  const { buckets } = useExpenseBuckets(planId);
  const { payoutAccounts, fetchPayoutAccounts } = usePayoutAccounts();
  
  const plan = expensePlans.find(p => p.id === planId);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
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

  const calculateTotalAmount = () => {
    return buckets
      .filter(b => selectedBuckets.has(b.id))
      .reduce((sum, bucket) => {
        // TODO: Use actual locked amount
        const lockedAmount = bucket.target_amount; // Placeholder
        return sum + lockedAmount;
      }, 0);
  };

  const handleSchedule = async () => {
    if (!selectedAccountId) {
      Alert.alert('Account Required', 'Please select a payout account');
      haptics.notification();
      return;
    }

    if (selectedBuckets.size === 0) {
      Alert.alert('No Buckets Selected', 'Please select at least one expense bucket');
      haptics.notification();
      return;
    }

    if (!plan) {
      Alert.alert('Error', 'Expense plan not found');
      haptics.notification();
      return;
    }

    const totalAmount = calculateTotalAmount();
    if (totalAmount <= 0) {
      Alert.alert('Invalid Amount', 'Selected buckets have no funds to schedule');
      haptics.notification();
      return;
    }

    if (!selectedDate || !plan?.start_date || !plan?.end_date) {
      Alert.alert('Date Required', 'Please select a payout date within the budget window');
      haptics.notification();
      return;
    }

    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const isOutsideWindow = selectedDate < startDate || selectedDate > endDate;
    const isToday = selectedDate.getTime() === today.getTime();
    if (isOutsideWindow) {
      Alert.alert('Invalid Date', 'Selected date is outside the budget window');
      haptics.notification();
      return;
    }
    if (isToday) {
      Alert.alert('Invalid Date', 'Same day payouts are not allowed. Please pick a later date.');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsProcessing(true);

    try {
      // TODO: Implement actual scheduling logic
      // await scheduleExpenseWithdrawal(...);
      
      Alert.alert(
        'Withdrawal Scheduled',
        `Your withdrawal has been scheduled successfully.`,
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
      console.error('Error scheduling withdrawal:', error);
      Alert.alert('Error', 'Failed to schedule withdrawal. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedAccount = payoutAccounts.find(acc => acc.id === selectedAccountId);
  const totalAmount = calculateTotalAmount();
  const budgetStartDate = plan?.start_date ? new Date(plan.start_date) : null;
  const budgetEndDate = plan?.end_date ? new Date(plan.end_date) : null;

  const dateOptions = useMemo(() => {
    if (!budgetStartDate || !budgetEndDate) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(budgetStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(budgetEndDate);
    end.setHours(0, 0, 0, 0);

    // First selectable date is the later of start date or tomorrow
    const firstSelectable = new Date(Math.max(start.getTime(), today.getTime() + 24 * 60 * 60 * 1000));
    if (firstSelectable > end) return [];

    const dates: { date: Date }[] = [];
    for (let d = new Date(firstSelectable); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      dates.push({ date: day });
    }
    return dates;
  }, [budgetStartDate, budgetEndDate]);

  useEffect(() => {
    if (!plan) return;
    // Auto-select only when nothing is selected yet
    if (selectedDate) return;
    const firstDate = dateOptions.length > 0 ? dateOptions[0].date : null;
    if (!firstDate) return;
    setSelectedDate(firstDate);
  }, [plan, dateOptions, selectedDate]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Schedule Withdrawal</Text>
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
        <Text style={styles.sectionTitle}>Schedule withdrawal</Text>
        <Text style={styles.sectionDescription}>
          Set up automatic withdrawals within your budget window
        </Text>

        {budgetStartDate && budgetEndDate && (
          <View style={styles.budgetWindowCard}>
            <Calendar size={20} color={colors.primary} />
            <View style={styles.budgetWindowInfo}>
              <Text style={styles.budgetWindowLabel}>Budget Window</Text>
              <Text style={styles.budgetWindowDates}>
                {formatDate(budgetStartDate)} - {formatDate(budgetEndDate)}
              </Text>
            </View>
          </View>
        )}

        {budgetStartDate && budgetEndDate && dateOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select payout date</Text>
            <Text style={styles.sectionDescription}>
              Dates outside the budget window are disabled
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
              {dateOptions.map(({ date }) => {
                const isSelected = selectedDate ? date.toDateString() === selectedDate.toDateString() : false;
                return (
                  <Pressable
                    key={date.toISOString()}
                    style={[
                      styles.dateChip,
                      isSelected && styles.dateChipSelected,
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[
                      styles.dateChipText,
                      isSelected && styles.dateChipTextSelected,
                    ]}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select payout account</Text>
          <View style={styles.accountsContainer}>
              {payoutAccounts.map(account => {
                const bankIcon = getBankIconLogo(account.bank_name);
                const isSelected = selectedAccountId === account.id;
                return (
              <Pressable
                key={account.id}
                style={[
                  styles.accountCard,
                      isSelected && styles.accountCardSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedAccountId(account.id);
                }}
              >
                <View style={styles.accountInfo}>
                  <View style={styles.accountIcon}>
                        {(() => {
                          if (bankIcon.logoSvg) {
                            const SvgLogo = bankIcon.logoSvg.default || bankIcon.logoSvg;
                            return <SvgLogo width={28} height={28} />;
                          }
                          if (bankIcon.logo) {
                            return (
                              <Image
                                source={bankIcon.logo}
                                style={styles.bankIconImage}
                                resizeMode="contain"
                              />
                            );
                          }
                          return (
                    <Text style={styles.accountIconText}>
                      {account.bank_name.charAt(0).toUpperCase()}
                    </Text>
                          );
                        })()}
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>{account.account_name}</Text>
                    <Text style={styles.accountNumber}>
                      {account.account_number.slice(-4).padStart(account.account_number.length, '•')}
                    </Text>
                    <Text style={styles.bankName}>{account.bank_name}</Text>
                  </View>
                </View>
                    <View style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleSelected,
                    ]}>
                      {isSelected && <Check size={16} color={'#fff'} />}
                  </View>
              </Pressable>
                );
              })}
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
        </View>


        {totalAmount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryAmount}>₦{totalAmount.toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>

      <FloatingButton
        title="Schedule Withdrawal"
        onPress={handleSchedule}
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
    section: {
      marginBottom: 32,
    },
    budgetWindowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    budgetWindowInfo: {
      flex: 1,
    },
    budgetWindowLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    budgetWindowDates: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    dateList: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    dateChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 8,
    },
    dateChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    dateChipDisabled: {
      opacity: 0.5,
      backgroundColor: colors.backgroundTertiary,
    },
    dateChipText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.text,
      fontWeight: '600',
    },
    dateChipTextSelected: {
      color: colors.primary,
    },
    dateChipTextDisabled: {
      color: colors.textSecondary,
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
    bankIconImage: {
      width: 28,
      height: 28,
      borderRadius: 6,
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
    checkCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    checkCircleSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
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
    },
    addAccountText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    bucketsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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

