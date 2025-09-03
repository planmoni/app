import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Zap, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEmergencyWithdrawal } from '@/hooks/useEmergencyWithdrawal';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import EmergencyWithdrawalConfirmationModal from '@/components/EmergencyWithdrawalConfirmationModal';

export default function EmergencyWithdrawalScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const planName = params.name as string;
  const planAmount = params.amount as string;
  const haptics = useHaptics();
  const { processEmergencyWithdrawal, isLoading, calculateFee, calculateNetAmount } = useEmergencyWithdrawal();
  const { payoutPlans } = useRealtimePayoutPlans();
  
  const [selectedOption, setSelectedOption] = useState<'instant' | '24h' | '72h' | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  
  const styles = createStyles(colors, isDark);
  
  // Find the plan details
  useEffect(() => {
    const foundPlan = payoutPlans.find(p => p.id === planId);
    setPlan(foundPlan);
  }, [planId, payoutPlans]);
  
  // Calculate fees based on the selected option
  const getFeeAmount = () => {
    if (!plan || !selectedOption) return 0;
    
    // Calculate remaining amount in the plan
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
    
    return calculateFee(remainingAmount, selectedOption);
  };
  
  // Calculate the net amount after fees
  const getNetAmount = () => {
    if (!plan || !selectedOption) return 0;
    
    // Calculate remaining amount in the plan
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
    
    return calculateNetAmount(remainingAmount, selectedOption);
  };
  
  // Get the actual withdrawal amount (remaining amount in plan)
  const getWithdrawalAmount = () => {
    if (!plan) return 0;
    return plan.total_amount - (plan.completed_payouts * plan.payout_amount);
  };
  
  const handleOptionSelect = (option: 'instant' | '24h' | '72h') => {
    haptics.selection();
    setSelectedOption(option);
  };
  
  const handleConfirm = async () => {
    if (!selectedOption || !plan) return;
    
    haptics.mediumImpact();
    
    // Show confirmation modal instead of directly processing withdrawal
    setShowConfirmationModal(true);
  };

  const handleConfirmWithdrawal = async () => {
    if (!selectedOption || !plan) return;
    
    const withdrawalAmount = getWithdrawalAmount();
    
    // Process the emergency withdrawal
    const result = await processEmergencyWithdrawal({
      planId: plan.id,
      planName: plan.name,
      withdrawalAmount,
      option: selectedOption,
      // Use the plan's configured account (payout_account_id or bank_account_id)
      payoutAccountId: plan.payout_account_id || undefined,
      bankAccountId: plan.bank_account_id || undefined
    });
    
    // Navigation is handled by the hook if successful
    if (!result.success) {
      console.error('Emergency withdrawal failed:', result.error);
    }
  };
  
  // Show loading state if plan data is not loaded yet
  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              haptics.lightImpact();
              router.back();
            }} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Emergency Withdrawal</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading plan details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const withdrawalAmount = getWithdrawalAmount();
  
  // If there's no remaining amount, show error
  if (withdrawalAmount <= 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              haptics.lightImpact();
              router.back();
            }} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Emergency Withdrawal</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No funds available for withdrawal in this plan.</Text>
          <Button 
            title="Go Back" 
            onPress={() => router.back()} 
            style={styles.backButtonStyle}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Emergency Withdrawal</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningCard}>
          <AlertTriangle size={24} color={isDark ? '#FCD34D' : '#F97316'} />
          <Text style={styles.warningText}>
            Emergency withdrawals allow you to access your funds before the scheduled payout date, but may incur fees depending on the option you choose.
          </Text>
        </View>
        
        <View style={styles.planInfoCard}>
          <Text style={styles.planInfoTitle}>Withdrawal Details</Text>
          <View style={styles.planInfoRow}>
            <Text style={styles.planInfoLabel}>Plan Name:</Text>
            <Text style={styles.planInfoValue}>{plan.name}</Text>
          </View>
          <View style={styles.planInfoRow}>
            <Text style={styles.planInfoLabel}>Available Amount:</Text>
            <Text style={styles.planInfoValue}>₦{withdrawalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.planInfoRow}>
            <Text style={styles.planInfoLabel}>Completed Payouts:</Text>
            <Text style={styles.planInfoValue}>{plan.completed_payouts} of {plan.duration}</Text>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>Select Withdrawal Option</Text>
        
        <View style={styles.optionsContainer}>
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === 'instant' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('instant')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Zap size={24} color="#EF4444" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Instant Withdrawal</Text>
                <Text style={styles.optionFee}>12% processing fee</Text>
              </View>
              {selectedOption === 'instant' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Get your funds immediately with the highest processing fee.
            </Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === '24h' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('24h')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={24} color="#F59E0B" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>24-Hour Withdrawal</Text>
                <Text style={styles.optionFee}>6% processing fee</Text>
              </View>
              {selectedOption === '24h' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Receive your funds within 24 hours with a reduced processing fee.
            </Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === '72h' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('72h')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#DCFCE7' }]}>
                <Clock size={24} color="#22C55E" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>72-Hour Withdrawal</Text>
                <Text style={styles.optionFee}>No processing fee</Text>
              </View>
              {selectedOption === '72h' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Wait 72 hours for your funds with no processing fee.
            </Text>
          </Pressable>
        </View>
        
        {selectedOption && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Withdrawal Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Withdrawal Amount</Text>
              <Text style={styles.summaryValue}>₦{withdrawalAmount.toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Processing Fee</Text>
              <Text style={styles.summaryValue}>₦{getFeeAmount().toLocaleString()}</Text>
            </View>
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You'll Receive</Text>
              <Text style={styles.totalValue}>₦{getNetAmount().toLocaleString()}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          title={isLoading ? "Processing..." : "Confirm Withdrawal"}
          onPress={handleConfirm}
          style={styles.confirmButton}
          disabled={!selectedOption || isLoading}
          isLoading={isLoading}
          hapticType="medium"
        />
        <Button
          title="Cancel"
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          variant="outline"
          style={styles.cancelButton}
          hapticType="light"
          disabled={isLoading}
        />
      </View>
      
      <SafeFooter />
      
      <EmergencyWithdrawalConfirmationModal
        isVisible={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleConfirmWithdrawal}
        withdrawalDetails={{
          planName: plan?.name || '',
          planAmount: getWithdrawalAmount().toString(),
          option: selectedOption || '',
          feeAmount: getFeeAmount().toString(),
          netAmount: getNetAmount().toString(),
          bankName: plan?.bank_name || 'Default Bank',
          accountName: plan?.account_name || 'Default Account',
          accountNumber: plan?.account_number || '****',
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButtonStyle: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#FFF7ED',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : '#FFEDD5',
    borderLeftWidth: 4,
    borderLeftColor: isDark ? '#F97316' : '#F97316',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: isDark ? '#FCD34D' : '#9A3412',
    lineHeight: 20,
  },
  planInfoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  planInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planInfoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionFee: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
  footer: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    borderColor: colors.border,
  },
});