import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Plus,
  Search,
  Clock,
  Wallet,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  History,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useBalance } from '@/contexts/BalanceContext';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { ExpensePlan } from '@/types/expense-planner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isBudgetStarted } from '@/lib/expensePlanUtils';

type FilterType = 'all' | 'active' | 'draft' | 'completed';

export default function PlansScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { width: screenWidth } = useWindowDimensions();
  const haptics = useHaptics();
  const { expensePlans, isLoading, fetchExpensePlans } = useExpensePlans();
  const { availableBalance } = useBalance();
  const { session } = useAuth();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [planTransactions, setPlanTransactions] = useState<any[]>([]);

  const isSmallScreen = screenWidth < 380;
  const styles = createStyles(colors, isDark, textSizeMultiplier, isSmallScreen);

  // Fetch plan transactions for history
  useEffect(() => {
    if (!session?.user?.id || expensePlans.length === 0) return;

    const fetchTransactions = async () => {
      try {
        const planIds = expensePlans.map(p => p.id);
        const { data, error } = await supabase
          .from('plan_transactions')
          .select('*')
          .in('plan_id', planIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setPlanTransactions(data);
        }
      } catch (error) {
        console.error('Error fetching plan transactions:', error);
      }
    };

    fetchTransactions();
  }, [session?.user?.id, expensePlans]);

  // Calculate expense plans balance (available to spend)
  const expensePlansAvailableBalance = useMemo(() => {
    return expensePlans.reduce((sum, plan) => {
      const currentBalance = (plan as any).current_balance || 0;
      const budgetStarted = isBudgetStarted(plan.start_date);
      // Only count balance if budget has started and start_action is 'wallet'
      if (budgetStarted && plan.metadata?.start_action === 'wallet') {
        return sum + currentBalance;
      }
      return sum;
    }, 0);
  }, [expensePlans]);

  // Calculate total funded budget amount
  const totalFundedBudget = useMemo(() => {
    return expensePlans.reduce((sum, plan) => {
      return sum + ((plan as any).current_balance || 0);
    }, 0);
  }, [expensePlans]);

  // Calculate statistics
  const stats = useMemo(() => {
    const active = expensePlans.filter(p => p.status === 'active').length;
    const draft = expensePlans.filter(p => p.status === 'draft').length;
    const totalBudget = expensePlans.reduce((sum, p) => sum + p.total_budget, 0);
    const totalSpent = expensePlans.reduce((sum, p) => sum + (p.total_spent || 0), 0);

    return {
      active,
      draft,
      totalBudget,
      totalSpent,
      totalPlans: expensePlans.length,
    };
  }, [expensePlans]);

  // Calculate budget health status
  const budgetHealth = useMemo(() => {
    const activePlans = expensePlans.filter(p => p.status === 'active' && !(p as any).is_paused);
    if (activePlans.length === 0) return null;

    const onTrack = activePlans.filter(p => {
      const health = (p as any).health_status || 'on_track';
      return health === 'on_track';
    }).length;

    const offTrack = activePlans.filter(p => {
      const health = (p as any).health_status || 'on_track';
      return health !== 'on_track';
    }).length;

    return {
      total: activePlans.length,
      onTrack,
      offTrack,
      percentage: activePlans.length > 0 ? Math.round((onTrack / activePlans.length) * 100) : 0,
    };
  }, [expensePlans]);

  // Find next maturing budget
  const nextMaturingBudget = useMemo(() => {
    const activePlans = expensePlans.filter(p => p.status === 'active' && p.end_date);
    if (activePlans.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingPlans = activePlans
      .map(plan => {
        const endDate = new Date(plan.end_date!);
        endDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { plan, daysUntil, endDate };
      })
      .filter(({ daysUntil }) => daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return upcomingPlans.length > 0 ? upcomingPlans[0] : null;
  }, [expensePlans]);

  // Find off-track plans (auto/daily funding but funds not added)
  const offTrackPlans = useMemo(() => {
    return expensePlans.filter(plan => {
      if (plan.status !== 'active' || (plan as any).is_paused) return false;
      const fundingMethod = plan.funding_method || 'manual';
      if (fundingMethod === 'manual') return false;
      
      const healthStatus = (plan as any).health_status || 'on_track';
      return healthStatus !== 'on_track';
    });
  }, [expensePlans]);

  // Filter and search plans
  const filteredPlans = useMemo(() => {
    let filtered = expensePlans;

    // Apply status filter
    if (activeFilter === 'active') {
      filtered = filtered.filter(p => p.status === 'active');
    } else if (activeFilter === 'draft') {
      filtered = filtered.filter(p => p.status === 'draft');
    } else if (activeFilter === 'completed') {
      filtered = filtered.filter(p => {
        if (p.status !== 'active') return false;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (!endDate) return false;
        return endDate < new Date();
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.total_budget.toString().includes(query)
      );
    }

    return filtered;
  }, [expensePlans, activeFilter, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchExpensePlans();
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing plans:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreatePlan = () => {
    haptics.mediumImpact();
    router.push('/expense-planner/create/plan-type');
  };

  const handleFilterChange = (filter: FilterType) => {
    haptics.selection();
    setActiveFilter(filter);
  };

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Plans</Text>
            <Text style={styles.headerSubtitle}>
              {stats.totalPlans} {stats.totalPlans === 1 ? 'plan' : 'plans'}
            </Text>
          </View>
          <Pressable onPress={handleCreatePlan} style={styles.createButton}>
            <Plus size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* Balance Summary Card - Updated to show Available to Spend and Total Funded */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>Available to Spend</Text>
              <Text style={styles.balanceAmount}>
                {formatBalance(expensePlansAvailableBalance)}
              </Text>
              <Text style={styles.balanceSubLabel}>
                Total Funded: {formatBalance(totalFundedBudget)}
              </Text>
            </View>
            <View style={styles.balanceIconContainer}>
              <Wallet size={24} color={colors.primary} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Budget Health Status */}
        {budgetHealth && budgetHealth.total > 0 && (
          <View style={styles.healthCard}>
            <View style={styles.healthHeader}>
              <Text style={styles.healthTitle}>Budget Health</Text>
              <View style={styles.healthBadge}>
                <Text style={styles.healthBadgeText}>{budgetHealth.percentage}%</Text>
              </View>
            </View>
            <View style={styles.healthStats}>
              <View style={styles.healthStat}>
                <CheckCircle size={16} color="#22C55E" />
                <Text style={styles.healthStatText}>
                  {budgetHealth.onTrack} On Track
                </Text>
              </View>
              {budgetHealth.offTrack > 0 && (
                <View style={styles.healthStat}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <Text style={styles.healthStatText}>
                    {budgetHealth.offTrack} Off Track
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Next Maturing Budget */}
        {nextMaturingBudget && (
          <Pressable
            style={styles.nextMaturingCard}
            onPress={() => {
              haptics.selection();
              router.push(`/expense-planner/${nextMaturingBudget.plan.id}`);
            }}
          >
            <View style={styles.nextMaturingHeader}>
              <View>
                <Text style={styles.nextMaturingLabel}>Next Maturing Budget</Text>
                <Text style={styles.nextMaturingName} numberOfLines={1}>
                  {nextMaturingBudget.plan.name}
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.nextMaturingInfo}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={styles.nextMaturingDate}>
                {formatDate(nextMaturingBudget.plan.end_date!)} • {nextMaturingBudget.daysUntil === 0 
                  ? 'Today' 
                  : nextMaturingBudget.daysUntil === 1 
                  ? 'Tomorrow' 
                  : `in ${nextMaturingBudget.daysUntil} days`}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Off Track Cards */}
        {offTrackPlans.length > 0 && (
          <View style={styles.offTrackSection}>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            {offTrackPlans.slice(0, 3).map(plan => (
              <Pressable
                key={plan.id}
                style={styles.offTrackCard}
                onPress={() => {
                  haptics.selection();
                  router.push(`/expense-planner/${plan.id}`);
                }}
              >
                <View style={styles.offTrackHeader}>
                  <AlertTriangle size={20} color="#F59E0B" />
                  <Text style={styles.offTrackName} numberOfLines={1}>
                    {plan.name}
                  </Text>
                </View>
                <Text style={styles.offTrackText}>
                  {plan.funding_method === 'auto' 
                    ? 'Auto funding is behind schedule' 
                    : 'Daily funding is behind schedule'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Expense Budget History */}
        {planTransactions.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <History size={20} color={colors.text} />
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
            <View style={styles.historyList}>
              {planTransactions.slice(0, 5).map((txn, index) => {
                const plan = expensePlans.find(p => p.id === txn.plan_id);
                const isTopup = txn.type === 'manual_topup' || txn.type === 'auto_allocation';
                const isWithdrawal = txn.type === 'withdrawal';
                const isSpending = txn.type === 'spending';

                return (
                  <View key={txn.id} style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <View style={[
                        styles.historyIcon,
                        isTopup && styles.historyIconTopup,
                        isWithdrawal && styles.historyIconWithdrawal,
                        isSpending && styles.historyIconSpending,
                      ]}>
                        {isTopup ? (
                          <TrendingUp size={16} color={isTopup ? '#22C55E' : colors.text} />
                        ) : isWithdrawal ? (
                          <ArrowRight size={16} color="#F59E0B" />
                        ) : (
                          <Wallet size={16} color={colors.textSecondary} />
                        )}
                      </View>
                      <View style={styles.historyItemInfo}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>
                          {plan?.name || 'Plan'}
                        </Text>
                        <Text style={styles.historyItemSubtitle}>
                          {isTopup ? 'Topup' : isWithdrawal ? 'Withdrawal' : 'Spending'} • {formatDate(txn.created_at)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.historyItemAmount,
                      isTopup && styles.historyItemAmountPositive,
                      isWithdrawal && styles.historyItemAmountNegative,
                    ]}>
                      {isTopup ? '+' : isWithdrawal || isSpending ? '-' : ''}
                      {formatBalance(txn.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
            {planTransactions.length > 5 && (
              <Pressable
                style={styles.viewAllHistory}
                onPress={() => {
                  haptics.selection();
                  // Navigate to full history page if exists
                  router.push('/transactions');
                }}
              >
                <Text style={styles.viewAllHistoryText}>View All Activity</Text>
                <ArrowRight size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* Statistics Cards */}
        {stats.totalPlans > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <TrendingUp size={20} color={colors.primary} />
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Calendar size={20} color={colors.textSecondary} />
              <Text style={styles.statValue}>{stats.draft}</Text>
              <Text style={styles.statLabel}>Draft</Text>
            </View>
            <View style={styles.statCard}>
              <Wallet size={20} color={colors.textSecondary} />
              <Text style={styles.statValue}>
                {formatBalance(stats.totalBudget)}
              </Text>
              <Text style={styles.statLabel}>Total Budget</Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search plans..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  haptics.lightImpact();
                  setSearchQuery('');
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabs}
          >
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'draft', label: 'Draft' },
                { key: 'completed', label: 'Completed' },
              ] as const
            ).map(filter => (
              <Pressable
                key={filter.key}
                onPress={() => handleFilterChange(filter.key as FilterType)}
                style={[
                  styles.filterTab,
                  activeFilter === filter.key && styles.filterTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === filter.key && styles.filterTabTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Plans List */}
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading plans...</Text>
          </View>
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyContainer}>
            {searchQuery || activeFilter !== 'all' ? (
              <>
                <Text style={styles.emptyTitle}>No plans found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'No plans match this filter'}
                </Text>
                <Pressable
                  onPress={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  style={styles.clearFiltersButton}
                >
                  <Text style={styles.clearFiltersText}>Clear Filters</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.emptyIconContainer}>
                  <Wallet size={48} color={colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No expense plans yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first plan to start managing your expenses and
                  stay on budget
                </Text>
                <Pressable
                  onPress={handleCreatePlan}
                  style={styles.createFirstButton}
                >
                  <Plus size={20} color={colors.primary} />
                  <Text style={styles.createFirstButtonText}>
                    Create Your First Plan
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.plansList}>
              {filteredPlans.map(plan => (
                <ExpensePlanCard
                  key={plan.id}
                  plan={plan}
                  onPress={() => {
                    haptics.selection();
                    router.push(`/expense-planner/${plan.id}`);
                  }}
                />
              ))}
            </View>
            <Pressable onPress={handleCreatePlan} style={styles.addPlanCard}>
              <Plus size={24} color={colors.primary} />
              <Text style={styles.addPlanText}>Create New Plan</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (
  colors: any,
  isDark: boolean,
  textSizeMultiplier: number,
  isSmallScreen: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 16,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: getScaledFontSize(isSmallScreen ? 28 : 32, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    createButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    balanceCard: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    balanceLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(isSmallScreen ? 28 : 32, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    balanceSubLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    balanceIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    healthCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    healthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    healthTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    healthBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    healthBadgeText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    healthStats: {
      flexDirection: 'row',
      gap: 16,
    },
    healthStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    healthStatText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    nextMaturingCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextMaturingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    nextMaturingLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    nextMaturingName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    nextMaturingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    nextMaturingDate: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    offTrackSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    offTrackCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#F59E0B' + '40',
      borderLeftWidth: 3,
      borderLeftColor: '#F59E0B',
    },
    offTrackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    offTrackName: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    offTrackText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    historySection: {
      marginBottom: 16,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    historyList: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    historyIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    historyIconTopup: {
      backgroundColor: '#22C55E' + '20',
    },
    historyIconWithdrawal: {
      backgroundColor: '#F59E0B' + '20',
    },
    historyIconSpending: {
      backgroundColor: colors.backgroundTertiary,
    },
    historyItemInfo: {
      flex: 1,
    },
    historyItemTitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    historyItemSubtitle: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    historyItemAmount: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    historyItemAmountPositive: {
      color: '#22C55E',
    },
    historyItemAmountNegative: {
      color: colors.text,
    },
    viewAllHistory: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 8,
    },
    viewAllHistoryText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    searchContainer: {
      marginBottom: 16,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
    },
    clearButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    clearButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
    filterContainer: {
      marginBottom: 16,
    },
    filterTabs: {
      gap: 8,
      paddingRight: 16,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterTabText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    plansList: {
      gap: 12,
      marginBottom: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      minHeight: 300,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 40,
      lineHeight: 20,
    },
    emptyText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
    },
    createFirstButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    createFirstButtonText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    clearFiltersButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearFiltersText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    addPlanCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addPlanText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
  });
