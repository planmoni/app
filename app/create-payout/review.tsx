import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wallet, Calendar, Clock, Building2, TriangleAlert as AlertTriangle, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { useCreatePayout } from '@/hooks/useCreatePayout';
import ErrorMessage from '@/components/ErrorMessage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';

export default function ReviewScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const { createPayout, isLoading, error } = useCreatePayout();
  
  // Get values from route params
  const totalAmount = params.totalAmount as string;
  const frequency = params.frequency as string;
  const payoutAmount = params.payoutAmount as string;
  const duration = params.duration as string;
  const startDate = params.startDate as string;
  const bankName = params.bankName as string;
  const accountNumber = params.accountNumber as string;
  const accountName = params.accountName as string;
  const bankAccountId = params.bankAccountId as string;
  const payoutAccountId = params.payoutAccountId as string;
  const emergencyWithdrawal = params.emergencyWithdrawal === 'true';
  const customDates = params.customDates ? JSON.parse(params.customDates as string) : [];

  // Format values for display
  const formattedTotal = `₦${totalAmount}`;
  const formattedPayout = `₦${payoutAmount}`;
  const numberOfPayouts = parseInt(duration);
  const formattedFrequency = frequency.charAt(0).toUpperCase() + frequency.slice(1);

  const handleStartPlan = async () => {
    await createPayout({
      name: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Payout Plan`,
      description: `${frequency} payout of ${payoutAmount}`,
      totalAmount: parseFloat(totalAmount.replace(/[^0-9.]/g, '')),
      payoutAmount: parseFloat(payoutAmount.replace(/[^0-9.]/g, '')),
      frequency: frequency as 'weekly' | 'biweekly' | 'monthly' | 'custom',
      duration: parseInt(duration),
      startDate,
      bankAccountId: bankAccountId || null,
      payoutAccountId: payoutAccountId || null,
      customDates,
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.stepText}>Step 5 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Review & Confirm</Text>
          <Text style={styles.description}>
            Review your payout plan details before confirming
          </Text>

          {error && <ErrorMessage message={error} />}

          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: '#F0FDF4' }]}>
                <Wallet size={20} color="#22C55E" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Total Amount</Text>
                <Text style={styles.detailValue}>{formattedTotal}</Text>
              </View>
              <Pressable style={styles.editButton} onPress={() => router.push('/create-payout/amount')}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: '#EFF6FF' }]}>
                <Calendar size={20} color="#3B82F6" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Payout Frequency</Text>
                <Text style={styles.detailValue}>{formattedFrequency}</Text>
                <Text style={styles.detailSubtext}>{formattedPayout} per payout</Text>
              </View>
              <Pressable style={styles.editButton} onPress={() => router.push('/create-payout/schedule')}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: '#F5F3FF' }]}>
                <Clock size={20} color="#8B5CF6" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{duration} {frequency === 'custom' ? 'payouts' : 'months'}</Text>
                <Text style={styles.detailSubtext}>First payout on {startDate}</Text>
              </View>
              <Pressable style={styles.editButton} onPress={() => router.push('/create-payout/schedule')}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.detailItem}>
              <View style={[styles.detailIcon, { backgroundColor: '#F0F9FF' }]}>
                <Building2 size={20} color="#0EA5E9" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Destination Account</Text>
                <Text style={styles.detailValue}>{bankName} •••• {accountNumber.slice(-4)}</Text>
                <Text style={styles.detailSubtext}>{accountName}</Text>
              </View>
              <Pressable style={styles.editButton} onPress={() => router.push('/create-payout/destination')}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Plan Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>{formattedTotal}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Number of Payouts</Text>
              <Text style={styles.summaryValue}>{numberOfPayouts}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount per Payout</Text>
              <Text style={styles.summaryValue}>{formattedPayout}</Text>
            </View>

            {emergencyWithdrawal && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Emergency Access</Text>
                <Text style={styles.summaryValue}>Enabled</Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Fees</Text>
              <Text style={styles.totalValue}>₦0.00</Text>
            </View>
          </View>

          <View style={styles.confirmationBox}>
            <View style={styles.checkIcon}>
              <Check size={20} color="#22C55E" />
            </View>
            <Text style={styles.confirmationText}>
              By continuing, you agree to lock {formattedTotal} in your vault for the duration of this payout plan.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Start Payout Plan"
        onPress={handleStartPlan}
        loading={isLoading}
      />
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
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  detailsList: {
    gap: 16,
    marginBottom: 32,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  detailSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successLight,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});