import React, { useState, useEffect } from 'react';
import Card from '@/components/Card';
import TransactionModal from '@/components/TransactionModal';
import InitialsAvatar from '@/components/InitialsAvatar';
import { useRoute } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Lock, Pause, Play, Plus, Send, Wallet } from 'lucide-react-native';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePayoutPlans } from '@/hooks/usePayoutPlans';

export default function HomeScreen() {
  const { showBalances, toggleBalances, balance, lockedBalance } = useBalance();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { payoutPlans, isLoading: payoutPlansLoading } = usePayoutPlans();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const route = useRoute();
  const params = useLocalSearchParams();
  const scrollY = route.params?.scrollY || new Animated.Value(0);

  // Get user info from session
  const firstName = session?.user?.user_metadata?.first_name || 'User';
  const lastName = session?.user?.user_metadata?.last_name || '';

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    const suffix = getDaySuffix(day);
    return `${day}${suffix} ${month} ${year}`;
  };

  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const getGreeting = () => {
    const hour = currentDate.getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'Good morning ☀️';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon 🌤️';
    } else if (hour >= 17 && hour < 21) {
      return 'Good evening 🌅';
    } else {
      return 'Good night 🌙';
    }
  };

  const buttonOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '••••••••';
  };

  const handleAddFunds = () => {
    router.push('/add-funds');
  };

  const handleCreatePayout = () => {
    router.push('/create-payout/amount');
  };

  const handleViewPayout = (id?: string) => {
    if (id) {
      router.push({
        pathname: '/view-payout',
        params: { id }
      });
    } else {
      router.push('/view-payout');
    }
  };

  const handleViewAllPayouts = () => {
    router.push('/all-payouts');
  };

  const handleTransactionPress = (transaction) => {
    setSelectedTransaction({
      amount: transaction.amount,
      status: transaction.type === 'Monthly Payout' ? 'Completed' : 
             transaction.type === 'Vault Deposit' ? 'Processing' :
             transaction.type === 'Rent Payment' ? 'Scheduled' : 'Failed',
      date: transaction.date,
      time: transaction.time,
      type: transaction.type,
      source: transaction.type.includes('Payout') ? 'Monthly Salary Vault' :
             transaction.type === 'Vault Deposit' ? 'GTBank (****1234)' : 'Available Balance',
      destination: transaction.type.includes('Payout') ? 'GTBank (****1234)' :
                  transaction.type === 'Vault Deposit' ? 'Emergency Fund Vault' : 'Rent Vault',
      transactionId: `TXN-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      planRef: transaction.type.includes('Payout') ? 'PLAN-MNTH-0039' : '',
      paymentMethod: 'Bank Transfer',
      initiatedBy: transaction.type.includes('scheduled') ? 'Auto-scheduler' : 'You',
      processingTime: transaction.type.includes('Payout') ? 'Instant' : '2-3 business days',
    });
    setIsTransactionModalVisible(true);
  };

  // Get active payout plans for display
  const activePlans = payoutPlans.filter(plan => plan.status === 'active').slice(0, 3);
  const nextPayout = activePlans.find(plan => plan.next_payout_date);

  // Calculate summary stats from actual data
  const totalPaidOut = payoutPlans.reduce((sum, plan) => 
    sum + (plan.completed_payouts * plan.payout_amount), 0
  );
  
  const pendingPayouts = payoutPlans
    .filter(plan => plan.status === 'active')
    .reduce((sum, plan) => 
      sum + ((plan.duration - plan.completed_payouts) * plan.payout_amount), 0
    );

  const completionRate = payoutPlans.length > 0 
    ? Math.round((payoutPlans.filter(plan => plan.status === 'completed').length / payoutPlans.length) * 100)
    : 0;

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <InitialsAvatar 
              firstName={firstName} 
              lastName={lastName} 
              size={48}
              fontSize={18}
            />
            <Text style={styles.date}>{formatDate(currentDate)}</Text>
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Hi, {firstName}.</Text>
            <Text style={styles.subGreeting}>{getGreeting()}, let's plan some payments</Text>
          </View>
        </View>

        <Card style={styles.balanceCard}>
          <View style={styles.balanceCardContent}>
            <View style={styles.balanceLabelContainer}>
              <Text style={styles.balanceLabel}>Available Wallet Balance</Text>
              <Pressable 
                onPress={toggleBalances}
                style={styles.eyeIconButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                {showBalances ? (
                  <EyeOff size={16} color={colors.textSecondary} />
                ) : (
                  <Eye size={16} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
            <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
            <View style={styles.lockedSection}>
              <View style={styles.lockedLabelContainer}>
                <Lock size={16} color={colors.textSecondary} />
                <Text style={styles.lockedLabel}>Locked for payouts</Text>
              </View>
              <Text style={styles.lockedAmount}>{formatBalance(lockedBalance)}</Text>
            </View>
            <View style={styles.buttonGroup}>
              <Pressable style={styles.createButton} onPress={handleCreatePayout}>
                <Send size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Plan</Text>
              </Pressable>
              <Pressable style={styles.addFundsButton} onPress={handleAddFunds}>
                <Wallet size={20} color={colors.text} />
                <Text style={styles.addFundsText}>Add Funds</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Current Month's Summary</Text>
            <Calendar size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.summaryItems}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Paid Out</Text>
              <Text style={styles.summaryValue}>{formatBalance(totalPaidOut)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending payouts</Text>
              <Text style={styles.summaryValue}>{formatBalance(pendingPayouts)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
              <Text style={styles.summaryValue}>{completionRate}%</Text>
            </View>
          </View>
          {isSummaryExpanded && (
            <View style={styles.expandedContent}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Active Plans</Text>
                <Text style={styles.summaryValue}>{activePlans.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Plans</Text>
                <Text style={styles.summaryValue}>{payoutPlans.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Last payout date</Text>
                <Text style={styles.summaryValue}>
                  {payoutPlans.length > 0 ? 'June 2, 2025' : 'No payouts yet'}
                </Text>
              </View>
            </View>
          )}
          <Pressable 
            style={styles.seeMoreButton} 
            onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
          >
            <Text style={styles.seeMoreText}>
              {isSummaryExpanded ? 'Show less' : 'See more'}
            </Text>
            {isSummaryExpanded ? (
              <ChevronUp size={16} color={colors.primary} />
            ) : (
              <ChevronDown size={16} color={colors.primary} />
            )}
          </Pressable>
        </Card>

        {nextPayout && (
          <Card style={styles.payoutCard}>
            <View style={styles.payoutHeader}>
              <Text style={styles.payoutTitle}>Next Payout</Text>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>
                  {nextPayout.status === 'active' ? 'Running' : 'Paused'}
                </Text>
              </View>
            </View>
            <Text style={styles.payoutAmount}>{formatBalance(nextPayout.payout_amount)}</Text>
            <Text style={styles.payoutDate}>
              {nextPayout.next_payout_date 
                ? `${new Date(nextPayout.next_payout_date).toLocaleDateString()} • ${Math.ceil((new Date(nextPayout.next_payout_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left`
                : 'Date not set'
              }
            </Text>
            <View style={styles.payoutActions}>
              <Pressable style={styles.viewButton} onPress={() => handleViewPayout(nextPayout.id)}>
                <Text style={styles.viewButtonText}>View</Text>
                <ChevronRight size={20} color={colors.text} />
              </Pressable>
            </View>
          </Card>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your payouts</Text>
            <Pressable style={styles.viewAllButton} onPress={handleViewAllPayouts}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          
          {payoutPlansLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading your payout plans...</Text>
            </View>
          ) : activePlans.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payoutPlansContainer}
            >
              {activePlans.map((plan) => {
                const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
                const completedAmount = plan.completed_payouts * plan.payout_amount;
                
                return (
                  <Card key={plan.id} style={styles.payoutPlanCard}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planType}>{plan.name}</Text>
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>
                          {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planAmount}>{formatBalance(plan.total_amount)}</Text>
                    <View style={styles.planDetails}>
                      <Text style={styles.planFrequency}>
                        {plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}
                      </Text>
                      <Text style={styles.planDot}>•</Text>
                      <Text style={styles.planValue}>{formatBalance(plan.payout_amount)}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <View style={styles.planProgress}>
                      <Text style={styles.progressText}>
                        {formatBalance(completedAmount)}/{formatBalance(plan.total_amount)}
                      </Text>
                      <Text style={styles.progressCount}>
                        {plan.completed_payouts}/{plan.duration}
                      </Text>
                    </View>
                    <Text style={styles.nextPayoutDate}>
                      Next payout: {plan.next_payout_date 
                        ? new Date(plan.next_payout_date).toLocaleDateString()
                        : 'Not scheduled'
                      }
                    </Text>
                    <Pressable 
                      style={styles.planViewButton}
                      onPress={() => handleViewPayout(plan.id)}
                    >
                      <Text style={styles.planViewButtonText}>View</Text>
                      <ChevronRight size={16} color={colors.primary} />
                    </Pressable>
                  </Card>
                );
              })}
              <Pressable 
                style={styles.addPayoutCard}
                onPress={handleCreatePayout}
              >
                <Plus size={24} color={colors.primary} />
                <Text style={styles.addPayoutText}>Create New Payout</Text>
                <Text style={styles.addPayoutDescription}>
                  Set up a new automated payout plan
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.emptyPayoutsContainer}>
              <Text style={styles.emptyPayoutsText}>No active payout plans</Text>
              <Pressable style={styles.createFirstPayoutButton} onPress={handleCreatePayout}>
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.createFirstPayoutText}>Create Your First Plan</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable style={styles.viewAllButton} onPress={() => router.push('/transactions')}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          {[
            {
              type: 'Monthly Payout',
              date: 'Dec 1, 2024',
              time: '9:15 AM',
              amount: '+₦500,000.00',
              positive: true,
              icon: ArrowUpRight,
            },
            {
              type: 'Vault Deposit',
              date: 'Nov 28, 2024',
              time: '3:00 PM',
              amount: '-₦3,000,000.00',
              positive: false,
              icon: ArrowDownRight,
            },
            {
              type: 'Rent Payment',
              date: 'Nov 25, 2024',
              time: '3:00 PM',
              amount: '-₦750,000.00',
              positive: false,
              icon: ArrowDown,
            },
            {
              type: 'Investment Return',
              date: 'Nov 22, 2024',
              time: '11:30 AM',
              amount: '+₦1,200,000.00',
              positive: true,
              icon: ArrowUpRight,
            },
            {
              type: 'Transfer to Savings',
              date: 'Nov 20, 2024',
              time: '2:30 PM',
              amount: '-₦500,000.00',
              positive: false,
              icon: ArrowRight,
            },
          ].map((transaction, index) => (
            <Pressable 
              key={index} 
              onPress={() => handleTransactionPress(transaction)}
            >
              <Card style={styles.transactionCard}>
                <View style={styles.transaction}>
                  <View style={[
                    styles.transactionIcon,
                    { backgroundColor: transaction.positive ? '#DCFCE7' : '#FEE2E2' }
                  ]}>
                    <transaction.icon
                      size={20}
                      color={transaction.positive ? '#22C55E' : '#EF4444'}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{transaction.type}</Text>
                    <Text style={styles.transactionDate}>{transaction.date}</Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.positive ? '#22C55E' : '#EF4444' }
                  ]}>
                    {formatBalance(parseFloat(transaction.amount.replace(/[₦,+]/g, '')))}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
          <Pressable 
            style={styles.viewAllTransactionsButton}
            onPress={() => router.push('/transactions')}
          >
            <Text style={styles.viewAllTransactionsText}>View All Transactions</Text>
            <ChevronRight size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Animated.View style={[
        styles.stickyButtons,
        {
          opacity: buttonOpacity,
          transform: [{
            translateY: buttonOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0],
            }),
          }],
        },
      ]}>
        <Pressable style={styles.createButton} onPress={handleCreatePayout}>
          <Send size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Plan</Text>
        </Pressable>
        <Pressable style={styles.addFundsButton} onPress={handleAddFunds}>
          <Wallet size={20} color={colors.text} />
          <Text style={styles.addFundsText}>Add Funds</Text>
        </Pressable>
      </Animated.View>

      {selectedTransaction && (
        <TransactionModal
          isVisible={isTransactionModalVisible}
          onClose={() => setIsTransactionModalVisible(false)}
          transaction={selectedTransaction}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingContainer: {
    marginLeft: 0,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceCard: {
    backgroundColor: colors.card,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceCardContent: {
    paddingVertical: 1,
    paddingHorizontal: 1,
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  eyeIconButton: {
    padding: 8,
    margin: -8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  lockedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 16,
  },
  lockedLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  lockedAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addFundsButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addFundsText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 1,
    paddingTop: 5,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  summaryItems: {
    paddingHorizontal: 1,
    gap: 16,
  },
  expandedContent: {
    paddingHorizontal: 1,
    paddingTop: 16,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  seeMoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  payoutCard: {
    marginBottom: 24,
    borderRadius: 16,
    padding: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutTitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  activeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeTagText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  payoutAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  payoutDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  payoutActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyPayoutsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPayoutsText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  createFirstPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstPayoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  payoutPlansContainer: {
    paddingRight: 1,
  },
  payoutPlanCard: {
    width: 300,
    marginRight: 16,
    borderRadius: 16,
    padding: 1,
    marginBottom: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  planDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  planFrequency: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planDot: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  planProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nextPayoutDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  planViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  planViewButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  addPayoutCard: {
    width: 300,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPayoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  addPayoutDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  transactionCard: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
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
  viewAllTransactionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  viewAllTransactionsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  stickyButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomPadding: {
    height: 100,
  },
});