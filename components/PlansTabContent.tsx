import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, Platform } from 'react-native';
import { ArrowRight, Clock, Vault } from 'lucide-react-native';
import ExpensePlansSection from '@/components/ExpensePlansSection';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { isBudgetStarted } from '@/lib/expensePlanUtils';

type NextMaturingBudget = {
  plan: any;
  daysUntilMaturity: number;
  hasStarted: boolean;
};

type CategoryIcon = {
  categoryId: string;
  Icon: any;
};

type OngoingBudget = {
  plan: any;
  daysUntilEnd: number | null;
};

type PlansTabContentProps = {
  screenWidth: number;
  styles: any;
  colors: any;
  impact: () => void;
  router: any;
  formatBalance: (amount: number) => string;
  expensePlansBalance: number;
  expensePlansFundedBalance?: number;
  expensePlans: any[];
  ongoingBudgets: OngoingBudget[];
  nextMaturingBudget: NextMaturingBudget | null;
  getNextMaturingBudgetCategoryIcons: CategoryIcon[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onRequireAuth?: () => boolean;
};

export default function PlansTabContent({
  screenWidth,
  styles,
  colors,
  impact,
  router,
  formatBalance,
  expensePlansBalance,
  expensePlansFundedBalance = 0,
  expensePlans,
  ongoingBudgets,
  nextMaturingBudget,
  getNextMaturingBudgetCategoryIcons,
  isRefreshing = false,
  onRefresh,
  onRequireAuth,
}: PlansTabContentProps) {
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  // Exclude started vaults that are already fully spent (balance <= 0),
  // and non-active plans, from summary totals.
  const plansForTotals = React.useMemo(() => {
    return (expensePlans ?? []).filter((plan) => {
      if (plan?.status && plan.status !== 'active') return false;
      const currentBalance = (plan as any)?.current_balance || 0;
      const started = isBudgetStarted(plan?.start_date);
      if (started && currentBalance <= 0) return false;
      return true;
    });
  }, [expensePlans]);

  const totalCreatedBudget = plansForTotals.reduce((sum, plan) => {
    const amount = plan?.total_budget || 0;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);

  const fundedBalanceForTotals = plansForTotals.reduce((sum, plan) => {
    const currentBalance = (plan as any)?.current_balance || 0;
    return sum + (typeof currentBalance === 'number' ? currentBalance : 0);
  }, 0);

  const fundedPercentage =
    totalCreatedBudget > 0 ? (fundedBalanceForTotals / totalCreatedBudget) * 100 : 0;

  const handleViewAllOngoing = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    haptics.selection();
    router.push('/spend');
  };

  return (
    <View style={[styles.tabPage, { width: screenWidth }]}>
      <ScrollView
        style={styles.tabScrollView}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
      <Pressable
        style={styles.availableToSpendCard}
        onPress={() => {
          impact();
          if (onRequireAuth && !onRequireAuth()) return;
          router.push('/spend');
        }}
      >
        <View style={styles.availableToSpendWatermark} pointerEvents="none">
          <Vault size={110} color="#1E3A8A" strokeWidth={1.5} />
        </View>
        <View style={styles.availableToSpendContent}>
          <View style={styles.availableToSpendInfo}>
            <Text style={styles.availableToSpendLabel}>Available to spend</Text>
            <Text style={styles.availableToSpendAmount}>{formatBalance(expensePlansBalance)}</Text>
           
            <View style={styles.availableToSpendProgress}>
              <View style={styles.availableToSpendProgressTrack}>
                <View
                  style={[
                    styles.availableToSpendProgressFill,
                    { width: `${Math.min(Math.max(fundedPercentage, 0), 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.availableToSpendProgressText}>
                 Funded {formatBalance(fundedBalanceForTotals)} / {formatBalance(totalCreatedBudget)} of Total Plans
              </Text>
            </View>
          </View>
          <ArrowRight size={20} color="#1E3A8A" />
        </View>
      </Pressable>

      {/* Ongoing Budgets Section */}
      {ongoingBudgets.length > 0 && (
        <>
          <View style={styles.ongoingSectionHeader}>
            <Text style={styles.ongoingSectionTitle}>Active</Text>
            {ongoingBudgets.length > 1 && (
              <Pressable onPress={handleViewAllOngoing} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View all</Text>
              </Pressable>
            )}
          </View>
          {ongoingBudgets.length === 1 ? (
            <Pressable
              style={styles.ongoingSingleCard}
              onPress={() => {
                if (onRequireAuth && !onRequireAuth()) return;
                impact();
                router.push(`/expense-planner/${ongoingBudgets[0].plan.id}`);
              }}
            >
              <ExpensePlanCard
                plan={ongoingBudgets[0].plan}
                onPress={() => {
                  if (onRequireAuth && !onRequireAuth()) return;
                  haptics.selection();
                  router.push(`/expense-planner/${ongoingBudgets[0].plan.id}`);
                }}
              />
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ongoingCarouselContainer}
            >
              {ongoingBudgets.map(({ plan }) => (
                <View key={plan.id} style={styles.ongoingCardWrapper}>
                  <ExpensePlanCard
                    plan={plan}
                    onPress={() => {
                      if (onRequireAuth && !onRequireAuth()) return;
                      haptics.selection();
                      router.push(`/expense-planner/${plan.id}`);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {nextMaturingBudget && (
        <>
          <View style={styles.upNextSectionHeader}>
            <Text style={styles.upNextSectionTitle}>Up next</Text>
          </View>
          <Pressable
            style={styles.upNextCard}
            onPress={() => {
              impact();
              router.push(`/expense-planner/${nextMaturingBudget.plan.id}`);
            }}
          >
            {(() => {
              const totalBudget = nextMaturingBudget.plan.total_budget || 0;
              const currentBalance = (nextMaturingBudget.plan as any).current_balance || 0;
              const isReady = totalBudget > 0 && currentBalance >= totalBudget;
              const maturityLabel = !nextMaturingBudget.hasStarted
                ? nextMaturingBudget.daysUntilMaturity === 0
                  ? 'Matures today'
                  : nextMaturingBudget.daysUntilMaturity === 1
                    ? 'Matures tomorrow'
                    : `Matures in ${nextMaturingBudget.daysUntilMaturity} days`
                : 'Matured';

              return (
                <>
                  <View style={styles.upNextLabelRow}>
                    <Text style={styles.upNextPlanName} numberOfLines={1}>
                      {nextMaturingBudget.plan.name}
                    </Text>
                    <View
                      style={[
                        styles.upNextReadyTag,
                        isReady ? styles.upNextReadyTagReady : styles.upNextReadyTagNotReady,
                      ]}
                    >
                      <Text
                        style={[
                          styles.upNextReadyTagText,
                          isReady ? styles.upNextReadyTagTextReady : styles.upNextReadyTagTextNotReady,
                        ]}
                      >
                        {isReady ? 'Ready' : 'Not ready'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.upNextBudgetAmount}>{formatBalance(totalBudget)}</Text>
                  <View style={styles.upNextMetaRow}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={styles.upNextDaysText}>{maturityLabel}</Text>
                    <ArrowRight size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                  </View>
                </>
              );
            })()}
          </Pressable>
        </>
      )}

        <ExpensePlansSection onRequireAuth={onRequireAuth} />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
