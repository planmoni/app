import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { formatPayoutFrequency, formatPayoutDateTime } from '@/lib/formatters';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface PayoutPlansSectionProps {
  activePlans: any[];
  onShowNewPlanInfo?: () => void;
  onShowHowItWorks?: () => void;
}

function PayoutPlansSection({ activePlans, onShowNewPlanInfo, onShowHowItWorks }: PayoutPlansSectionProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { showBalances, balance, availableBalance } = useBalance();

  const formatBalance = useCallback((amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  }, [showBalances]);

  const handleViewPayout = useCallback((id: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id }
    });
    logAnalyticsEvent('view_payout', { payout_id: id });
  }, []);

  const handleViewAllPayouts = useCallback(() => {
    router.push('/all-payouts');
    logAnalyticsEvent('view_all_payouts');
  }, []);

  const handleCreatePayout = useCallback(() => {
    // Always show the new plan info modal for these buttons
    if (onShowNewPlanInfo) {
      onShowNewPlanInfo();
      logAnalyticsEvent('create_payout_click_modal');
    }
  }, [onShowNewPlanInfo]);

  const memoizedPlans = useMemo(() => {
    return activePlans.map((plan) => {
      const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
      const completedAmount = plan.completed_payouts * plan.payout_amount;
      const dayOfWeek = (plan as any).metadata?.dayOfWeek;
      const originalFrequency = (plan as any).metadata?.originalFrequency || plan.frequency;
      
      return {
        ...plan,
        progress,
        completedAmount,
        dayOfWeek,
        originalFrequency,
      };
    });
  }, [activePlans]);

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Payout Plans</Text>
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
          {memoizedPlans.map((plan) => (
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
                    {formatPayoutFrequency(plan.originalFrequency, plan.dayOfWeek)}
                  </Text>
                  <Text style={styles.planDot}>•</Text>
                  <Text style={styles.planValue}>{formatBalance(plan.payout_amount)}</Text>
                </View>
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
            ))}
          <Pressable 
            style={styles.addPayoutCard}
            onPress={handleCreatePayout}
          >
            <Plus size={24} color={colors.text} />
            <Text style={styles.addPayoutText}>Create New Payout</Text>
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
            <Text style={styles.createFirstPayoutText}>Create Your First Plan</Text>
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.text,
    fontWeight: '600',
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.textSecondary,
    maxWidth: '75%',
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 22 : 20, textSizeMultiplier),
    fontWeight: '700',
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  addPayoutDescription: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
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
    fontSize: getScaledFontSize(15, textSizeMultiplier),
    fontWeight: '400',
  },
});

export default React.memo(PayoutPlansSection); 