import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { formatPayoutFrequency, formatPayoutDateTime } from '@/lib/formatters';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { supabase } from '@/lib/supabase';

interface PayoutPlansSectionProps {
  activePlans: any[];
  onShowNewPlanInfo?: () => void;
  onShowHowItWorks?: () => void;
  onShowWelcomeModal?: () => void;
  isUserAuthenticated?: boolean;
}

function PayoutPlansSection({ activePlans, onShowNewPlanInfo, onShowHowItWorks, onShowWelcomeModal, isUserAuthenticated = true }: PayoutPlansSectionProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { showBalances } = useBalance();
  const [customDateAmounts, setCustomDateAmounts] = useState<Record<string, Record<string, number>>>({});

  // Fetch custom payout dates with amounts
  useEffect(() => {
    const fetchCustomAmounts = async () => {
      const customPlans = activePlans.filter(plan => plan.frequency === 'custom');
      if (customPlans.length === 0) return;

      try {
        const planIds = customPlans.map(plan => plan.id);
        const { data, error } = await supabase
          .from('custom_payout_dates')
          .select('payout_plan_id, payout_date, amount')
          .in('payout_plan_id', planIds)
          .order('payout_date', { ascending: true });

        if (error) throw error;

        const amountsByPlan: Record<string, Record<string, number>> = {};
        data?.forEach(item => {
          if (!amountsByPlan[item.payout_plan_id]) {
            amountsByPlan[item.payout_plan_id] = {};
          }
          amountsByPlan[item.payout_plan_id][item.payout_date] = parseFloat(item.amount?.toString() || '0') || 0;
        });

        setCustomDateAmounts(amountsByPlan);
      } catch (error) {
        console.error('Error fetching custom payout amounts:', error);
      }
    };

    fetchCustomAmounts();
  }, [activePlans]);

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
    if (onShowNewPlanInfo) {
      onShowNewPlanInfo();
      logAnalyticsEvent('create_payout_click_modal');
    }
  }, [onShowNewPlanInfo, onShowWelcomeModal, isUserAuthenticated]);

  const memoizedPlans = useMemo(() => {
    const plans = activePlans.map((plan) => {
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
        customAmounts: customDateAmounts[plan.id] || {},
        isPlan: true,
      };
    });

    // Add a placeholder for the "Add Payout" card
    return [...plans, { id: 'add-payout-placeholder', isAddCard: true }];
  }, [activePlans, customDateAmounts]);

  const styles = useMemo(() => createStyles(colors, isDark, textSizeMultiplier), [colors, isDark, textSizeMultiplier]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.isAddCard) {
      return (
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
      );
    }

    return (
      <Pressable
        style={styles.payoutPlanCard}
        onPress={() => handleViewPayout(item.id)}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planType}>{item.name}</Text>
          <View style={styles.activeTag}>
            <Text style={styles.activeTagText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.planAmount}>{formatBalance(item.total_amount)}</Text>
        <View style={styles.planDetails}>
          <Text style={styles.planFrequency}>
            {formatPayoutFrequency(item.originalFrequency, item.dayOfWeek)}
          </Text>
          {item.frequency === 'custom' && Object.keys(item.customAmounts || {}).length > 0 ? (
            <View style={styles.customAmountsContainer}>
              <Text style={styles.planDot}>•</Text>
              <Text style={styles.planValue}>Custom amounts</Text>
            </View>
          ) : (
            <>
              <Text style={styles.planDot}>•</Text>
              <Text style={styles.planValue}>{formatBalance(item.payout_amount)}</Text>
            </>
          )}
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
        </View>
        <View style={styles.planProgress}>
          <Text style={styles.progressText}>
            {formatBalance(item.completedAmount)}/{formatBalance(item.total_amount)}
          </Text>
          <Text style={styles.progressCount}>
            {item.completed_payouts}/{item.duration}
          </Text>
        </View>
        
        {item.next_payout_date && (
          <Text style={styles.nextPayoutDate}>
            Next Payday: {formatPayoutDateTime(item.next_payout_date)}
          </Text>
        )}
      </Pressable>
    );
  }, [styles, handleCreatePayout, handleViewPayout, colors.text, formatBalance]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Payout Plans</Text>
        <Pressable style={styles.viewAllButton} onPress={handleViewAllPayouts}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      
      {activePlans.length > 0 ? (
        <View style={{ height: Platform.OS === 'ios' ? 240 : 200, width: '100%' }}>
          <FlashList
            data={memoizedPlans}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            estimatedItemSize={316}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.payoutPlansList}
          />
        </View>
      ) : (
        <View style={styles.emptyPayoutsContainer}>
          <Text style={styles.emptyPayoutsText}>No scheduled payout plans</Text>
          <Pressable style={styles.createFirstPayoutButton} onPress={handleCreatePayout}>
            <Plus size={20} color={colors.text} />
            <Text style={styles.createFirstPayoutText}>Create Your Payout</Text>
          </Pressable>
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
  payoutPlansList: {
    paddingRight: 16,
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
    width: Platform.OS === 'ios' ? 300 : 280,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: Platform.OS === 'ios' ? 220 : 180,
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
  customAmountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default React.memo(PayoutPlansSection);
