import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import TransactionModal from '@/components/TransactionModal';
import DateRangeModal from '@/components/DateRangeModal';
import { router } from 'expo-router';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Calendar, Search, X, XCircle } from 'lucide-react-native';
import { useState, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions, Transaction } from '@/hooks/useRealtimeTransactions';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';

type TransactionType = 'all' | 'deposits' | 'payouts' | 'withdrawals';

interface ListItem {
  type: 'header' | 'transaction';
  date?: string;
  transaction?: Transaction;
}

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { transactions, isLoading } = useRealtimeTransactions();
  const { payoutPlans } = useRealtimePayoutPlans();
  const [activeType, setActiveType] = useState<TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  const handleTransactionPress = useCallback((transaction: Transaction) => {
    let displayStatus = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
    if (transaction.type === 'payout' && transaction.status.toLowerCase() === 'scheduled') {
      displayStatus = 'DISBURSED';
    }
    
    setSelectedTransaction({
      ...transaction,
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: displayStatus,
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
  }, []);

  const handleLoadMore = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  const handleDateRangeSelect = useCallback((startDate: Date | null, endDate: Date | null) => {
    setDateRange({ start: startDate, end: endDate });
  }, []);

  const handleClearDateRange = useCallback(() => {
    setDateRange({ start: null, end: null });
  }, []);

  const formatDateRange = useCallback(() => {
    if (!dateRange.start || !dateRange.end) return 'Select Date Range';
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  }, [dateRange]);

  const typeMap = useMemo(() => ({
    deposits: 'deposit',
    payouts: 'payout',
    withdrawals: 'withdrawal',
  }), []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (activeType !== 'all' && transaction.type !== typeMap[activeType as keyof typeof typeMap]) return false;
      if (searchQuery) {
        const matchesSearch = transaction.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
               transaction.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               transaction.destination?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
      }
      if (dateRange.start && dateRange.end) {
        const transactionDate = new Date(transaction.created_at);
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        if (transactionDate < startDate || transactionDate > endDate) return false;
      }
      return true;
    });
  }, [transactions, activeType, typeMap, searchQuery, dateRange]);

  const stats = useMemo(() => {
    const inflows = filteredTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflows = filteredTransactions
      .filter(t => t.type === 'payout' || t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      inflows: `₦${inflows.toLocaleString()}`,
      outflows: `-₦${outflows.toLocaleString()}`,
      netMovement: `₦${(inflows - outflows).toLocaleString()}`
    };
  }, [filteredTransactions]);

  const listData = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(transaction);
    });

    const items: ListItem[] = [];
    Object.entries(groups).forEach(([date, groupTransactions]) => {
      items.push({ type: 'header', date });
      groupTransactions.forEach(tx => {
        items.push({ type: 'transaction', transaction: tx });
      });
    });
    return items;
  }, [filteredTransactions]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      const dateStr = item.date;
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      return (
        <View style={styles.dateGroup}>
          <Text style={styles.dateHeader}>
            {dateStr === today ? 'Today' : dateStr === yesterday ? 'Yesterday' : dateStr}
          </Text>
        </View>
      );
    }

    const transaction = item.transaction!;
    let Icon = ArrowDownRight;
    let iconBg = colors.accent;
    let iconColor = colors.primary;
    
    if (transaction.status === 'failed') {
      Icon = XCircle;
      iconBg = colors.errorLight;
      iconColor = colors.error;
    } else {
      switch (transaction.type) {
        case 'deposit':
          Icon = ArrowDownRight;
          iconBg = colors.accent;
          iconColor = colors.primary;
          break;
        case 'payout':
          Icon = ArrowUpRight;
          iconBg = colors.successLight;
          iconColor = colors.success;
          break;
        case 'withdrawal':
          Icon = ArrowUpRight;
          iconBg = '#F97316';
          iconColor = '#fff';
          break;
      }
    }
    
    const isPositive = transaction.type === 'deposit';
    const txDate = new Date(transaction.created_at);
    const formattedTime = txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Pressable style={styles.transaction} onPress={() => handleTransactionPress(transaction)}>
          <View style={[styles.transactionIcon, { backgroundColor: iconBg }]}>
            <Icon size={24} color={iconColor} strokeWidth={2} />
          </View>
          <View style={styles.transactionInfo}>
            <View style={styles.transactionHeader}>
              <Text style={styles.transactionTitle}>
                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
              </Text>
              <Text style={[styles.transactionAmount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
                {`${isPositive ? '' : '-'}₦${transaction.amount.toLocaleString()}`}
              </Text>
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDate}>{formattedTime}</Text>
              <Text style={styles.transactionStatus}>
                {transaction.type === 'payout' && transaction.status.toLowerCase() === 'scheduled' 
                  ? 'DISBURSED' 
                  : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }, [styles, handleTransactionPress, colors]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
            <Pressable style={styles.iconButton} onPress={() => setIsSearchVisible(!isSearchVisible)}>
              {isSearchVisible ? <X size={20} color={colors.text} /> : <Search size={20} color={colors.text} />}
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

        <View style={{ height: 50 }}>
          <FlashList
            data={['all', 'deposits', 'payouts', 'withdrawals']}
            horizontal
            showsHorizontalScrollIndicator={false}
            estimatedItemSize={100}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.filterTab, activeType === item && styles.activeFilterTab]}
                onPress={() => setActiveType(item as TransactionType)}
              >
                <Text style={[styles.filterTabText, activeType === item && styles.activeFilterTabText]}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            )}
            contentContainerStyle={styles.filterTabs}
          />
        </View>

        <View style={styles.dateRangeButton}>
          <Pressable style={styles.dateRangeButtonContent} onPress={() => setIsDateRangeModalVisible(true)}>
            <Calendar size={20} color={colors.text} />
            <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
          </Pressable>
          {dateRange.start && dateRange.end && (
            <Pressable style={styles.clearDateRangeButton} onPress={handleClearDateRange}>
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
            <Text style={[styles.statValue, parseFloat(stats.netMovement.replace(/[₦,]/g, '')) >= 0 ? styles.positiveValue : styles.negativeValue]}>
              {stats.netMovement}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={listData}
          renderItem={renderItem}
          estimatedItemSize={100}
          keyExtractor={(item, index) => item.type === 'header' ? `header-${item.date}` : `tx-${item.transaction?.id}-${index}`}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your filters</Text>
            </View>
          }
          ListFooterComponent={
            listData.length > 0 ? (
              <Pressable style={styles.loadMoreButton} onPress={handleLoadMore}>
                {loading ? <PlanmoniLoader size="small" /> : <Text style={styles.loadMoreText}>Load More Transactions</Text>}
              </Pressable>
            ) : null
          }
        />
      </View>

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
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    marginRight: 8,
    height: 36,
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
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
    fontSize: 14,
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
    color: colors.text,
  },
  negativeValue: {
    color: colors.text,
  },
  emptyState: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionDate: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  transactionStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '600',
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
});
