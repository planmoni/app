import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { ArrowRight, Clock } from 'lucide-react-native';
import ExpensePlansSection from '@/components/ExpensePlansSection';

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

type PlansTabContentProps = {
  screenWidth: number;
  styles: any;
  colors: any;
  impact: () => void;
  router: any;
  formatBalance: (amount: number) => string;
  expensePlansBalance: number;
  expensePlans: any[];
  nextMaturingBudget: NextMaturingBudget | null;
  getNextMaturingBudgetCategoryIcons: CategoryIcon[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

export default function PlansTabContent({
  screenWidth,
  styles,
  colors,
  impact,
  router,
  formatBalance,
  expensePlansBalance,
  expensePlans,
  nextMaturingBudget,
  getNextMaturingBudgetCategoryIcons,
  isRefreshing = false,
  onRefresh,
}: PlansTabContentProps) {
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
          router.push('/spend');
        }}
      >
        <View style={styles.availableToSpendContent}>
          <View style={styles.availableToSpendInfo}>
            <Text style={styles.availableToSpendLabel}>Available to spend</Text>
            <Text style={styles.availableToSpendAmount}>{formatBalance(expensePlansBalance)}</Text>
            <View style={styles.availableToSpendSubtext}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.availableToSpendSubtextText}>
                {formatBalance(
                  expensePlans.reduce((sum, plan) => sum + ((plan as any).current_balance || 0), 0),
                )}{' '}
                Total in funded plans
              </Text>
            </View>
          </View>
          <ArrowRight size={20} color={colors.textSecondary} />
        </View>
      </Pressable>

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
                  <Text style={styles.upNextLabel}>Next maturing budget</Text>
                  {(() => {
                    const totalBudget = nextMaturingBudget.plan.total_budget || 0;
                    const totalLocked = nextMaturingBudget.plan.total_locked || 0;
                    const fundingPercentage = totalBudget > 0 ? (totalLocked / totalBudget) * 100 : 0;
                    const isReady = fundingPercentage >= 100;

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
                {getNextMaturingBudgetCategoryIcons.length > 0 && (
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
                )}
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

        <ExpensePlansSection />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
