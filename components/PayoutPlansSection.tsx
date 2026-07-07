import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import SkeletonBox from '@/components/SkeletonBox';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { formatPayoutFrequency, formatPayoutDateTime, formatDisplayDate } from '@/lib/formatters';
import { getPurposeLabel } from '@/lib/payout-purposes';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { calculatePlanCompletedAmount } from '@/lib/custom-payout-amounts';

interface PayoutPlansSectionProps {
  activePlans: any[];
  isLoading?: boolean;
  customDateAmounts?: Record<string, Record<string, number>>;
  onShowAddByCodeModal?: () => void;
  onShowNewPlanInfo?: () => void;
  onShowHowItWorks?: () => void;
  onShowWelcomeModal?: () => void;
  isUserAuthenticated?: boolean;
}

function PayoutPlansSection({ activePlans, isLoading = false, customDateAmounts = {}, onShowAddByCodeModal, onShowNewPlanInfo, onShowHowItWorks, onShowWelcomeModal, isUserAuthenticated = true }: PayoutPlansSectionProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { showBalances, balance, availableBalance } = useBalance();

  const formatBalance = useCallback((amount: number) => {
    return showBalances ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '*********';
  }, [showBalances]);

  const handleViewPayout = useCallback((id: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id }
    });
    logAnalyticsEvent('view_payout', { payout_id: id });
  }, []);

  const handleViewAllPayouts = useCallback(() => {
    if (!isUserAuthenticated && onShowWelcomeModal) {
      onShowWelcomeModal();
      return;
    }
    router.push('/all-payouts');
    logAnalyticsEvent('view_all_payouts');
  }, [isUserAuthenticated, onShowWelcomeModal]);

  const handleCreatePayout = useCallback(() => {
    if (!isUserAuthenticated && onShowWelcomeModal) {
      onShowWelcomeModal();
      logAnalyticsEvent('create_payout_click_modal');
      return;
    }
    if (onShowAddByCodeModal) {
      onShowAddByCodeModal();
      logAnalyticsEvent('create_payout_click_modal');
    } else if (onShowNewPlanInfo) {
      onShowNewPlanInfo();
      logAnalyticsEvent('create_payout_click_modal');
    }
  }, [onShowAddByCodeModal, onShowNewPlanInfo, onShowWelcomeModal, isUserAuthenticated]);

  const memoizedPlans = useMemo(() => {
    return activePlans.map((plan) => {
      const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
      
      const completedAmount = calculatePlanCompletedAmount(
        plan.frequency,
        plan.completed_payouts,
        plan.payout_amount,
        plan.frequency === 'custom' ? customDateAmounts[plan.id] : undefined
      );
      
      const dayOfWeek = (plan as any).metadata?.dayOfWeek;
      const originalFrequency = (plan as any).metadata?.originalFrequency || plan.frequency;
      
      return {
        ...plan,
        progress,
        completedAmount,
        dayOfWeek,
        originalFrequency,
        customAmounts: customDateAmounts[plan.id] || {},
      };
    });
  }, [activePlans, customDateAmounts]);

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Payout Plans</Text>
        <Pressable style={styles.viewAllButton} onPress={handleViewAllPayouts}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      
      {isLoading && activePlans.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.payoutPlansContainer}
          scrollEnabled={false}
        >
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[
                styles.payoutPlanCard,
                { gap: 10 },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBox width="55%" height={13} borderRadius={6} />
                <SkeletonBox width={56} height={24} borderRadius={12} />
              </View>
              <SkeletonBox width="70%" height={Platform.OS === 'ios' ? 20 : 17} borderRadius={6} />
              <SkeletonBox width="50%" height={13} borderRadius={6} />
              <SkeletonBox width="100%" height={Platform.OS === 'ios' ? 6 : 4} borderRadius={3} style={{ marginTop: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <SkeletonBox width="40%" height={12} borderRadius={6} />
                <SkeletonBox width="20%" height={12} borderRadius={6} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : activePlans.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.payoutPlansContainer}
        >
          {memoizedPlans.map((plan) => {
              const purposeLabel = plan.purpose
                ? getPurposeLabel(plan.purpose, plan.purpose_other_text)
                : null;
              const nameIsDefault =
                purposeLabel &&
                (plan.name === purposeLabel || / Payout Plan$/.test(plan.name));
              const displayTitle = nameIsDefault ? purposeLabel : plan.name;
              return (
              <Pressable
                key={plan.id}
                style={styles.payoutPlanCard}
                onPress={() => handleViewPayout(plan.id)}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planType} numberOfLines={1}>{displayTitle}</Text>
                  <View style={styles.planHeaderTags}>
                    {plan.is_paired && (
                      <View style={[styles.sharedTag, { backgroundColor: isDark ? colors.accent : colors.backgroundTertiary }]}>
                        <Text style={[styles.sharedTagText, { color: colors.primary }]}>Shared</Text>
                      </View>
                    )}
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.planAmount}>{formatBalance(plan.total_amount)}</Text>
                <View style={styles.planDetails}>
                  <Text style={styles.planFrequency}>
                    {formatPayoutFrequency(plan.originalFrequency, plan.dayOfWeek)}
                  </Text>
                  {plan.frequency === 'custom' && Object.keys(plan.customAmounts || {}).length > 0 ? (
                    <View style={styles.customAmountsContainer}>
                      <Text style={styles.planDot}>•</Text>
                      <Text style={styles.planValue}>Custom amounts</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.planDot}>•</Text>
                      <Text style={styles.planValue}>{formatBalance(plan.payout_amount)}</Text>
                    </>
                  )}
                </View>
                {plan.frequency === 'custom' && Object.keys(plan.customAmounts || {}).length > 0 && (
                  <View style={styles.customAmountsList}>
                    {/* {Object.entries(plan.customAmounts)
                      .slice(0, 3)
                      .map(([date, amount]) => (
                        <Text key={date} style={styles.customAmountItem}>
                          {formatDisplayDate(date)}: {formatBalance(amount)}
                        </Text>
                      ))} */}
                    {Object.keys(plan.customAmounts).length > 3 && (
                      <Text style={styles.customAmountMore}>
                        +{Object.keys(plan.customAmounts).length - 3} more
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${plan.progress}%` }]} />
                </View>
                <View style={styles.planProgress}>
                  <Text style={styles.progressText}>
                    {formatBalance(plan.completedAmount)}/{formatBalance(plan.total_amount)}
                  </Text>
                  <Text style={styles.progressCount}>
                    {plan.completed_payouts}/{plan.duration}
                  </Text>
                </View>
                
                {plan.next_payout_date && (
                  <Text style={styles.nextPayoutDate}>
                    Next Payday: {formatPayoutDateTime(plan.next_payout_date)}
                  </Text>
                )}
              </Pressable>
            );
            })}
          <Pressable 
            style={styles.addPayoutCard}
            onPress={handleCreatePayout}
          >
            <Plus size={24} color={colors.text} />
            <Text style={styles.addPayoutText}>Add Payout</Text>
            <Text style={styles.addPayoutDescription}>
              Set up a new automated payout plan
            </Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.emptyPayoutsContainer}>
          <Text style={styles.emptyPayoutsText}>No scheduled payout plans</Text>
          <Pressable style={styles.createFirstPayoutButton} onPress={handleCreatePayout}>
            <Plus size={20} color={colors.text} />
            <Text style={styles.createFirstPayoutText}>Add or create a Payout Plan</Text>
          </Pressable>
          {/* {!isAuthenticated && onShowHowItWorks && (
            <Pressable 
              style={[styles.howItWorksButton, { borderColor: colors.primary }]} 
              onPress={onShowHowItWorks}
            >
              <Text style={[styles.howItWorksButtonText, { color: colors.text }]}>How it works?</Text>
            </Pressable>
          )} */}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  sectionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.text,
    fontWeight: '500',
  },
  payoutPlansContainer: {
    paddingRight: 1,
  },
  payoutPlanCard: {
    width: Platform.OS === 'ios' ? 300 : 280,
    marginRight: Platform.OS === 'ios' ? 16 : 10,
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 15 : 10,
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  planType: {
    flex: 1,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    maxWidth: '75%',
  },
  planHeaderTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sharedTag: {
    paddingHorizontal: Platform.OS === 'ios' ? 8 : 6,
    paddingVertical: Platform.OS === 'ios' ? 4 : 3,
    borderRadius: Platform.OS === 'ios' ? 14 : 12,
  },
  sharedTagText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 10 : 9, textSizeMultiplier),
    fontWeight: '600',
  },
  activeTag: {
    backgroundColor: isDark ? colors.accent : colors.accent,
    paddingHorizontal: Platform.OS === 'ios' ? 10 : 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    borderRadius: Platform.OS === 'ios' ? 20 : 16,
  },
  activeTagText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.primary,
    fontWeight: '600',
  },
  planAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  planDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  planFrequency: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
  },
  planDot: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
  },
  planValue: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
  },
  progressBar: {
    height: Platform.OS === 'ios' ? 6 : 4 ,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  planProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
  },
  nextPayoutDate: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  addPayoutDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    textAlign: 'center',
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 10,
  },
  createFirstPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 55,
    borderRadius: 20,
  },
  createFirstPayoutText: {
    color: colors.text,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '600',
  },
  howItWorksButton: {
    marginTop: 5,
    paddingHorizontal: 60,
    paddingVertical: 3,
    backgroundColor: 'transparent',
    borderRadius: 13,
  },
  howItWorksButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '400',
  },
  customAmountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customAmountsList: {
    marginTop: 8,
    gap: 4,
  },
  customAmountItem: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
  },
  customAmountMore: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default React.memo(PayoutPlansSection); 