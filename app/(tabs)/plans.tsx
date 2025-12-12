import React, { useState, useMemo } from 'react';
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
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useBalance } from '@/contexts/BalanceContext';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import DailySpendGuidance from '@/components/DailySpendGuidance';
import { ExpensePlan } from '@/types/expense-planner';

type FilterType = 'all' | 'active' | 'draft' | 'completed';

export default function PlansScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { width: screenWidth } = useWindowDimensions();
  const haptics = useHaptics();
  const { expensePlans, isLoading, fetchExpensePlans } = useExpensePlans();
  const { availableBalance } = useBalance();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const isSmallScreen = screenWidth < 380;
  const styles = createStyles(colors, isDark, textSizeMultiplier, isSmallScreen);

  // Calculate expense plans balance
  const expensePlansBalance = useMemo(() => {
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

        {/* Balance Summary Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Expense Plans Balance</Text>
              <Text style={styles.balanceAmount}>
                {formatBalance(expensePlansBalance)}
              </Text>
            </View>
            <View style={styles.balanceIconContainer}>
              <Wallet size={24} color={colors.primary} />
            </View>
          </View>
          <View style={styles.balanceInfo}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={styles.balanceInfoText}>
              {formatBalance(expensePlansBalance)} locked in plans
            </Text>
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

        {/* Daily Spend Guidance */}
        <DailySpendGuidance />

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
      alignItems: 'center',
      marginBottom: 12,
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
    },
    balanceIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    balanceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    balanceInfoText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
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

