import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Zap, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEmergencyWithdrawal } from '@/hooks/useEmergencyWithdrawal';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { usePin } from '@/contexts/PinContext';
import { BiometricService } from '@/lib/biometrics';
import PinVerificationModal from '@/components/PinVerificationModal';

export default function EmergencyWithdrawalScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const planName = params.name as string;
  const planAmount = params.amount as string;
  const haptics = useHaptics();
  const { processEmergencyWithdrawal, isLoading, calculateFee, calculateNetAmount } = useEmergencyWithdrawal();
  const { payoutPlans } = useRealtimePayoutPlans();
  const { emergencyBiometricEnabled, verifyEmergencyPin, checkBiometricSupport } = usePin();
  
  const [selectedOption, setSelectedOption] = useState<'instant' | '24h' | '72h' | null>('instant');
  const [plan, setPlan] = useState<any>(null);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  
  const styles = createStyles(colors, isDark);
  
  // Find the plan details
  useEffect(() => {
    const foundPlan = payoutPlans.find(p => p.id === planId);
    setPlan(foundPlan);
  }, [planId, payoutPlans]);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = useCallback(async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  }, [checkBiometricSupport]);
  
  // Calculate fees based on the selected option
  const getFeeAmount = useCallback(() => {
    if (!plan || !selectedOption) return 0;
    
    // Calculate remaining amount in the plan
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
    
    return calculateFee(remainingAmount, selectedOption);
  }, [plan, selectedOption, calculateFee]);
  
  // Calculate the net amount after fees
  const getNetAmount = useCallback(() => {
    if (!plan || !selectedOption) return 0;
    
    // Calculate remaining amount in the plan
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
    
    return calculateNetAmount(remainingAmount, selectedOption);
  }, [plan, selectedOption, calculateNetAmount]);
  
  // Get the actual withdrawal amount (remaining amount in plan)
  const getWithdrawalAmount = useCallback(() => {
    if (!plan) return 0;
    return plan.total_amount - (plan.completed_payouts * plan.payout_amount);
  }, [plan]);
  
  const handleOptionSelect = useCallback((option: 'instant' | '24h' | '72h') => {
    haptics.selection();
    setSelectedOption(option);
  }, [haptics]);

  const handleConfirmWithdrawal = useCallback(async () => {
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
  }, [selectedOption, plan, getWithdrawalAmount, processEmergencyWithdrawal]);

  const attemptBiometricAuthentication = useCallback(async () => {
    try {
      setIsBiometricAuthenticating(true);
      haptics.mediumImpact();

      const result = await BiometricService.authenticateWithBiometrics(
        "Authenticate to confirm emergency withdrawal"
      );

      if (result.success) {
        // Biometric authentication successful
        haptics.success();
        await handleConfirmWithdrawal();
      } else {
        // Biometric failed or cancelled - fall back to PIN
        haptics.error();
        
        if (result.error === "Authentication cancelled" || result.error === "User chose fallback authentication") {
          // User cancelled or chose fallback - show PIN modal
          setShowPinVerification(true);
        } else {
          // Other error - show alert and then PIN modal
          Alert.alert(
            'Biometric Authentication Failed',
            'Please use your PIN to confirm the withdrawal.',
            [
              {
                text: 'Use PIN',
                onPress: () => setShowPinVerification(true)
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      haptics.error();
      
      // Fall back to PIN on error
      Alert.alert(
        'Authentication Error',
        'Biometric authentication failed. Please use your PIN.',
        [
          {
            text: 'Use PIN',
            onPress: () => setShowPinVerification(true)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } finally {
      setIsBiometricAuthenticating(false);
    }
  }, [haptics, handleConfirmWithdrawal]);

  const handleConfirm = useCallback(async () => {
    if (!selectedOption || !plan) return;
    
    haptics.mediumImpact();
    
    // If biometric authentication is enabled and available, try biometric first
    if (emergencyBiometricEnabled && biometricSupport?.isAvailable && Platform.OS !== 'web') {
      await attemptBiometricAuthentication();
    } else {
      // Fall back to PIN verification
      setShowPinVerification(true);
    }
  }, [selectedOption, plan, haptics, emergencyBiometricEnabled, biometricSupport, attemptBiometricAuthentication]);

  const handlePinVerificationSuccess = useCallback(async () => {
    setShowPinVerification(false);
    await handleConfirmWithdrawal();
  }, [handleConfirmWithdrawal]);

  const handlePinVerificationClose = useCallback(() => {
    setShowPinVerification(false);
  }, []);
  
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
          title={isLoading ? "Processing..." : isBiometricAuthenticating ? "Authenticating..." : "Confirm Withdrawal"}
          onPress={handleConfirm}
          style={styles.confirmButton}
          disabled={!selectedOption || isLoading || isBiometricAuthenticating}
          isLoading={isLoading || isBiometricAuthenticating}
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
      
      <PinVerificationModal
        isVisible={showPinVerification}
        onClose={handlePinVerificationClose}
        onSuccess={handlePinVerificationSuccess}
        title="Enter PIN to confirm"
        description="Enter your PIN to confirm emergency withdrawal"
        customVerifyPin={verifyEmergencyPin}
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