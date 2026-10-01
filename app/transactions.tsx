import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import TransactionModal from '@/components/TransactionModal';
import DateRangeModal from '@/components/DateRangeModal';
import { router } from 'expo-router';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Calendar, Search, X, XCircle, CheckCircle2, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useInfiniteTransactionsQuery, type Transaction } from '@/hooks/queries/useTransactionsQuery';
import { usePayoutPlansQuery } from '@/hooks/queries/usePayoutPlansQuery';
import { formatTransactionType } from '@/lib/formatters';
type TransactionType = 'all' | 'deposits' | 'payouts' | 'withdrawals';

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const {
    transactions,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTransactionsQuery();
  const { payoutPlans } = usePayoutPlansQuery(20);
  const [activeType, setActiveType] = useState<TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  const handleTransactionPress = (transaction: Transaction) => {
    // Map "scheduled" status to "DISBURSED" for payout transactions
    let displayStatus = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
    if (transaction.type === 'payout' && transaction.status.toLowerCase() === 'scheduled') {
      displayStatus = 'DISBURSED';
    }
    
    setSelectedTransaction((prevState: any) => ({
      ...prevState,
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: displayStatus,
      date: new Date(transaction.created_at).toLocaleDateString(),
      time: new Date(transaction.created_at).toLocaleTimeString(),
      type: formatTransactionType(transaction.type),
      source: transaction.source,
      destination: transaction.destination,
      transactionId: transaction.id,
      planRef: transaction.payout_plan_id || '',
      paymentMethod: 'Bank Transfer',
      initiatedBy: 'You',
      processingTime: transaction.status === 'completed' ? 'Instant' : '2-3 business days',
    }));
    setIsTransactionModalVisible(true);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const handleDateRangeSelect = (startDate: Date | null, endDate: Date | null) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const handleClearDateRange = () => {
    setDateRange({ start: null, end: null });
  };

  const formatDateRange = () => {
    if (!dateRange.start || !dateRange.end) return 'Select Date Range';
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };

    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  };

  const typeMap = {
    deposits: 'deposit',
    payouts: 'payout',
    withdrawals: 'withdrawal',
  };

  const filteredTransactions = transactions.filter(transaction => {
    // Filter by transaction type
    if (activeType !== 'all' && transaction.type !== typeMap[activeType]) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const matchesSearch = transaction.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
             transaction.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             transaction.destination?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) {
        return false;
      }
    }

    // Filter by date range
    if (dateRange.start && dateRange.end) {
      const transactionDate = new Date(transaction.created_at);
      
      // Normalize dates to start and end of day for accurate comparison
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      // Check if transaction date falls within the range (inclusive)
      if (transactionDate < startDate || transactionDate > endDate) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats based on filtered transactions
  const stats = {
    inflows: `₦${filteredTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
      .toLocaleString()}`,
    outflows: `-₦${filteredTransactions
      .filter(t => t.type === 'payout' || t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
      .toLocaleString()}`,
    netMovement: `₦${(
      filteredTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0) -
      filteredTransactions.filter(t => t.type === 'payout' || t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0)
    ).toLocaleString()}`
  };

  // Group transactions by date
  type GroupedTransactions = { [date: string]: typeof filteredTransactions };
  const groupedTransactions = filteredTransactions.reduce((groups: GroupedTransactions, transaction) => {
    const date = new Date(transaction.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as GroupedTransactions);
  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>All Transactions</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton}>
                <Search size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading transactions..." />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>All Transactions</Text>
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.iconButton}
              onPress={() => setIsSearchVisible(!isSearchVisible)}
            >
              {isSearchVisible ? (
                <X size={16} color={colors.text} />
              ) : (
                <Search size={16} color={colors.text} />
              )}
            </Pressable>
          </View>
        </View>

        {isSearchVisible && (
          <View style={styles.searchContainer}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          <Pressable
            style={[styles.filterTab, activeType === 'all' && styles.activeFilterTab]}
            onPress={() => setActiveType('all')}
          >
            <Text style={[
              styles.filterTabText,
              activeType === 'all' && styles.activeFilterTabText
            ]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeType === 'deposits' && styles.activeFilterTab]}
            onPress={() => setActiveType('deposits')}
          >
            <Text style={[
              styles.filterTabText,
              activeType === 'deposits' && styles.activeFilterTabText
            ]}>Deposits</Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeType === 'payouts' && styles.activeFilterTab]}
            onPress={() => setActiveType('payouts')}
          >
            <Text style={[
              styles.filterTabText,
              activeType === 'payouts' && styles.activeFilterTabText
            ]}>Payouts</Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeType === 'withdrawals' && styles.activeFilterTab]}
            onPress={() => setActiveType('withdrawals')}
          >
            <Text style={[
              styles.filterTabText,
              activeType === 'withdrawals' && styles.activeFilterTabText
            ]}>Withdrawals</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.dateRangeButton}>
          <Pressable 
            style={styles.dateRangeButtonContent}
            onPress={() => setIsDateRangeModalVisible(true)}
          >
            <Calendar size={16} color={colors.text} />
            <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
          </Pressable>
          {dateRange.start && dateRange.end && (
            <Pressable 
              style={styles.clearDateRangeButton}
              onPress={handleClearDateRange}
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Inflows</Text>
            <Text style={[styles.statValue, styles.positiveValue]}>{stats.inflows}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Outflows</Text>
            <Text style={[styles.statValue, styles.negativeValue]}>{stats.outflows}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Net Movement</Text>
            <Text style={[
              styles.statValue,
              parseFloat(stats.netMovement.replace(/[₦,]/g, '')) >= 0 ? styles.positiveValue : styles.negativeValue
            ]}>{stats.netMovement}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {Object.entries(groupedTransactions).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your filters</Text>
          </View>
        ) : (
          Object.entries(groupedTransactions).map(([date, transactions]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>
                {date === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  ? 'Today'
                  : date === new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    ? 'Yesterday'
                    : date}
              </Text>
              {transactions.map((transaction) => {
                // Map transaction types to icons and colors matching notifications page
                let Icon = ArrowDownRight;
                let iconBg = colors.accent;
                let iconColor = colors.primary;
                
                if (transaction.status === 'failed') {
                  // Failed transactions use error styling
                  Icon = XCircle;
                  iconBg = colors.errorLight;
                  iconColor = colors.error;
                } else {
                  switch (transaction.type) {
                    case 'deposit':
                      // Deposit: ArrowDownRight with accent/primary colors (matching deposit_successful)
                      Icon = ArrowDownRight;
                      iconBg = colors.accent;
                      iconColor = colors.primary;
                      break;
                    case 'payout':
                      // Payout: ArrowUpRight with success colors (matching payout_completed)
                      Icon = ArrowUpRight;
                      iconBg = colors.successLight;
                      iconColor = colors.success;
                      break;
                    case 'withdrawal':
                      // Withdrawal: ArrowUpRight with orange colors (matching emergency withdrawal)
                      Icon = ArrowUpRight;
                      iconBg = '#F97316';
                      iconColor = '#fff';
                      break;
                    case 'expense_plan_topup':
                      // Budget Top-Up: ArrowDownRight with accent/primary colors (similar to deposit)
                      Icon = ArrowDownRight;
                      iconBg = colors.accent;
                      iconColor = colors.primary;
                      break;
                    default:
                      Icon = ArrowDownRight;
                      iconBg = colors.accent;
                      iconColor = colors.primary;
                  }
                }
                
                const isPositive = transaction.type === 'deposit' || transaction.type === 'expense_plan_topup';
                
                // Format date and time
                const txDate = new Date(transaction.created_at);
                const formattedTime = txDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                return (
                  <Pressable
                    key={transaction.id}
                    style={styles.transaction}
                    onPress={() => handleTransactionPress(transaction)}
                  >
                    <View style={[styles.transactionIcon, { backgroundColor: iconBg }]}>
                      <Icon size={16} color={iconColor} strokeWidth={2} />
                    </View>
                    <View style={styles.transactionInfo}>
                      <View style={styles.transactionHeader}>
                        <Text style={styles.transactionTitle}>
                          {formatTransactionType(transaction.type)}
                        </Text>
                        <Text style={[
                          styles.transactionAmount,
                          isPositive ? styles.positiveAmount : styles.negativeAmount
                        ]}>{`${isPositive ? '' : '-'}₦${transaction.amount.toLocaleString()}`}</Text>
                      </View>
                      <View style={styles.transactionDetails}>
                        <Text style={styles.transactionDate}>
                          {formattedTime}
                        </Text>
                        <Text style={styles.transactionStatus}>
                          {transaction.type === 'payout' && transaction.status.toLowerCase() === 'scheduled' 
                            ? 'DISBURSED' 
                            : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {filteredTransactions.length > 0 && hasNextPage && (
          <Pressable style={styles.loadMoreButton} onPress={handleLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadMoreText}>Loading...</Text>
              </View>
            ) : (
              <Text style={styles.loadMoreText}>Load More Transactions</Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      {selectedTransaction && (
        <TransactionModal
          isVisible={isTransactionModalVisible}
          onClose={() => setIsTransactionModalVisible(false)}
          transaction={selectedTransaction}
        />
      )}
      
      <DateRangeModal
        isVisible={isDateRangeModalVisible}
        onClose={() => setIsDateRangeModalVisible(false)}
        onSelect={handleDateRangeSelect}
        initialStartDate={dateRange.start || undefined}
        initialEndDate={dateRange.end || undefined}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.backgroundTertiary,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  filterTabs: {
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.backgroundTertiary,
    marginRight: 6,
  },
  activeFilterTab: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  dateRangeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateRangeText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  clearDateRangeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  positiveValue: {
    color: colors.text,
  },
  negativeValue: {
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateGroup: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  dateHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionStatus: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  positiveAmount: {
    color: colors.text,
  },
  negativeAmount: {
    color: colors.text,
  },
  loadMoreButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});