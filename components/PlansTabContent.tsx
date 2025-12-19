import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, Platform } from 'react-native';
import { ArrowRight, Clock } from 'lucide-react-native';
import ExpensePlansSection from '@/components/ExpensePlansSection';
import ExpensePlanCard from '@/components/expense-planner/ExpensePlanCard';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';

type NextMaturingBudget = {
  plan: any;
  daysUntilStart: number | null;
  daysUntilEnd: number;
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
  
  const totalCreatedBudget = expensePlans?.reduce((sum, plan) => {
    const amount = plan?.total_budget || 0;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0) ?? 0;

  const fundedPercentage =
    totalCreatedBudget > 0 ? (expensePlansFundedBalance / totalCreatedBudget) * 100 : 0;

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
                 Funded {formatBalance(expensePlansFundedBalance)} / {formatBalance(totalCreatedBudget)} Total Budget
              </Text>
            </View>
          </View>
          <ArrowRight size={20} color={colors.textSecondary} />
        </View>
      </Pressable>

      {/* Ongoing Budgets Section */}
      {ongoingBudgets.length > 0 && (
        <>
          <View style={styles.ongoingSectionHeader}>
            <Text style={styles.ongoingSectionTitle}>Ongoing Budgets</Text>
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
            <View style={styles.upNextCardHeader}>
              <View style={styles.upNextHeaderContent}>
                <View style={styles.upNextLabelRow}>
                  <Text style={styles.upNextLabel}>Next budget</Text>
                  {(() => {
                    const totalBudget = nextMaturingBudget.plan.total_budget || 0;
                    const currentBalance = (nextMaturingBudget.plan as any).current_balance || 0;
                    const isReady = totalBudget > 0 && currentBalance >= totalBudget;

                    return (
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
                          {isReady ? 'Ready' : 'Not Ready'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <Text style={styles.upNextPlanName} numberOfLines={1}>
                  {nextMaturingBudget.plan.name}
                </Text>
                {/* {getNextMaturingBudgetCategoryIcons.length > 0 && (
                  <View style={styles.upNextCategoryIconsContainer}>
                    {getNextMaturingBudgetCategoryIcons.map(({ categoryId, Icon }, index) => (
                      <View
                        key={categoryId}
                        style={[
                          styles.upNextCategoryIconBadge,
                          index > 0 && styles.upNextStackedIcon,
                          { zIndex: index + 1 },
                        ]}
                      >
                        <Icon size={14} color={colors.primary} />
                      </View>
                    ))}
                  </View>
                )} */}
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </View>

            <View style={styles.upNextCardBody}>
              <View style={styles.upNextAmountRow}>
                <Text style={styles.upNextBudgetAmount}>{formatBalance(nextMaturingBudget.plan.total_budget)}</Text>
              </View>
              <View style={styles.upNextDaysBadge}>
                <Clock size={12} color={colors.primary} />
                <Text style={styles.upNextDaysText}>
                  {(() => {
                    if (!nextMaturingBudget.hasStarted && nextMaturingBudget.daysUntilStart !== null) {
                      if (nextMaturingBudget.daysUntilStart === 0) return 'Starts today';
                      if (nextMaturingBudget.daysUntilStart === 1) return 'Starts tomorrow';
                      return `Starts in ${nextMaturingBudget.daysUntilStart} days`;
                    }
                    if (nextMaturingBudget.daysUntilEnd === 0) return 'Ends today';
                    if (nextMaturingBudget.daysUntilEnd === 1) return 'Ends tomorrow';
                    return `Ends in ${nextMaturingBudget.daysUntilEnd} days`;
                  })()}
                </Text>
              </View>
            </View>
          </Pressable>
        </>
      )}

        <ExpensePlansSection onRequireAuth={onRequireAuth} />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
