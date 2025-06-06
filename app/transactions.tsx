import DateRangeModal from '@/components/DateRangeModal';
import TransactionModal from '@/components/TransactionModal';
import { router } from 'expo-router';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Ban as Bank, Calendar, Search, Settings, SlidersHorizontal, Wallet, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type TransactionType = 'all' | 'deposits' | 'payouts' | 'withdrawals';

export default function TransactionsScreen() {
  const { colors } = useTheme();
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

  const handleTransactionPress = (transaction) => {
    setSelectedTransaction({
      amount: transaction.amount,
      status: transaction.status || 'Completed',
      date: transaction.date,
      time: transaction.time,
      type: transaction.type,
      source: transaction.source || 'Wallet',
      destination: transaction.destination || 'GTBank (****1234)',
      transactionId: transaction.id || 'TXN-82931A7F',
      planRef: transaction.planRef || 'PLAN-MNTH-0039',
      paymentMethod: transaction.paymentMethod || 'Bank Transfer',
      initiatedBy: transaction.initiatedBy || 'Auto-scheduler',
      processingTime: transaction.processingTime || 'Instant',
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

  const transactions = [
    {
      id: '1',
      type: 'Monthly Payout',
      date: 'Dec 15, 2024',
      time: '9:15 AM',
      amount: '+₦500,000',
      category: 'payouts',
      icon: ArrowUpRight,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      positive: true,
    },
    {
      id: '2',
      type: 'Emergency Withdrawal',
      date: 'Dec 15, 2024',
      time: '2:30 PM',
      amount: '-₦150,000',
      category: 'withdrawals',
      icon: ArrowDownRight,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      positive: false,
    },
    {
      id: '3',
      type: 'Vault Deposit',
      date: 'Dec 14, 2024',
      time: '11:45 AM',
      amount: '-₦3,000,000',
      category: 'deposits',
      icon: Bank,
      iconBg: '#EFF6FF',
      iconColor: '#3B82F6',
      positive: false,
    },
    {
      id: '4',
      type: 'Wallet Top-up',
      date: 'Dec 14, 2024',
      time: '4:20 PM',
      amount: '+₦1,000,000',
      category: 'deposits',
      icon: Wallet,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      positive: true,
    },
    {
      id: '5',
      type: 'Plan Edit - Rent Vault',
      date: 'Dec 12, 2024',
      time: '1:15 PM',
      amount: '₦0',
      category: 'all',
      icon: Settings,
      iconBg: colors.backgroundTertiary,
      iconColor: colors.textSecondary,
      positive: true,
    },
    {
      id: '6',
      type: 'Weekly Payout',
      date: 'Dec 12, 2024',
      time: '9:00 AM',
      amount: '+₦250,000',
      category: 'payouts',
      icon: ArrowUpRight,
      iconBg: '#DCFCE7',
      iconColor: '#22C55E',
      positive: true,
    },
    {
      id: '7',
      type: 'Emergency Fund Deposit',
      date: 'Dec 10, 2024',
      time: '3:30 PM',
      amount: '-₦500,000',
      category: 'deposits',
      icon: Bank,
      iconBg: '#EFF6FF',
      iconColor: '#3B82F6',
      positive: false,
    },
  ];

  const filteredTransactions = transactions.filter(transaction => {
    if (activeType !== 'all' && transaction.category !== activeType) {
      return false;
    }

    if (searchQuery) {
      return transaction.type.toLowerCase().includes(searchQuery.toLowerCase());
    }

    if (dateRange.start && dateRange.end) {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    }

    return true;
  });

  const stats = {
    inflows: '₦2,500,000',
    outflows: '₦3,200,000',
    netMovement: '-₦700,000',
  };

  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = transaction.date.split(',')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});

  const styles = createStyles(colors);

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
            <Pressable style={styles.iconButton}>
              <SlidersHorizontal size={20} color={colors.text} />
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
          <Calendar size={20} color="#3B82F6" />
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
              parseFloat(stats.netMovement) >= 0 ? styles.positiveValue : styles.negativeValue
            ]}>{stats.netMovement}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateHeader}>
              {date === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).split(',')[0]
                ? 'Today'
                : date === new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).split(',')[0]
                  ? 'Yesterday'
                  : date}
            </Text>
            {transactions.map((transaction) => (
              <Pressable
                key={transaction.id}
                style={styles.transaction}
                onPress={() => handleTransactionPress(transaction)}
              >
                <View style={[styles.transactionIcon, { backgroundColor: transaction.iconBg }]}>
                  <transaction.icon size={20} color={transaction.iconColor} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>{transaction.type}</Text>
                  <Text style={styles.transactionDate}>{transaction.time}</Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  transaction.positive ? styles.positiveAmount : styles.negativeAmount
                ]}>{transaction.amount}</Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Pressable style={styles.loadMoreButton} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>
            {loading ? 'Loading...' : 'Load More Transactions'}
          </Text>
        </Pressable>
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
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
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
    color: '#3B82F6',
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
  loadMoreText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
});