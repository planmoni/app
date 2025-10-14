import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Zap, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEmergencyWithdrawal } from '@/hooks/useEmergencyWithdrawal';
import { useEmergencyWithdrawalOptions } from '@/hooks/useEmergencyWithdrawalOptions';
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
  const { emergencyBiometricEnabled, verifyEmergencyPin, checkBiometricSupport, hasEmergencyPin, hasAppLockPin } = usePin();
  const { options: withdrawalOptions, loading: optionsLoading, getDisplayName, getColorForType } = useEmergencyWithdrawalOptions();
  
  const [selectedOption, setSelectedOption] = useState<'instant' | '24hrs' | '72hrs' | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);
  
  // Memoize styles to prevent recreation on every render
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  
  // Find the plan details
  useEffect(() => {
    const foundPlan = payoutPlans.find(p => p.id === planId);
    setPlan(foundPlan);
  }, [planId, payoutPlans]);

  // Calculate time elapsed and available options
  const { timeElapsedHours, availableOptions, defaultOption } = useMemo(() => {
    if (!plan || !withdrawalOptions.length) {
      return { timeElapsedHours: 0, availableOptions: [], defaultOption: null };
    }

    const planCreatedAt = new Date(plan.created_at);
    const now = new Date();
    const timeElapsedMs = now.getTime() - planCreatedAt.getTime();
    const timeElapsedHours = timeElapsedMs / (1000 * 60 * 60);

    // Determine available options based on time elapsed
    let availableOptions = [];
    let defaultOption = null;

    if (timeElapsedHours < 24) {
      // Less than 24 hours - only instant withdrawal allowed
      availableOptions = withdrawalOptions.filter(option => option.type === 'instant');
      defaultOption = 'instant';
    } else if (timeElapsedHours < 72) {
      // Between 24-72 hours - instant and 24hrs allowed
      availableOptions = withdrawalOptions.filter(option => 
        option.type === 'instant' || option.type === '24hrs'
      );
      defaultOption = '24hrs'; // Default to 24hrs for better fee
    } else {
      // More than 72 hours - all options allowed
      availableOptions = withdrawalOptions;
      defaultOption = '72hrs'; // Default to 72hrs for best fee
    }

    return { timeElapsedHours, availableOptions, defaultOption };
  }, [plan, withdrawalOptions]);

  // Set default option when available options change
  useEffect(() => {
    if (defaultOption && !selectedOption) {
      setSelectedOption(defaultOption as 'instant' | '24hrs' | '72hrs');
    }
  }, [defaultOption, selectedOption]);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = useCallback(async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
      
      // Log biometric support status for debugging
      console.log('Emergency Withdrawal - Biometric support:', {
        isAvailable: support?.isAvailable,
        isEnrolled: support?.isEnrolled,
        supportedTypes: support?.supportedTypes
      });
    } catch (error) {
      console.error('Error checking biometric support:', error);
      setBiometricSupport(null);
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
  
  const handleOptionSelect = useCallback((option: 'instant' | '24hrs' | '72hrs') => {
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
    
    // Check if ANY PIN is set up (emergency PIN or app lock PIN)
    if (!hasEmergencyPin && !hasAppLockPin) {
      // No PIN set up at all, proceed directly without verification
      await handleConfirmWithdrawal();
      return;
    }
    
    // If biometric authentication is enabled and available, try biometric first
    if (emergencyBiometricEnabled && biometricSupport?.isAvailable && Platform.OS !== 'web') {
      await attemptBiometricAuthentication();
    } else {
      // Fall back to PIN verification
      setShowPinVerification(true);
    }
  }, [selectedOption, plan, haptics, emergencyBiometricEnabled, biometricSupport, attemptBiometricAuthentication, hasEmergencyPin, hasAppLockPin, handleConfirmWithdrawal]);

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
            <Text style={styles.planInfoLabel}>Plan Name:  </Text>
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
        
        {optionsLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading withdrawal options...</Text>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            {availableOptions.map((option) => {
              const isSelected = selectedOption === option.type;
              const isDisabled = !availableOptions.some(opt => opt.type === option.type);
              
              return (
                <Pressable 
                  key={option.id}
                  style={[
                    styles.optionCard,
                    isSelected && styles.selectedOption,
                    isDisabled && styles.disabledOption
                  ]}
                  onPress={() => !isDisabled && handleOptionSelect(option.type as 'instant' | '24hrs' | '72hrs')}
                  disabled={isDisabled}
                >
                  <View style={styles.optionHeader}>
                    <View style={[styles.optionIcon, { backgroundColor: getColorForType(option.type) + '20' }]}>
                      {option.type === 'instant' ? (
                        <Zap size={24} color={getColorForType(option.type)} />
                      ) : (
                        <Clock size={24} color={getColorForType(option.type)} />
                      )}
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionTitle, isDisabled && styles.disabledText]}>
                        {getDisplayName(option.type)}
                      </Text>
                      <Text style={[styles.optionFee, isDisabled && styles.disabledText]}>
                        {option.percentage}% processing fee
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Check size={20} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        
        {timeElapsedHours > 0 && (
          <View style={styles.timeInfoCard}>
            <Text style={styles.timeInfoText}>
              Plan created {timeElapsedHours < 24 
                ? `${Math.round(timeElapsedHours)} hours ago` 
                : timeElapsedHours < 72 
                  ? `${Math.round(timeElapsedHours / 24)} days ago`
                  : `${Math.round(timeElapsedHours / 24)} days ago`
              }
            </Text>
            <Text style={styles.timeInfoSubtext}>
              {timeElapsedHours < 24 
                ? "Only instant withdrawal is available for plans less than 24 hours old"
                : timeElapsedHours < 72 
                  ? "Instant and 24-hour withdrawals are available"
                  : "All withdrawal options are available"
              }
            </Text>
          </View>
        )}
        
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
    maxWidth: '70%',
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
  disabledOption: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  timeInfoCard: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#DBEAFE',
  },
  timeInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  timeInfoSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});