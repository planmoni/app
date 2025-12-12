import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Lock, 
  Calendar, 
  ArrowRight, 
  Tag, 
  Wallet, 
  ShoppingCart,
  Clock,
  CreditCard,
  Settings,
  X,
  TrendingUp,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpenseBucketCard from '@/components/expense-planner/ExpenseBucketCard';
import PieChart from '@/components/expense-planner/PieChart';
import BarChart from '@/components/expense-planner/BarChart';
import PlanActivity from '@/components/expense-planner/PlanActivity';
import { ExpensePlan, ExpenseBucket } from '@/types/expense-planner';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';
import { getCategoryIcon } from '@/lib/expenseCategories';
import { isBudgetStarted, getBudgetDuration, formatDateRange } from '@/lib/expensePlanUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  travel: '#3B82F6',
  food: '#F59E0B',
  shopping: '#EC4899',
  entertainment: '#8B5CF6',
  bills: '#10B981',
  health: '#EF4444',
  education: '#6366F1',
  transportation: '#14B8A6',
  housing: '#F97316',
  personal: '#A855F7',
};

export default function PlanDetailScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [planWallet, setPlanWallet] = useState<any>(null);
  const [planHealth, setPlanHealth] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { expensePlans, fetchExpensePlans, deleteExpensePlan } = useExpensePlans();
  const { buckets, fetchBuckets } = useExpenseBuckets(id as string);

  const plan = expensePlans.find(p => p.id === id) || null;
  const currentBalance = (plan as any)?.current_balance || 0;
  const budgetStarted = plan ? isBudgetStarted(plan.start_date) : false;

  // Fetch plan wallet, transactions, and health
  React.useEffect(() => {
    if (!id) return;

    const fetchPlanData = async () => {
      try {
        // Fetch wallet
        const { data: wallet } = await supabase
          .from('plan_wallets')
          .select('*')
          .eq('plan_id', id)
          .single();

        if (wallet) setPlanWallet(wallet);

        // Fetch transactions
        const { data: txns } = await supabase
          .from('plan_transactions')
          .select('*')
          .eq('plan_id', id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (txns) setTransactions(txns);

        // Fetch latest health record
        const { data: health } = await supabase
          .from('plan_health')
          .select('*')
          .eq('plan_id', id)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();

        if (health) setPlanHealth(health);
      } catch (error) {
        console.error('Error fetching plan data:', error);
      }
    };

    fetchPlanData();
  }, [id]);

  // Update time for countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchExpensePlans(), fetchBuckets()]);
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing plan:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogExpense = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/log-expense',
      params: { planId: id as string },
    });
  };

  const handleSpendFromPlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/spend',
      params: { id: id as string },
    });
  };

  const handleAdjustBudget = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/edit',
      params: { id: id as string },
    });
  };

  const handleFundPlan = () => {
    haptics.mediumImpact();
    if (!plan) return;
    
    // Navigate to fund-plan screen for Paystack payment
    router.push({
      pathname: '/expense-planner/create/fund-plan',
      params: {
        planId: plan.id,
        planName: plan.name,
        totalBudget: plan.total_budget.toString(),
      },
    });
  };

  const handleWithdraw = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/withdraw',
      params: { id: id as string },
    });
  };

  const handleScheduleWithdrawal = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/schedule-withdrawal',
      params: { id: id as string },
    });
  };

  const handleCloseBudget = () => {
    haptics.mediumImpact();
    Alert.alert(
      'Close Budget',
      'What would you like to do with the remaining funds?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Move to Wallet',
          onPress: () => {
            // TODO: Implement move to wallet
            Alert.alert('Coming Soon', 'This feature will be available soon');
          },
        },
        {
          text: 'Auto Payout to Bank',
          onPress: () => {
            // TODO: Implement auto payout
            Alert.alert('Coming Soon', 'This feature will be available soon');
          },
        },
      ]
    );
  };

  const handleViewBalance = () => {
    haptics.selection();
    // Navigate to balance page with plan context
    router.push({
      pathname: '/expense-planner/[id]/balance',
      params: { id: id as string },
    });
  };

  // Calculate plan information
  const hasLockedFunds = (plan?.total_locked || 0) > 0;
  
  // Get plan type tag
  const getPlanTypeTag = () => {
    const planType = plan?.plan_type || 'one_time';
    switch (planType) {
      case 'recurring':
        return { label: 'Recurring', color: '#3B82F6' };
      case 'long_term':
        return { label: 'Long Term', color: '#8B5CF6' };
      default:
        return { label: 'One Time', color: '#10B981' };
    }
  };

  const planTypeTag = getPlanTypeTag();

  // Get funding status tag
  const getStatusTagStyle = () => {
    if (!plan) return { bgColor: colors.backgroundTertiary, textColor: colors.textSecondary, label: 'Unknown' };
    
    const fundingStatus = plan.funding_status || 'draft';
    
    switch (fundingStatus) {
      case 'draft':
        return { bgColor: colors.backgroundTertiary, textColor: colors.textSecondary, label: 'Draft' };
      case 'unfunded':
        return { bgColor: '#FEF3C7', textColor: '#D97706', label: 'Unfunded' };
      case 'partially_funded':
        return { bgColor: '#DBEAFE', textColor: '#2563EB', label: 'Partially Funded' };
      case 'funded':
        return { bgColor: '#D1FAE5', textColor: '#059669', label: 'Funded' };
      default:
        return { bgColor: colors.backgroundTertiary, textColor: colors.textSecondary, label: 'Active' };
    }
  };

  const statusTag = getStatusTagStyle();

  // Get all subcategory icons
  const getAllSubcategoryIcons = () => {
    if (!plan?.buckets || plan.buckets.length === 0) {
      return [];
    }

    return plan.buckets.map(bucket => {
      const Icon = getCategoryIcon(bucket.category_id);
      return { bucket, Icon };
    }).filter(item => item.Icon);
  };

  const subcategoryIcons = getAllSubcategoryIcons();

  // Calculate funding progress
  const totalBudget = plan?.total_budget || 0;
  const percentageFunded = totalBudget > 0 
    ? ((currentBalance / totalBudget) * 100) 
    : 0;
  const remainingToAdd = Math.max(0, totalBudget - currentBalance);
  const extraFunds = Math.max(0, currentBalance - totalBudget);

  // Calculate budget duration
  const budgetDuration = plan?.start_date && plan?.end_date 
    ? getBudgetDuration(plan.start_date, plan.end_date) 
    : null;

  // Get funding method
  const fundingMethod = plan?.funding_method || 'manual';

  // Get start action
  const startAction = plan?.metadata?.start_action || 'wallet';
  const payoutAccountLabel = plan?.metadata?.payout_account_label || plan?.payout_account_label;
  const payoutAccountBankName = plan?.metadata?.payout_account_bank_name || plan?.payout_account_bank_name;

  // Calculate next funding countdown for auto plans
  const getNextFundingCountdown = () => {
    if (fundingMethod !== 'auto' || !plan?.start_date || budgetStarted) return null;
    
    const startDate = new Date(plan.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    if (today < startDate) {
      const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
    }
    
    const payoutSchedule = (plan as any).payout_schedule || 'weekly';
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let cycleDays = 7;
    if (payoutSchedule === 'daily') cycleDays = 1;
    else if (payoutSchedule === 'biweekly') cycleDays = 14;
    else if (payoutSchedule === 'monthly') cycleDays = 30;
    
    const cyclesCompleted = Math.floor(daysSinceStart / cycleDays);
    const nextCycleDate = new Date(startDate);
    nextCycleDate.setDate(startDate.getDate() + (cyclesCompleted + 1) * cycleDays);
    
    const daysUntil = Math.ceil((nextCycleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
  };

  const nextFundingCountdown = getNextFundingCountdown();

  // Available to spend (only if start_action is wallet and budget has started)
  const availableToSpend = budgetStarted && startAction === 'wallet' ? currentBalance : 0;

  const pieChartData = useMemo(() => {
    return buckets.map(bucket => ({
      label: bucket.name,
      value: bucket.target_amount,
      color: CATEGORY_COLORS[bucket.name.toLowerCase()] || colors.primary,
    }));
  }, [buckets, colors.primary]);

  const barChartData = useMemo(() => {
    return buckets.map(bucket => ({
      label: bucket.name,
      allocated: bucket.target_amount,
      spent: bucket.amount_spent,
      color: CATEGORY_COLORS[bucket.name.toLowerCase()] || colors.primary,
    }));
  }, [buckets, colors.primary]);

  const maxBarValue = useMemo(() => {
    return Math.max(
      ...buckets.map(b => Math.max(b.target_amount, b.amount_spent)),
      plan?.total_budget || 0
    );
  }, [buckets, plan]);

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Not Found</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>
    );
  }

  const percentageUsed = plan.total_budget > 0 ? (plan.total_spent / plan.total_budget) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {plan.name}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Plan Name and Type Tag */}
        <View style={styles.planHeaderCard}>
          <View style={styles.planNameRow}>
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={[styles.planTypeTag, { backgroundColor: planTypeTag.color + '20' }]}>
              <Text style={[styles.planTypeTagText, { color: planTypeTag.color }]}>
                {planTypeTag.label}
              </Text>
            </View>
          </View>
          <View style={styles.statusTagContainer}>
            <View style={[styles.statusTag, { backgroundColor: statusTag.bgColor }]}>
              <Text style={[styles.statusTagText, { color: statusTag.textColor }]}>
                {statusTag.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Subcategories with Icons */}
        {subcategoryIcons.length > 0 && (
          <View style={styles.subcategoriesCard}>
            <Text style={styles.sectionLabel}>Categories</Text>
            <View style={styles.subcategoriesGrid}>
              {subcategoryIcons.map(({ bucket, Icon }, index) => (
                <View key={bucket.id} style={styles.subcategoryItem}>
                  <View style={styles.subcategoryIconContainer}>
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.subcategoryName} numberOfLines={1}>
                    {bucket.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Budget Amount */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Budget Amount</Text>
          <Text style={styles.infoValue}>{formatBalance(plan.total_budget)}</Text>
        </View>

        {/* Start Date - End Date */}
        {plan.start_date && plan.end_date && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Budget Period</Text>
            <Text style={styles.infoValue}>
              {formatDate(plan.start_date)} - {formatDate(plan.end_date)}
            </Text>
          </View>
        )}

        {/* Budget Duration */}
        {budgetDuration && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>
              {budgetDuration} {budgetDuration === 1 ? 'day' : 'days'}
            </Text>
          </View>
        )}

        {/* Funding Method */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Funding Method</Text>
          <Text style={styles.infoValue}>
            {fundingMethod === 'auto' ? 'Auto' : 'Manual'}
          </Text>
        </View>

        {/* Start Rule */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Plan Start Rule</Text>
          {startAction === 'wallet' ? (
            <View>
              <Text style={styles.infoValue}>Move to available balance</Text>
              {availableToSpend > 0 && (
                <Pressable 
                  style={styles.availableBalanceLink}
                  onPress={handleViewBalance}
                >
                  <Text style={styles.availableBalanceText}>
                    Available to spend: {formatBalance(availableToSpend)}
                  </Text>
                  <ArrowRight size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.infoValue}>Auto payout to bank</Text>
              {payoutAccountLabel && (
                <Text style={styles.payoutAccountText}>
                  {payoutAccountBankName} ••••{payoutAccountLabel.split('••••')[1] || ''}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Funding Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Funding Progress</Text>
            <Text style={styles.progressPercentage}>
              {Math.round(percentageFunded)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(Math.max(percentageFunded, 0), 100)}%`,
                  backgroundColor:
                    percentageFunded >= 100
                      ? '#22C55E'
                      : percentageFunded >= 75
                      ? '#10B981'
                      : percentageFunded >= 50
                      ? '#F59E0B'
                      : percentageFunded >= 25
                      ? '#F97316'
                      : '#EF4444',
                },
              ]}
            />
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              Funded: {formatBalance(currentBalance)} / {formatBalance(plan.total_budget)}
            </Text>
            {remainingToAdd > 0 && (
              <Text style={styles.remainingText}>
                {formatBalance(remainingToAdd)} remaining to add
              </Text>
            )}
            {extraFunds > 0 && (
              <Text style={styles.extraFundsText}>
                +{formatBalance(extraFunds)} extra funds
              </Text>
            )}
          </View>
        </View>

        {/* Next Funding Countdown (Auto plans) */}
        {nextFundingCountdown && (
          <View style={styles.countdownCard}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={styles.countdownText}>
              Next funding: {nextFundingCountdown}
            </Text>
          </View>
        )}

        {/* Available to Spend Balance (when applicable) */}
        {availableToSpend > 0 && (
          <View style={styles.availableBalanceCard}>
            <View style={styles.availableBalanceHeader}>
              <Text style={styles.availableBalanceLabel}>Available to Spend</Text>
              <Pressable onPress={handleViewBalance} style={styles.viewBalanceLink}>
                <Text style={styles.viewBalanceLinkText}>View Balance</Text>
                <ArrowRight size={16} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={styles.availableBalanceAmount}>
              {formatBalance(availableToSpend)}
            </Text>
            <View style={styles.availableBalanceActions}>
              <Pressable 
                style={styles.schedulePayoutButton}
                onPress={handleScheduleWithdrawal}
              >
                <Calendar size={16} color={colors.text} />
                <Text style={styles.schedulePayoutButtonText}>Schedule Payout</Text>
              </Pressable>
              <Pressable 
                style={styles.withdrawButton}
                onPress={handleWithdraw}
              >
                <ArrowRight size={16} color={colors.primary} />
                <Text style={styles.withdrawButtonText}>Withdraw</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsCard}>
          {/* Add Funds Button - Only for Manual plans */}
          {fundingMethod === 'manual' ? (
            <Pressable 
              style={styles.actionButton}
              onPress={handleFundPlan}
            >
              <CreditCard size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Add Funds</Text>
            </Pressable>
          ) : (
            <View style={styles.disabledActionButton}>
              <CreditCard size={20} color={colors.textTertiary} />
              <View style={styles.disabledActionButtonContent}>
                <Text style={styles.disabledActionButtonText}>Add Funds</Text>
                <Text style={styles.disabledActionButtonReason}>
                  Auto-funded plans are funded automatically
                </Text>
              </View>
            </View>
          )}

          {/* Adjust Budget Button */}
          <Pressable 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleAdjustBudget}
          >
            <Settings size={20} color={colors.text} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Adjust Budget
            </Text>
          </Pressable>

          {/* Close Budget Button */}
          <Pressable 
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleCloseBudget}
          >
            <X size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              Close Budget
            </Text>
          </Pressable>
        </View>

        {/* Activity Section */}
        {transactions.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <PlanActivity transactions={transactions} />
          </View>
        )}

        {/* Charts */}
        {buckets.length > 0 && (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Budget Distribution</Text>
              <PieChart data={pieChartData} total={plan.total_budget} />
            </View>

            <View style={styles.chartCard}>
              <BarChart data={barChartData} maxValue={maxBarValue} />
            </View>
          </>
        )}

        {/* Expense Buckets */}
        <View style={styles.bucketsSection}>
          <Text style={styles.sectionTitle}>Expense Buckets</Text>
          {buckets.length === 0 ? (
            <View style={styles.emptyBuckets}>
              <Text style={styles.emptyText}>No expense buckets yet</Text>
            </View>
          ) : (
            buckets.map(bucket => (
              <ExpenseBucketCard key={bucket.id} bucket={bucket} />
            ))
          )}
        </View>
      </ScrollView>
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    planHeaderCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 12,
    },
    planName: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    planTypeTag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    planTypeTagText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
    },
    statusTagContainer: {
      alignSelf: 'flex-start',
    },
    statusTag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusTagText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
    },
    subcategoriesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 12,
      fontWeight: '600',
    },
    subcategoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    subcategoryItem: {
      alignItems: 'center',
      minWidth: 80,
    },
    subcategoryIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    subcategoryName: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.text,
      textAlign: 'center',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 6,
    },
    infoValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    payoutAccountText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 4,
    },
    progressCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    progressPercentage: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressInfo: {
      gap: 4,
    },
    progressText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    remainingText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.primary,
    },
    extraFundsText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: '#22C55E',
    },
    countdownCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countdownText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    availableBalanceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    availableBalanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    availableBalanceLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    viewBalanceLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewBalanceLinkText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
    availableBalanceAmount: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 16,
    },
    availableBalanceActions: {
      flexDirection: 'row',
      gap: 12,
    },
    schedulePayoutButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    schedulePayoutButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    withdrawButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    withdrawButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    availableBalanceLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    availableBalanceText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
    actionsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
    },
    actionButtonDanger: {
      backgroundColor: '#EF4444' + '20',
      borderColor: '#EF4444',
    },
    actionButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    actionButtonTextSecondary: {
      color: colors.text,
    },
    actionButtonTextDanger: {
      color: '#EF4444',
    },
    disabledActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.6,
    },
    disabledActionButtonContent: {
      flex: 1,
    },
    disabledActionButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.textTertiary,
    },
    disabledActionButtonReason: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textTertiary,
      marginTop: 2,
    },
    activitySection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    bucketsSection: {
      marginBottom: 24,
    },
    emptyBuckets: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });



