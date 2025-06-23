import React, { useState, useEffect, useRef } from 'react';
import Card from '@/components/Card';
import TransactionModal from '@/components/TransactionModal';
import InitialsAvatar from '@/components/InitialsAvatar';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import CountdownTimer from '@/components/CountdownTimer';
import PendingActionsCard from '@/components/PendingActionsCard';
import { useRoute } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Lock, Pause, Play, Plus, Send, Wallet } from 'lucide-react-native';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';
import { formatPayoutFrequency, getDayOfWeekName } from '@/lib/formatters';

export default function HomeScreen() {
  const { showBalances, toggleBalances, balance, lockedBalance, availableBalance } = useBalance();
  const { session } = useAuth();
  const { colors, isDark } = useTheme();
  const { payoutPlans, isLoading: payoutPlansLoading } = useRealtimePayoutPlans();
  const { transactions, isLoading: transactionsLoading } = useRealtimeTransactions();
  const { impact, notification } = useHaptics();
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

  // Log screen view for analytics
  useEffect(() => {
    logAnalyticsEvent('screen_view', {
      screen_name: 'Home',
      screen_class: 'HomeScreen',
    });
  }, []);

  const handleProfilePress = () => {
    router.push('/profile');
    logAnalyticsEvent('profile_click');
  };

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
    
    if (hour >= 0 && hour < 12) {
      return 'Good morning ☀️';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon 🌤️';
    } else {
      return 'Good evening 🌅';
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
    // Trigger medium impact haptic feedback
    impact();
    router.push('/add-funds');
    logAnalyticsEvent('add_funds_click');
  };

  const handleCreatePayout = () => {
    // Trigger medium impact haptic feedback
    impact();
    router.push('/create-payout/amount');
    logAnalyticsEvent('create_payout_click');
  };

  const handleViewPayout = (id?: string) => {
    // Trigger selection haptic feedback
    notification();
    if (id) {
      router.push({
        pathname: '/view-payout',
        params: { id }
      });
      logAnalyticsEvent('view_payout', { payout_id: id });
    } else {
      router.push('/view-payout');
      logAnalyticsEvent('view_payout');
    }
  };

  const handleViewAllPayouts = () => {
    router.push('/all-payouts');
    logAnalyticsEvent('view_all_payouts');
  };

  const handleTransactionPress = (transaction) => {
    // Format transaction data for the modal
    const formattedTransaction = {
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
      date: new Date(transaction.created_at).toLocaleDateString(),
      time: new Date(transaction.created_at).toLocaleTimeString(),
      type: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
      source: transaction.source,
      destination: transaction.destination,
      transactionId: transaction.id,
      planRef: transaction.payout_plan_id || '',
      paymentMethod: transaction.type === 'deposit' ? 'Bank Transfer' : 
                    transaction.bank_accounts ? 
                    `${transaction.bank_accounts.bank_name} •••• ${transaction.bank_accounts.account_number.slice(-4)}` : 
                    'Bank Account',
      initiatedBy: 'You',
      processingTime: transaction.status === 'completed' ? 'Instant' : '2-3 business days',
    };
    
    setSelectedTransaction(formattedTransaction);
    setIsTransactionModalVisible(true);
    logAnalyticsEvent('view_transaction', { transaction_id: transaction.id, transaction_type: transaction.type });
  };

  // Get active payout plans for display
  const activePlans = payoutPlans.filter(plan => plan.status === 'active').slice(0, 3);
  
  // Find the next payout - the one with the earliest next_payout_date that hasn't expired
  const nextPayout = payoutPlans
    .filter(plan => {
      // Only include active plans with a valid next payout date
      if (plan.status !== 'active' || !plan.next_payout_date) return false;
      
      // Check if the next payout date is in the future (not expired)
      const nextPayoutDate = new Date(plan.next_payout_date);
      return nextPayoutDate > new Date();
    })
    .sort((a, b) => {
      const dateA = new Date(a.next_payout_date!);
      const dateB = new Date(b.next_payout_date!);
      return dateA.getTime() - dateB.getTime();
    })[0]; // Get the first one (earliest date)

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

  // Find the last payout date - the most recent completed payout
  const getLastPayoutDate = () => {
    // Sort all plans by their completed_payouts and find the most recent one
    const completedPayouts = payoutPlans.filter(plan => plan.completed_payouts > 0);
    
    if (completedPayouts.length === 0) {
      return 'No payouts yet';
    }
    
    // For simplicity, we'll use the start_date and completed_payouts to estimate the last payout date
    // In a real app, you would track actual payout dates in transactions
    const mostRecentPlan = completedPayouts.reduce((latest, current) => {
      const latestDate = new Date(latest.start_date);
      const currentDate = new Date(current.start_date);
      
      // Add time based on frequency and completed payouts
      let latestPayoutDate = new Date(latestDate);
      let currentPayoutDate = new Date(currentDate);
      
      if (latest.frequency === 'weekly') {
        latestPayoutDate.setDate(latestDate.getDate() + (7 * (latest.completed_payouts - 1)));
      } else if (latest.frequency === 'biweekly') {
        latestPayoutDate.setDate(latestDate.getDate() + (14 * (latest.completed_payouts - 1)));
      } else if (latest.frequency === 'monthly') {
        latestPayoutDate.setMonth(latestDate.getMonth() + (latest.completed_payouts - 1));
      }
      
      if (current.frequency === 'weekly') {
        currentPayoutDate.setDate(currentDate.getDate() + (7 * (current.completed_payouts - 1)));
      } else if (current.frequency === 'biweekly') {
        currentPayoutDate.setDate(currentDate.getDate() + (14 * (current.completed_payouts - 1)));
      } else if (current.frequency === 'monthly') {
        currentPayoutDate.setMonth(currentDate.getMonth() + (current.completed_payouts - 1));
      }
      
      return currentPayoutDate > latestPayoutDate ? current : latest;
    });
    
    // Calculate the estimated last payout date
    const startDate = new Date(mostRecentPlan.start_date);
    let lastPayoutDate = new Date(startDate);
    
    if (mostRecentPlan.frequency === 'weekly') {
      lastPayoutDate.setDate(startDate.getDate() + (7 * (mostRecentPlan.completed_payouts - 1)));
    } else if (mostRecentPlan.frequency === 'biweekly') {
      lastPayoutDate.setDate(startDate.getDate() + (14 * (mostRecentPlan.completed_payouts - 1)));
    } else if (mostRecentPlan.frequency === 'monthly') {
      lastPayoutDate.setMonth(startDate.getMonth() + (mostRecentPlan.completed_payouts - 1));
    }
    
    return lastPayoutDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get recent transactions for display
  const recentTransactions = transactions.slice(0, 5);

  const styles = createStyles(colors, isDark);

  // Show loader if any data is loading
  if (payoutPlansLoading || transactionsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PlanmoniLoader 
          blurBackground={true} 
          size="medium" 
          description="Loading your financial data..."
        />
      </SafeAreaView>
    );
  }

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
            <Pressable onPress={handleProfilePress} style={styles.avatarButton}>
              <InitialsAvatar 
                firstName={firstName} 
                lastName={lastName} 
                size={48}
                fontSize={18}
              />
            </Pressable>
            <Text style={styles.date}>{formatDate(currentDate)}</Text>
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Hello, {firstName}.</Text>
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
            <Text style={styles.balanceAmount}>{formatBalance(availableBalance)}</Text>
            <View style={styles.lockedSection}>
              <View style={styles.lockedLabelContainer}>
                <Lock size={16} color={colors.textSecondary} />
                <Text style={styles.lockedLabel}>Locked for payouts</Text>
              </View>
              <Text style={styles.lockedAmount}>{formatBalance(lockedBalance)}</Text>
            </View>
            <View style={styles.buttonGroup}>
              <Pressable 
                style={styles.createButton} 
                onPress={handleCreatePayout}
              >
                <Send size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>New</Text>
              </Pressable>
              <Pressable 
                style={styles.addFundsButton} 
                onPress={handleAddFunds}
              >
                <Wallet size={20} color={colors.text} />
                <Text style={styles.addFundsText}>Add Funds</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        

        <PendingActionsCard />

        {nextPayout && (
          <Pressable 
            style={styles.payoutCard}
            onPress={() => handleViewPayout(nextPayout.id)}
          >
            <View style={styles.payoutCardContent}>
              <View style={styles.payoutHeader}>
                <Text style={styles.payoutTitle}>Upcoming Payout</Text>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>
                    {nextPayout.status === 'active' ? 'Running' : 'Paused'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.payoutDetails}>
                <View style={styles.payoutInfo}>
                  <Text style={styles.payoutName}>{nextPayout.name}</Text>
                  <Text style={styles.payoutAmount}>{formatBalance(nextPayout.payout_amount)}</Text>
                  
                  {nextPayout.next_payout_date && (
                    <CountdownTimer 
                      targetDate={nextPayout.next_payout_date} 
                      style={styles.dateContainer}
                    />
                  )}
                </View>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${Math.round((nextPayout.completed_payouts / nextPayout.duration) * 100)}%` }
                      ]} 
                    />
                  </View>
                  <View style={styles.progressStats}>
                    <Text style={styles.progressText}>
                      {formatBalance(nextPayout.completed_payouts * nextPayout.payout_amount)}/{formatBalance(nextPayout.total_amount)}
                    </Text>
                    <Text style={styles.progressCount}>
                      {nextPayout.completed_payouts}/{nextPayout.duration}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your payout plans</Text>
            <Pressable style={styles.viewAllButton} onPress={handleViewAllPayouts}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          
          {activePlans.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payoutPlansContainer}
            >
              {activePlans.map((plan) => {
                const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
                const completedAmount = plan.completed_payouts * plan.payout_amount;
                
                // Get the day of week from metadata if available
                const dayOfWeek = plan.metadata?.dayOfWeek;
                const originalFrequency = plan.metadata?.originalFrequency || plan.frequency;
                
                return (
                  <Pressable
                    key={plan.id}
                    style={styles.payoutPlanCard}
                    onPress={() => handleViewPayout(plan.id)}
                  >
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
                        {formatPayoutFrequency(originalFrequency, dayOfWeek)}
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
                    
                    {plan.next_payout_date && (
                      <Text style={styles.nextPayoutDate}>
                        Payday: {new Date(plan.next_payout_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </Pressable>
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
            <Pressable 
              style={styles.viewAllButton} 
              onPress={() => {
                router.push('/transactions');
                logAnalyticsEvent('view_all_transactions');
              }}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          
          {recentTransactions.length > 0 ? (
            recentTransactions.map((transaction) => {
              const isPositive = transaction.type === 'deposit';
              const Icon = isPositive ? ArrowUpRight : 
                          transaction.type === 'payout' ? ArrowDownRight : ArrowDown;
              
              // Format date and time
              const txDate = new Date(transaction.created_at);
              const formattedDate = txDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const formattedTime = txDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              
              // Determine transaction method
              const transactionMethod = isPositive ? 'Bank Transfer' : 
                                       transaction.bank_accounts ? 
                                       `${transaction.bank_accounts.bank_name} •••• ${transaction.bank_accounts.account_number.slice(-4)}` : 
                                       'Bank Account';
              
              return (
                <Pressable 
                  key={transaction.id} 
                  onPress={() => handleTransactionPress(transaction)}
                >
                  <Card style={styles.transactionCard}>
                    <View style={styles.transaction}>
                      <View style={[
                        styles.transactionIcon,
                        { backgroundColor: isPositive ? '#DCFCE7' : '#FEE2E2' }
                      ]}>
                        <Icon
                          size={20}
                          color={isPositive ? '#22C55E' : '#EF4444'}
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionTitle}>
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </Text>
                        <Text style={styles.transactionMethod}>
                          {transactionMethod}
                        </Text>
                        <Text style={styles.transactionDateTime}>
                          {formattedDate} • {formattedTime}
                        </Text>
                      </View>
                      <Text style={[
                        styles.transactionAmount,
                        { color: isPositive ? '#22C55E' : '#EF4444' }
                      ]}>
                        {formatBalance(transaction.amount)}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyTransactionsContainer}>
              <Text style={styles.emptyTransactionsText}>No transactions yet</Text>
            </View>
          )}
          
          {recentTransactions.length > 0 && (
            <Pressable 
              style={styles.viewAllTransactionsButton}
              onPress={() => {
                router.push('/transactions');
                logAnalyticsEvent('view_all_transactions_button');
              }}
            >
              <Text style={styles.viewAllTransactionsText}>View All Transactions</Text>
              <ChevronRight size={20} color={colors.primary} />
            </Pressable>
          )}
        </View>

        <View style={styles.bottomPadding} />
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
                  {getLastPayoutDate()}
                </Text>
              </View>
            </View>
          )}
          <Pressable 
            style={styles.seeMoreButton} 
            onPress={() => {
              setIsSummaryExpanded(!isSummaryExpanded);
              logAnalyticsEvent('toggle_summary', { expanded: !isSummaryExpanded });
            }}
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
        <Pressable 
          style={styles.createButton} 
          onPress={handleCreatePayout}
        >
          <Send size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>New</Text>
        </Pressable>
        <Pressable 
          style={styles.addFundsButton} 
          onPress={handleAddFunds}
        >
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

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 150,
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
  avatarButton: {
    borderRadius: 24,
    overflow: 'hidden',
    // Add subtle feedback for the touchable area
    activeOpacity: 0.8,
  },
  greetingContainer: {
    marginLeft: 0,
  },
  greeting: {
    fontSize: 16,
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
    fontSize: 12,
    color: colors.textSecondary,
  },
  eyeIconButton: {
    padding: 8,
    margin: -8,
  },
  balanceAmount: {
    fontSize: 20,
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
    marginBottom: 18,
    paddingHorizontal: 1,
    paddingTop: 5,
  },
  summaryTitle: {
    fontSize: 14,
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
    gap: 10,
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
    marginBottom: 30,
    borderRadius: 16,
    padding: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  payoutCardContent: {
    padding: 1,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  payoutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5AE04F',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  payoutDetails: {
    marginBottom: 5,
  },
  payoutInfo: {
    marginBottom: 16,
  },
  payoutName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  payoutDate: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressAmount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  payoutActions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  viewButton: {
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
    fontSize: 14,
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
    marginTop: 10,
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
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  emptyTransactionsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTransactionsText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    padding: 15,
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
    fontSize: 18,
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
  planProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nextPayoutDate: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 16,
  },
  progressCount: {
    fontSize: 12,
    color: colors.textSecondary,
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  transactionMethod: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  transactionDateTime: {
    fontSize: 12,
    color: colors.textTertiary,
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
    height: 1,
  },
});