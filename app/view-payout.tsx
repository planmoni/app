import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, Calendar, Clock, Wallet, Building2, TriangleAlert as AlertTriangle, PencilLine, Pause, Play } from 'lucide-react-native';
import Button from '@/components/Button';
import Card from '@/components/Card';
import HorizontalLoader from '@/components/HorizontalLoader';
import SafeFooter from '@/components/SafeFooter';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useBalance } from '@/contexts/BalanceContext';

export default function ViewPayoutScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { id } = useLocalSearchParams();
  const { payoutPlans, isLoading, pausePlan, resumePlan } = useRealtimePayoutPlans();
  const { showBalances } = useBalance();
  
  const [isEditing, setIsEditing] = useState(false);
  const [payoutName, setPayoutName] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');

  const plan = payoutPlans.find(p => p.id === id);

  useEffect(() => {
    if (plan) {
      setPayoutName(plan.name);
      setPayoutDescription(plan.description || '');
    }
  }, [plan]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payout Details</Text>
        </View>
        <HorizontalLoader />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payout details...</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payout Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Payout plan not found</Text>
          <Button 
            title="Go Back" 
            onPress={() => router.back()} 
            style={styles.errorButton}
          />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  const handleSave = () => {
    setIsEditing(false);
    // TODO: Implement update functionality
  };

  const handlePauseResume = async () => {
    try {
      if (plan.status === 'active') {
        Alert.alert(
          'Pause Payout Plan',
          `Are you sure you want to pause "${plan.name}"? You can resume it anytime.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Pause',
              style: 'destructive',
              onPress: async () => {
                await pausePlan(plan.id);
              }
            }
          ]
        );
      } else if (plan.status === 'paused') {
        await resumePlan(plan.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update payout plan');
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
        return { bg: '#EFF6FF', text: '#3B82F6' };
      case 'cancelled':
        return { bg: '#F1F5F9', text: '#64748B' };
      default:
        return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const calculateProgress = () => {
    return Math.round((plan.completed_payouts / plan.duration) * 100);
  };

  const statusColors = getStatusColor(plan.status);
  const progress = calculateProgress();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payout Details</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.payoutNameContainer}>
          <View style={styles.payoutNameHeader}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={payoutName}
                  onChangeText={setPayoutName}
                  autoFocus
                />
                <TextInput
                  style={styles.descriptionInput}
                  value={payoutDescription}
                  onChangeText={setPayoutDescription}
                  placeholder="Add a description"
                  placeholderTextColor={colors.textTertiary}
                />
                <Pressable style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.nameContainer}>
                  <Text style={styles.payoutName}>{plan.name}</Text>
                  <Pressable 
                    style={styles.editButton} 
                    onPress={() => setIsEditing(true)}
                  >
                    <PencilLine size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
                {plan.description && (
                  <Text style={styles.payoutDescription}>{plan.description}</Text>
                )}
              </>
            )}
          </View>
        </View>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLabel}>Payout Amount</Text>
            <View style={[styles.statusTag, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatCurrency(plan.payout_amount)}</Text>
          <Text style={styles.nextPayout}>
            {plan.next_payout_date 
              ? `Next payout: ${new Date(plan.next_payout_date).toLocaleDateString()}`
              : plan.status === 'completed' 
                ? 'Plan completed'
                : 'Plan paused'
            }
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {formatCurrency(plan.completed_payouts * plan.payout_amount)} of {formatCurrency(plan.total_amount)}
            </Text>
            <Text style={styles.progressCount}>
              {plan.completed_payouts}/{plan.duration} payouts
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Information</Text>
          <Card style={styles.scheduleCard}>
            <View style={styles.scheduleItem}>
              <View style={styles.scheduleIcon}>
                <Calendar size={20} color="#3B82F6" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Frequency</Text>
                <Text style={styles.scheduleValue}>
                  {plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={styles.scheduleIcon}>
                <Clock size={20} color="#8B5CF6" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Duration</Text>
                <Text style={styles.scheduleValue}>{plan.duration} payouts</Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={styles.scheduleIcon}>
                <Wallet size={20} color="#22C55E" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Total Amount</Text>
                <Text style={styles.scheduleValue}>{formatCurrency(plan.total_amount)}</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Control</Text>
          <Card style={styles.pauseCard}>
            <View style={styles.pauseContent}>
              <View style={styles.pauseInfo}>
                <Text style={styles.pauseTitle}>
                  {plan.status === 'paused' ? 'Resume Payouts' : 'Pause Payouts'}
                </Text>
                <Text style={styles.pauseDescription}>
                  {plan.status === 'paused'
                    ? 'Resume your automated payouts to continue receiving funds on schedule.'
                    : 'Temporarily stop your automated payouts. You can resume anytime.'}
                </Text>
              </View>
              <Button
                title={plan.status === 'paused' ? "Resume" : "Pause"}
                onPress={handlePauseResume}
                style={[
                  styles.pauseButton,
                  plan.status === 'paused' && styles.resumeButton
                ]}
                icon={plan.status === 'paused' ? Play : Pause}
                disabled={plan.status === 'completed' || plan.status === 'cancelled'}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Access</Text>
          <Card style={styles.emergencyCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={20} color="#F97316" />
              <Text style={styles.warningTitle}>Emergency Withdrawal Available</Text>
            </View>
            <Text style={styles.warningDescription}>
              You can withdraw your funds before the scheduled date, but this will attract a fee and a 72-hour processing time.
            </Text>
            <Pressable style={styles.withdrawButton}>
              <Text style={styles.withdrawButtonText}>Request Emergency Withdrawal</Text>
            </Pressable>
          </Card>
        </View>
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
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  payoutNameContainer: {
    marginBottom: 24,
  },
  payoutNameHeader: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  payoutName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutDescription: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  editContainer: {
    gap: 12,
  },
  nameInput: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  descriptionInput: {
    fontSize: 16,
    color: colors.textSecondary,
    padding: 0,
  },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  nextPayout: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  scheduleCard: {
    gap: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleInfo: {
    flex: 1,
    paddingVertical: 16,
  },
  scheduleLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  pauseCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pauseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    gap: 20,
  },
  pauseInfo: {
    flex: 1,
  },
  pauseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  pauseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pauseButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
  },
  resumeButton: {
    backgroundColor: '#22C55E',
  },
  emergencyCard: {
    backgroundColor: '#FFF7ED',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F97316',
  },
  warningDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  withdrawButton: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  withdrawButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F97316',
  },
});