import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
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
import PlanDetailsInfo from '@/components/expense-planner/PlanDetailsInfo';
import { ExpensePlan, ExpenseBucket } from '@/types/expense-planner';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';
import { isBudgetStarted, formatDateRange } from '@/lib/expensePlanUtils';
import { supabase } from '@/lib/supabase';

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

  // Refresh plan data when screen comes into focus (e.g., after funding)
  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchExpensePlans();
        fetchBuckets();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  // Check if plan should be deleted (unfunded and started)
  useEffect(() => {
    if (!plan || !id) return;
    
    // Check if budget has started and is unfunded (not draft)
    if (budgetStarted && currentBalance === 0 && plan.status !== 'draft') {
      const deleteUnfundedPlan = async () => {
        try {
          await deleteExpensePlan(id as string);
          haptics.notification();
          // Redirect to home after deletion
          router.replace('/(tabs)');
        } catch (error) {
          console.error('Error deleting unfunded plan:', error);
        }
      };
      
      deleteUnfundedPlan();
    }
  }, [plan, budgetStarted, currentBalance, id, deleteExpensePlan]);

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

  const handleSpend = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/spend/[planId]',
      params: { planId: id as string },
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
        currentBalance: currentBalance.toString(),
      },
    });
  };

  const handleWithdraw = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/[id]/withdraw-amount',
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
        return { label: 'Active', color: colors.text };
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
        return { bgColor: colors.backgroundTertiary, textColor: colors.textSecondary, label: 'Unfunded' };
      case 'partially_funded':
        return { bgColor: '#E2E8F0', textColor: '#64748B', label: 'Partially Funded' };
      case 'funded':
        return { bgColor: colors.accent, textColor: colors.primary, label: 'Funded' };
      default:
        return { bgColor: colors.backgroundTertiary, textColor: colors.textSecondary, label: 'Active' };
    }
  };

  const statusTag = getStatusTagStyle();

  // Get funding method (needed for action buttons)
  const fundingMethod = plan?.funding_method || 'manual';
  const totalBudget = plan?.total_budget || 0;

  // Get start action (needed for available to spend)
  const startAction = plan?.metadata?.start_action || plan?.start_action || 'wallet';
  
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

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Vault Not Found</Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.closeButton}
            hitSlop={8}
          >
            <X size={20} color={colors.text} />
          </Pressable>
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
        <Text style={styles.headerTitle} numberOfLines={1}> Vault
        </Text>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.closeButton}
          hitSlop={8}
        >
          <X size={20} color={colors.text} />
        </Pressable>
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
        

        {/* Available to Spend Balance (when applicable) */}
        {availableToSpend > 0 && (
          <View style={styles.availableBalanceCard}>
            <View style={styles.availableBalanceHeader}>
              <Text style={styles.availableBalanceLabel}>Available to Spend</Text>
            </View>
            <Text style={styles.availableBalanceAmount}>
              {formatBalance(availableToSpend)}
            </Text>
            {/* <View style={styles.availableBalanceActions}>
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
            </View> */}
          </View>
        )}
        

        {/* Plan Details Info */}
        <PlanDetailsInfo 
          plan={plan} 
          currentBalance={currentBalance}
          onViewBalance={availableToSpend > 0 ? handleViewBalance : undefined}
          onSpend={handleSpend}
          onFundPlan={handleFundPlan}
          onAdjustBudget={handleAdjustBudget}
          budgetStarted={budgetStarted}
          totalBudget={totalBudget}
        />
        

        {/* Activity Section */}
          <View style={styles.activitySection}>
            <PlanActivity transactions={transactions} />
          </View>

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
        {/* <View style={styles.bucketsSection}>
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
        </View> */}
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
    closeButton: {
      padding: 8,
      marginRight: -8,
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



