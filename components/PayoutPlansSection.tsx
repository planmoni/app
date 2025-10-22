import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { formatPayoutFrequency, formatPayoutDateTime } from '@/lib/formatters';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';

interface PayoutPlansSectionProps {
  activePlans: any[];
}

export default function PayoutPlansSection({ activePlans }: PayoutPlansSectionProps) {
  const { colors, isDark } = useTheme();
  const { showBalances } = useBalance();

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  };

  const handleViewPayout = (id: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id }
    });
    logAnalyticsEvent('view_payout', { payout_id: id });
  };

  const handleViewAllPayouts = () => {
    router.push('/all-payouts');
    logAnalyticsEvent('view_all_payouts');
  };

  const handleCreatePayout = () => {
    router.push('/create-payout/amount');
    logAnalyticsEvent('create_payout_click');
  };

  const styles = createStyles(colors, isDark);

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
          {activePlans.map((plan) => {
            const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
            const completedAmount = plan.completed_payouts * plan.payout_amount;
            
            // Get the day of week from metadata if available
            const dayOfWeek = (plan as any).metadata?.dayOfWeek;
            const originalFrequency = (plan as any).metadata?.originalFrequency || plan.frequency;
            
            return (
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
                    {formatPayoutFrequency(originalFrequency, dayOfWeek)}
                  </Text>
                  <Text style={styles.planDot}>•</Text>
                  <Text style={styles.planValue}>{formatBalance(plan.payout_amount)}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.planProgress}>
                  <Text style={styles.progressText}>
                    {formatBalance(completedAmount)}/{formatBalance(plan.total_amount)}
                  </Text>
                  <Text style={styles.progressCount}>
                    {plan.completed_payouts}/{plan.duration}
                  </Text>
                </View>
                
                {plan.next_payout_date && (
                  <Text style={styles.nextPayoutDate}>
                    Payday: {formatPayoutDateTime(plan.next_payout_date)}
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
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  planType: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
    maxWidth: '75%',
  },
  activeTag: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F8FCF4',
    paddingHorizontal: Platform.OS === 'ios' ? 10 : 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    borderRadius: Platform.OS === 'ios' ? 20 : 16,
  },
  activeTagText: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    color: '#22C55E',
    fontWeight: '600',
  },
  planAmount: {
    fontSize: Platform.OS === 'ios' ? 22 : 20,
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
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
  },
  planDot: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    color: colors.textSecondary,
  },
  planValue: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
  },
  nextPayoutDate: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  addPayoutDescription: {
    fontSize: 16,
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
    fontSize: 14,
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
    borderRadius: 100,
  },
  createFirstPayoutText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
}); 