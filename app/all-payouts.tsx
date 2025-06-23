import Card from '@/components/Card';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import { router } from 'expo-router';
import { ArrowLeft, Calendar, ChevronRight, Clock, Plus, Pause, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useBalance } from '@/contexts/BalanceContext';
import { formatPayoutFrequency, getDayOfWeekName } from '@/lib/formatters';

export default function AllPayoutsScreen() {
  const { colors } = useTheme();
  const { payoutPlans, isLoading, pausePlan, resumePlan } = useRealtimePayoutPlans();
  const { showBalances } = useBalance();

  const handleCreatePayout = () => {
    router.push('/create-payout/amount');
  };

  const handleViewPayout = (planId: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id: planId }
    });
  };

  const handlePausePlan = async (planId: string, planName: string) => {
    Alert.alert(
      'Pause Payout Plan',
      `Are you sure you want to pause "${planName}"? You can resume it anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          style: 'destructive',
          onPress: async () => {
            try {
              await pausePlan(planId);
            } catch (error) {
              Alert.alert('Error', 'Failed to pause payout plan');
            }
          }
        }
      ]
    );
  };

  const handleResumePlan = async (planId: string) => {
    try {
      await resumePlan(planId);
    } catch (error) {
      Alert.alert('Error', 'Failed to resume payout plan');
    }
  };

  const formatCurrency = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '••••••••';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#DCFCE7', text: '#22C55E' };
      case 'paused':
        return { bg: '#FEE2E2', text: '#EF4444' };
      case 'completed':
        return { bg: '#EFF6FF', text: '#1E3A8A' };
      case 'cancelled':
        return { bg: '#F1F5F9', text: '#64748B' };
      default:
        return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const calculateProgress = (plan: any) => {
    return Math.round((plan.completed_payouts / plan.duration) * 100);
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Your Payouts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="large" />
          <Text style={styles.loadingText}>Loading your payout plans...</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Payouts</Text>
        <Pressable style={styles.createButton} onPress={handleCreatePayout}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {payoutPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Payout Plans Yet</Text>
            <Text style={styles.emptyDescription}>
              Create your first payout plan to start automating your financial goals
            </Text>
            <Pressable style={styles.createFirstButton} onPress={handleCreatePayout}>
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.createFirstButtonText}>Create Your First Plan</Text>
            </Pressable>
          </View>
        ) : (
          payoutPlans.map((plan) => {
            const statusColors = getStatusColor(plan.status);
            const progress = calculateProgress(plan);
            
            // Get the day of week from metadata if available
            const dayOfWeek = plan.metadata?.dayOfWeek;
            const originalFrequency = plan.metadata?.originalFrequency || plan.frequency;
            
            return (
              <Pressable 
                key={plan.id} 
                style={styles.payoutCard}
                onPress={() => handleViewPayout(plan.id)}
              >
                <View style={styles.payoutContent}>
                  <View style={styles.payoutHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <View style={[styles.statusTag, { backgroundColor: statusColors.bg }]}>
                        <Text style={[styles.statusText, { color: statusColors.text }]}>
                          {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.planActions}>
                      {plan.status === 'active' ? (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handlePausePlan(plan.id, plan.name)}
                        >
                          <Pause size={16} color="#EF4444" />
                        </Pressable>
                      ) : plan.status === 'paused' ? (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleResumePlan(plan.id)}
                        >
                          <Play size={16} color="#22C55E" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.amount}>{formatCurrency(plan.total_amount)}</Text>

                  <View style={styles.detailsRow}>
                    <View style={styles.detail}>
                      <Calendar size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        {formatPayoutFrequency(originalFrequency, dayOfWeek)}
                      </Text>
                    </View>
                    <View style={styles.detail}>
                      <Clock size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        {formatCurrency(plan.payout_amount)} per payout
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>

                  <View style={styles.progressDetails}>
                    <Text style={styles.progressText}>
                      {formatCurrency(plan.completed_payouts * plan.payout_amount)}/{formatCurrency(plan.total_amount)}
                    </Text>
                    <Text style={styles.progressCount}>
                      {plan.completed_payouts}/{plan.duration}
                    </Text>
                  </View>

                  <View style={styles.footer}>
                    <Text style={styles.nextPayout}>
                      {plan.next_payout_date 
                        ? `Next payout: ${new Date(plan.next_payout_date).toLocaleDateString()}`
                        : plan.status === 'completed' 
                          ? 'Plan completed'
                          : 'Plan paused'
                      }
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  createButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  emptyDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  payoutCard: {
    padding: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutContent: {
    padding: 20,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
    gap: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextPayout: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '500',
  },
});