import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Lock, Calendar, ArrowRight, Tag, Wallet, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import ExpenseBucketCard from '@/components/expense-planner/ExpenseBucketCard';
import PieChart from '@/components/expense-planner/PieChart';
import BarChart from '@/components/expense-planner/BarChart';
import ExpensePlanDetails from '@/components/expense-planner/ExpensePlanDetails';
import PlanProgress from '@/components/expense-planner/PlanProgress';
import PlanActivity from '@/components/expense-planner/PlanActivity';
import PlanHealthIndicator from '@/components/expense-planner/PlanHealthIndicator';
import PlanControls from '@/components/expense-planner/PlanControls';
import { ExpensePlan, ExpenseBucket } from '@/types/expense-planner';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useExpenseBuckets } from '@/hooks/useExpenseBuckets';
import { getCategoryIcon } from '@/lib/expenseCategories';
import { isBudgetStarted } from '@/lib/expensePlanUtils';
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
  const { expensePlans, fetchExpensePlans } = useExpensePlans();
  const { buckets, fetchBuckets } = useExpenseBuckets(id as string);

  const plan = expensePlans.find(p => p.id === id) || null;
  const currentBalance = (plan as any)?.current_balance || 0;
  const allowancePerDay = (plan as any)?.required_per_day || 0;
  const allowancePerWeek = Math.ceil((plan as any)?.required_per_day ? (plan as any).required_per_day * 7 : 0);

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
    
    // Prepare buckets data if available
    const bucketsData = buckets.length > 0 
      ? JSON.stringify(buckets.map(b => ({
          id: b.id,
          categoryId: b.category_id,
          subCategoryId: b.subcategory_id,
          name: b.name,
          targetAmount: b.target_amount.toString(),
        })))
      : undefined;
    
    // Navigate to fund-budget screen with plan details
    router.push({
      pathname: '/expense-planner/create/fund-budget',
      params: {
        planId: plan.id,
        totalBudget: plan.total_budget.toString(),
        budgetStructure: plan.budget_structure,
        startDate: plan.start_date || '',
        endDate: plan.end_date || '',
        ...(bucketsData && { buckets: bucketsData }),
      },
    });
  };

  const handlePayout = () => {
    haptics.mediumImpact();
    handleWithdraw();
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

  // Calculate plan information
  const hasLockedFunds = (plan?.total_locked || 0) > 0;
  const budgetStarted = plan ? isBudgetStarted(plan.start_date) : false;
  
  // Get status tag style
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

  // Get unique category icons (max 3)
  const getCategoryIcons = () => {
    if (!plan?.buckets || plan.buckets.length === 0) {
      return [];
    }

    const uniqueCategories = new Set<string>();
    const icons: Array<{ categoryId: string; Icon: any }> = [];

    for (const bucket of plan.buckets) {
      if (uniqueCategories.size >= 3) break;
      
      if (!uniqueCategories.has(bucket.category_id)) {
        const Icon = getCategoryIcon(bucket.category_id);
        if (Icon) {
          uniqueCategories.add(bucket.category_id);
          icons.push({ categoryId: bucket.category_id, Icon });
        }
      }
    }

    return icons;
  };

  const categoryIcons = getCategoryIcons();

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
        <View style={styles.allowanceCard}>
          <View style={styles.allowanceHeader}>
            <Text style={styles.allowanceTitle}>Available to spend</Text>
            <Text style={styles.allowanceValue}>₦{currentBalance.toLocaleString('en-US')}</Text>
          </View>
          <View style={styles.allowanceRow}>
            <Text style={styles.allowanceLabel}>Daily pace</Text>
            <Text style={styles.allowanceLabelValue}>₦{allowancePerDay.toLocaleString('en-US')}</Text>
          </View>
          <View style={styles.allowanceRow}>
            <Text style={styles.allowanceLabel}>Weekly pace</Text>
            <Text style={styles.allowanceLabelValue}>₦{allowancePerWeek.toLocaleString('en-US')}</Text>
          </View>
          <Text style={styles.allowanceNote}>
            Stay within this pace to keep other categories protected. If you spend faster, adjust this budget or shift dates.
          </Text>
        </View>
        <View style={styles.quickActions}>
          <Pressable style={[styles.quickActionButton, styles.logAction]} onPress={handleSpendFromPlan}>
            <Text style={styles.quickActionText}>Log spend</Text>
          </Pressable>
          <Pressable style={[styles.quickActionButton, styles.adjustAction]} onPress={handleAdjustBudget}>
            <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Adjust budget</Text>
          </Pressable>
        </View>

        {/* Progress Section */}
        <PlanProgress plan={plan} />

        {/* Activity Section */}
        <PlanActivity transactions={transactions} />

        {/* Health Indicator */}
        <PlanHealthIndicator
          planId={plan.id}
          healthStatus={(plan as any).health_status || planHealth?.status || 'on_track'}
          percentageBehind={planHealth?.percentage_behind || 0}
          recommendedAction={planHealth?.recommended_action}
          requiredAdjustment={planHealth?.required_adjustment}
        />

        {/* Controls */}
        <PlanControls
          planId={plan.id}
          isPaused={(plan as any).is_paused || false}
          isLocked={planWallet?.lock_type !== 'none'}
        />

        {/* Plan Details Card */}
        <ExpensePlanDetails plan={plan} buckets={buckets} />

        {/* Locked Funds Card */}
        {hasLockedFunds && (
          <View style={styles.lockedFundsCard}>
            <View style={styles.lockedFundsHeader}>
              <View style={styles.lockedFundsIconContainer}>
                <Lock size={20} color={colors.primary} />
              </View>
              <View style={styles.lockedFundsInfo}>
                <Text style={styles.lockedFundsTitle}>Locked Funds</Text>
                <Text style={styles.lockedFundsAmount}>
                  ₦{plan.total_locked?.toLocaleString() || '0'}
                </Text>
                <Text style={styles.lockedFundsSubtext}>
                  Funds are locked until the budget period starts
                </Text>
              </View>
            </View>
            {budgetStarted && (
              <View style={styles.withdrawalActions}>
                <Pressable 
                  style={styles.withdrawButton}
                  onPress={handleWithdraw}
                >
                  <Text style={styles.withdrawButtonText}>Withdraw Now</Text>
                  <ArrowRight size={16} color={colors.primary} />
                </Pressable>
                <Pressable 
                  style={styles.scheduleButton}
                  onPress={handleScheduleWithdrawal}
                >
                  <Calendar size={16} color={colors.text} />
                  <Text style={styles.scheduleButtonText}>Schedule</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

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

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          {(() => {
            const currentBalance = (plan as any).current_balance || 0;
            const hasBalance = currentBalance > 0;
            const isUnfunded = plan.funding_status === 'unfunded' || plan.funding_status === 'partially_funded';
            const isFunded = plan.funding_status === 'funded';
            const budgetStarted = isBudgetStarted(plan.start_date);

            // Show spend button if wallet has balance
            if (hasBalance && budgetStarted) {
              return (
                <Pressable 
                  onPress={handleSpendFromPlan} 
                  style={[styles.footerButton, styles.spendButton]}
                >
                  <ShoppingCart size={20} color="#fff" />
                  <Text style={styles.footerButtonText}>Spend from Plan</Text>
                </Pressable>
              );
            }

            // Show fund button if unfunded
            if (isUnfunded) {
              return (
                <Pressable 
                  onPress={handleFundPlan} 
                  style={[styles.footerButton, styles.fundButton]}
                >
                  <Wallet size={20} color="#fff" />
                  <Text style={styles.footerButtonText}>Fund Plan</Text>
                </Pressable>
              );
            }

            // Show payout or log expense
            if (isFunded && budgetStarted) {
              return (
                <>
                  <Pressable 
                    onPress={handlePayout} 
                    style={[styles.footerButton, styles.payoutButton]}
                  >
                    <ArrowRight size={20} color="#fff" />
                    <Text style={styles.footerButtonText}>Payout</Text>
                  </Pressable>
                  <Pressable 
                    onPress={handleLogExpense} 
                    style={[styles.footerButton, styles.logButton]}
                  >
                    <Plus size={20} color="#fff" />
                    <Text style={styles.footerButtonText}>Log Expense</Text>
                  </Pressable>
                </>
              );
            }

            // Default: Log expense
            return (
              <Pressable 
                onPress={handleLogExpense} 
                style={[styles.footerButton, styles.logButton]}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.footerButtonText}>Log Expense</Text>
              </Pressable>
            );
          })()}
        </View>
      </View>
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
    },
    allowanceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    allowanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    allowanceTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    allowanceValue: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    allowanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    allowanceLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    allowanceLabelValue: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    allowanceNote: {
      marginTop: 10,
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      lineHeight: 18,
      color: colors.textSecondary,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    quickActionButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    logAction: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    adjustAction: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },
    quickActionText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '700',
      color: '#fff',
    },
    quickActionTextSecondary: {
      color: colors.text,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerCardTop: {
      marginBottom: 12,
    },
    planNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 12,
    },
    planName: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    statusTag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusTagText: {
      fontSize: getScaledFontSize(11, textSizeMultiplier),
      fontWeight: '600',
    },
    categoryIconsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    categoryIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    budgetStructureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    budgetStructureText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      gap: 12,
    },
    summaryItem: {
      flex: 1,
    },
    summaryRight: {
      alignItems: 'flex-end',
    },
    summaryLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    overBudgetAmount: {
      color: '#EF4444',
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    progressPercentage: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
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
    sectionTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    emptyBuckets: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    footerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 20,
    },
    spendButton: {
      backgroundColor: '#22C55E',
    },
    fundButton: {
      backgroundColor: colors.primary,
    },
    payoutButton: {
      backgroundColor: '#F59E0B',
    },
    logButton: {
      backgroundColor: colors.primary,
    },
    footerButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: '#fff',
    },
    lockedFundsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lockedFundsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    lockedFundsIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    lockedFundsInfo: {
      flex: 1,
    },
    lockedFundsTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    lockedFundsAmount: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    lockedFundsSubtext: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
    },
    withdrawalActions: {
      flexDirection: 'row',
      gap: 12,
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
    scheduleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scheduleButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
  });

