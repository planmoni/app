import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import TransactionModal from '@/components/TransactionModal';
import { router } from 'expo-router';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Ban as Bank, Calendar, Search, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions, Transaction } from '@/hooks/useRealtimeTransactions';

type TransactionType = 'all' | 'deposits' | 'payouts' | 'withdrawals';

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { transactions, isLoading } = useRealtimeTransactions();
  const [activeType, setActiveType] = useState<TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction({
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
      date: new Date(transaction.created_at).toLocaleDateString(),
      time: new Date(transaction.created_at).toLocaleTimeString(),
      type: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
      source: transaction.source,
      destination: transaction.destination,
      transactionId: transaction.id,
      planRef: transaction.payout_plan_id || '',
      paymentMethod: 'Bank Transfer',
      initiatedBy: 'You',
      processingTime: transaction.status === 'completed' ? 'Instant' : '2-3 business days',
    });
    setIsTransactionModalVisible(true);
  };

  const handleLoadMore = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleDateRangeSelect = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
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

  const filteredTransactions = transactions.filter(transaction => {
    if (activeType !== 'all' && transaction.type !== activeType) {
      return false;
    }

    if (searchQuery) {
      return transaction.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
             transaction.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
             transaction.destination.toLowerCase().includes(searchQuery.toLowerCase());
    }

    if (dateRange.start && dateRange.end) {
      const transactionDate = new Date(transaction.created_at);
      return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    }

    return true;
  });

  // Calculate stats based on filtered transactions
  const stats = {
    inflows: `₦${filteredTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
      .toLocaleString()}`,
    outflows: `₦${filteredTransactions
      .filter(t => t.type === 'payout' || t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
      .toLocaleString()}`,
    netMovement: `₦${(
      filteredTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0) -
      filteredTransactions.filter(t => t.type === 'payout' || t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0)
    ).toLocaleString()}`
  };

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
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
  }, {});

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
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
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>All Transactions</Text>
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.iconButton}
              onPress={() => setIsSearchVisible(!isSearchVisible)}
            >
              {isSearchVisible ? (
                <X size={20} color={colors.text} />
              ) : (
                <Search size={20} color={colors.text} />
              )}
            </Pressable>
          </View>
        </View>

        {isSearchVisible && (
          <View style={styles.searchContainer}>
            <Search size={20} color={colors.textSecondary} />
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

        <Pressable 
          style={styles.dateRangeButton}
          onPress={() => setIsDateRangeModalVisible(true)}
        >
          <Calendar size={20} color="#1E3A8A" />
          <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
        </Pressable>

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
                const isPositive = transaction.type === 'deposit';
                const Icon = isPositive ? ArrowUpRight : transaction.type === 'payout' ? ArrowDownRight : Bank;
                const iconBg = isPositive ? '#DCFCE7' : transaction.type === 'payout' ? '#FEE2E2' : '#EFF6FF';
                const iconColor = isPositive ? '#22C55E' : transaction.type === 'payout' ? '#EF4444' : '#1E3A8A';
                
                return (
                  <Pressable
                    key={transaction.id}
                    style={styles.transaction}
                    onPress={() => handleTransactionPress(transaction)}
                  >
                    <View style={[styles.transactionIcon, { backgroundColor: iconBg }]}>
                      <Icon size={20} color={iconColor} />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionTitle}>
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {new Date(transaction.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      isPositive ? styles.positiveAmount : styles.negativeAmount
                    ]}>₦{transaction.amount.toLocaleString()}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {filteredTransactions.length > 0 && (
          <Pressable style={styles.loadMoreButton} onPress={handleLoadMore}>
            {loading ? (
              <View style={styles.loadingMoreContainer}>
                <PlanmoniLoader size="small" />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.backgroundTertiary,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: colors.text,
  },
  filterTabs: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    marginRight: 8,
  },
  activeFilterTab: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  dateRangeText: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveValue: {
    color: '#22C55E',
  },
  negativeValue: {
    color: '#EF4444',
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
    paddingVertical: 12,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#22C55E',
  },
  negativeAmount: {
    color: '#EF4444',
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
    fontSize: 14,
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