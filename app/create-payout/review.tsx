import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Wallet, Calendar, Clock, Building2, TriangleAlert as AlertTriangle, Shield, Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreatePayout } from '@/hooks/useCreatePayout';
import { useBalance } from '@/contexts/BalanceContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import ErrorMessage from '@/components/ErrorMessage';
import { useHaptics } from '@/hooks/useHaptics';
import { formatDisplayDate, formatPayoutFrequency, getDayOfWeekName } from '@/lib/formatters';
import { useBanks } from '@/hooks/useBanks';
import { getBankIconLogo } from '@/lib/bankIcons';
import { usePin } from '@/contexts/PinContext';
import PinVerificationModal from '@/components/PinVerificationModal';
import { supabase } from '@/lib/supabase';
import { PayoutFeeFrequency } from '@/types/payout-fees';

export default function ReviewScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const { createPayout, isLoading, error } = useCreatePayout();
  const { balance, lockedBalance, refreshWallet } = useBalance();
  const haptics = useHaptics();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const { banks } = useBanks();
  const { verifyPayoutPin, hasPayoutPin, payoutBiometricEnabled, hasAppLockPin } = usePin();
  
  // Get values from route params
  const totalAmount = params.totalAmount as string;
  const frequency = params.frequency as string;
  const payoutAmount = params.payoutAmount as string;
  const duration = params.duration as string;
  const startDate = params.startDate as string;
  const bankName = params.bankName as string;
  const accountNumber = (params.accountNumber as string) || '';
  const accountName = params.accountName as string;
  const bankAccountId = params.bankAccountId as string;
  const payoutAccountId = params.payoutAccountId as string;
  const emergencyWithdrawal = params.emergencyWithdrawal !== 'false'; // Default to true
  const customDates = params.customDates ? JSON.parse(params.customDates as string) : [];
  const customDateAmounts = params.customDateAmounts ? JSON.parse(params.customDateAmounts as string) : {};
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string) : undefined;
  const payoutHour = params.payoutHour ? parseInt(params.payoutHour as string) : undefined;
  const payoutMinute = params.payoutMinute ? parseInt(params.payoutMinute as string) : undefined;

  // Calculate available balance
  const availableBalance = balance - lockedBalance;
  
  // Parse total amount to number for comparison
  const numericTotalAmount = parseFloat(totalAmount.replace(/,/g, ''));
  
  // Check if user has insufficient balance
  const hasInsufficientBalance = numericTotalAmount > availableBalance;

  useEffect(() => {
    const fetchBalance = async () => {
      setIsRefreshing(true);
      try {
        console.log('Refreshing wallet balance before creating payout plan');
        await refreshWallet();
        console.log('Wallet balance refreshed successfully');
      } catch (error) {
        console.error('Error refreshing wallet:', error);
      } finally {
        setIsRefreshing(false);
      }
    };
    
    fetchBalance();
  }, []);

  // Fetch and calculate fee
  useEffect(() => {
    const fetchFeeAndCalculate = async () => {
      if (!totalAmount || !frequency) return;

      try {
        // Map frequency to database frequency type
        const dbFrequency: PayoutFeeFrequency = frequency === 'weekly_specific' ? 'weekly_specific' : 
                                                frequency === 'end_of_month' ? 'end_of_month' :
                                                frequency as PayoutFeeFrequency;
        
        // Fetch fee percentage from database
        const { data, error } = await supabase
          .from('payout_fees')
          .select('fee_percentage')
          .eq('frequency', dbFrequency)
          .eq('is_active', true)
          .single();
        
        if (error || !data) {
          console.warn('Error fetching fee percentage, using 0:', error);
          setFeePercentage(0);
          setFeeAmount(0);
          return;
        }
        
        const percentage = data.fee_percentage || 0;
        setFeePercentage(percentage);
        
        // Calculate fee amount
        const numericTotal = parseFloat(totalAmount.replace(/,/g, ''));
        const calculatedFee = numericTotal * (percentage / 100);
        setFeeAmount(calculatedFee);
      } catch (error) {
        console.error('Error calculating fee:', error);
        setFeePercentage(0);
        setFeeAmount(0);
      }
    };

    fetchFeeAndCalculate();
  }, [totalAmount, frequency]);

  const handleConfirmPayout = useCallback(async () => {
    // SECURITY: Prevent multiple simultaneous submissions
    if (isLoading) {
      console.warn('Payout creation already in progress, ignoring duplicate request');
      return;
    }

    try {
      console.log('Creating payout plan with the following parameters:');
      console.log('- Name:', `${formatPayoutFrequency(frequency, dayOfWeek)} Payout Plan`);
      console.log('- Total amount:', parseFloat(totalAmount.replace(/[^0-9.]/g, '')));
      console.log('- Payout amount:', parseFloat(payoutAmount.replace(/[^0-9.]/g, '')));
      console.log('- Frequency:', frequency);
      console.log('- Day of week:', dayOfWeek);
      console.log('- Duration:', parseInt(duration));
      console.log('- Start date:', startDate);
      console.log('- Bank account ID:', bankAccountId || null);
      console.log('- Payout account ID:', payoutAccountId || null);
      console.log('- Custom dates:', customDates);
      console.log('- Custom date amounts:', customDateAmounts);
      console.log('- Emergency withdrawal enabled:', emergencyWithdrawal);
      
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      
      await createPayout({
        name: `${formatPayoutFrequency(frequency, dayOfWeek)} Payout Plan`,
        description: `${formatPayoutFrequency(frequency, dayOfWeek)} payout of ${payoutAmount}`,
        totalAmount: parseFloat(totalAmount.replace(/[^0-9.]/g, '')),
        payoutAmount: parseFloat(payoutAmount.replace(/[^0-9.]/g, '')),
        frequency: frequency as any,
        dayOfWeek: dayOfWeek,
        duration: parseInt(duration),
        startDate,
        bankAccountId: bankAccountId || null,
        payoutAccountId: payoutAccountId || null,
        customDates,
        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? customDateAmounts : undefined,
        emergencyWithdrawalEnabled: emergencyWithdrawal,
        payoutHour: payoutHour,
        payoutMinute: payoutMinute,
      });
    } catch (err) {
      console.error('Error in handleConfirmPayout:', err);
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    }
  }, [frequency, dayOfWeek, totalAmount, payoutAmount, duration, startDate, bankAccountId, payoutAccountId, customDates, customDateAmounts, emergencyWithdrawal, haptics, createPayout, isLoading]);

  const handleStartPlan = useCallback(async () => {
    if (hasInsufficientBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need at least ₦${numericTotalAmount.toLocaleString()} to start this payout plan. Your current available balance is ₦${availableBalance.toLocaleString()}.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    
    // Check if payout biometric is enabled OR if payout PIN exists OR if app lock PIN exists (as fallback)
    const requiresVerification = payoutBiometricEnabled || hasPayoutPin || hasAppLockPin;
    
    if (!requiresVerification) {
      console.log('Create Payout - No verification required, proceeding without PIN/biometric');
      await handleConfirmPayout();
      return;
    }
    
    console.log('Create Payout - Verification required', { 
      payoutBiometricEnabled, 
      hasPayoutPin, 
      hasAppLockPin 
    });
    
    // Show PIN verification modal (will auto-trigger biometric if enabled)
    setShowPinVerification(true);
  }, [hasInsufficientBalance, numericTotalAmount, availableBalance, haptics, hasPayoutPin, payoutBiometricEnabled, hasAppLockPin, handleConfirmPayout]);

  const handlePinVerificationSuccess = useCallback(async () => {
    setShowPinVerification(false);
    await handleConfirmPayout();
  }, [handleConfirmPayout]);

  const handlePinVerificationClose = useCallback(() => {
    setShowPinVerification(false);
  }, []);

  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Helper function to get bank code from bank name
  const getBankCode = useCallback((bankName: string): string | null => {
    const bank = banks.find(b => b.name.toLowerCase().includes(bankName.toLowerCase()) || 
                                 bankName.toLowerCase().includes(b.name.toLowerCase()));
    return bank?.code || null;
  }, [banks]);

  // Get duration display text based on frequency
  const getDurationDisplay = useCallback(() => {
    const durationNum = parseInt(duration);
    
    switch (frequency) {
      case 'daily':
        return durationNum === 1 ? '1 day' : `${durationNum} days`;
      case 'weekly':
        return durationNum === 1 ? '1 week' : `${durationNum} weeks`;
      case 'weekly_specific':
        return durationNum === 1 ? '1 week' : `${durationNum} weeks`;
      case 'biweekly':
        return durationNum === 1 ? '2 weeks' : `${durationNum * 2} weeks`;
      case 'monthly':
        return durationNum === 1 ? '1 month' : `${durationNum} months`;
      case 'end_of_month':
        return durationNum === 1 ? '1 month' : `${durationNum} months`;
      case 'quarterly':
        return durationNum === 1 ? '3 months' : `${durationNum * 3} months`;
      case 'biannual':
        return durationNum === 1 ? '6 months' : `${durationNum * 6} months`;
      case 'annually':
        return durationNum === 1 ? '1 year' : `${durationNum} years`;
      case 'custom':
        return `${durationNum} custom dates`;
      default:
        return `${durationNum} payouts`;
    }
  }, [duration, frequency]);

  const getPayoutTimeDisplay = useCallback(() => {
    if (payoutHour !== undefined && payoutMinute !== undefined) {
      const date = new Date();
      date.setHours(payoutHour, payoutMinute, 0, 0);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return '9:00 AM'; // Default time
  }, [payoutHour, payoutMinute]);

  function getNextPayoutDate(startDate: string, frequency: string, customDates: string[] = [], dayOfWeek?: number): string {
    if (frequency === 'custom' && customDates.length > 0) {
      return formatDisplayDate(customDates[0]);
    }

    const start = new Date(startDate);
    const next = new Date(start);
    if (frequency === 'daily') {
      next.setDate(start.getDate() + 1);
      return formatDisplayDate(next.toISOString());
    }

    if (frequency === 'weekly_specific' && typeof dayOfWeek === 'number') {
      // Find the next occurrence of the selected dayOfWeek (0=Sunday, 6=Saturday) on or after startDate
      const currentDay = start.getDay();
      let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
      // If startDate is already the correct day, keep it as the first payout
      if (daysToAdd === 0) daysToAdd = 0;
      next.setDate(start.getDate() + daysToAdd);
      return formatDisplayDate(next.toISOString());
    }

    switch (frequency) {
      case 'daily':
        next.setDate(start.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(start.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(start.getDate() + 14);
        break;
      case 'monthly':
      case 'end_of_month':
        next.setMonth(start.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(start.getMonth() + 3);
        break;
      case 'biannual':
        next.setMonth(start.getMonth() + 6);
        break;
      case 'annually':
        next.setFullYear(start.getFullYear() + 1);
        break;
      default:
        next.setDate(start.getDate() + 7); // fallback
    }

    return formatDisplayDate(next.toISOString());
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.push('/(tabs)');
          }} 
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.stepText}>Step 4 of 4</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.title}>Review & Confirm</Text>
            <Text style={styles.description}>
              Review your payout plan details before confirming
            </Text>

            {error && <ErrorMessage message={error} />}
            
            {hasInsufficientBalance && (
              <View style={styles.warningBox}>
                <AlertTriangle size={20} color={colors.error} />
                <Text style={styles.warningText}>
                  Insufficient balance. You need ₦{numericTotalAmount.toLocaleString()} but only have ₦{availableBalance.toLocaleString()} available.
                </Text>
              </View>
            )}

            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor:colors.backgroundTertiary}]}>
                  <Wallet size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Total Amount</Text>
                  <Text style={styles.detailValue}>{`₦${totalAmount}`}</Text>
                </View>
                <Pressable 
                  style={styles.editButton} 
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    router.push({
                      pathname: '/create-payout/amount',
                      params: {
                        totalAmount: totalAmount,
                        frequency: frequency,
                        payoutAmount: payoutAmount,
                        duration: duration,
                        startDate: startDate,
                        bankName: bankName,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bankAccountId: bankAccountId,
                        payoutAccountId: payoutAccountId,
                        emergencyWithdrawal: emergencyWithdrawal.toString(),
                        customDates: customDates ? JSON.stringify(customDates) : '',
                        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? JSON.stringify(customDateAmounts) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                      }
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor:colors.backgroundTertiary}]}>
                  <Calendar size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Payout Frequency</Text>
                  <Text style={styles.detailValue}>{formatPayoutFrequency(frequency, dayOfWeek)}</Text>
                  {frequency === 'custom' && customDates.length > 0 && Object.keys(customDateAmounts).length > 0 ? (
                    <View style={styles.customAmountsList}>
                      {customDates.map((date: string) => {
                        const amount = customDateAmounts[date] || payoutAmount;
                        return (
                          <Text key={date} style={styles.detailSubtext}>
                            {formatDisplayDate(date)}: ₦{parseFloat(amount.toString().replace(/,/g, '')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        );
                      })}
                    </View>
                  ) : (
                  <Text style={styles.detailSubtext}>{`₦${payoutAmount}`} per payout</Text>
                  )}
                </View>
                <Pressable 
                  style={styles.editButton} 
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    router.push({
                      pathname: '/create-payout/frequency-selection',
                      params: {
                        totalAmount: totalAmount,
                        frequency: frequency,
                        payoutAmount: payoutAmount,
                        duration: duration,
                        startDate: startDate,
                        bankName: bankName,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bankAccountId: bankAccountId,
                        payoutAccountId: payoutAccountId,
                        emergencyWithdrawal: emergencyWithdrawal.toString(),
                        customDates: customDates ? JSON.stringify(customDates) : '',
                        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? JSON.stringify(customDateAmounts) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                      }
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor:colors.backgroundTertiary}]}>
                  <Clock size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{getDurationDisplay()}</Text>
                  <Text style={styles.detailSubtext}>First payout on {formatDisplayDate(startDate)} at {getPayoutTimeDisplay()}</Text>
                </View>
                <Pressable 
                  style={styles.editButton} 
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    router.push({
                      pathname: '/create-payout/frequency-selection',
                      params: {
                        totalAmount: totalAmount,
                        frequency: frequency,
                        payoutAmount: payoutAmount,
                        duration: duration,
                        startDate: startDate,
                        bankName: bankName,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bankAccountId: bankAccountId,
                        payoutAccountId: payoutAccountId,
                        emergencyWithdrawal: emergencyWithdrawal.toString(),
                        customDates: customDates ? JSON.stringify(customDates) : '',
                        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? JSON.stringify(customDateAmounts) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                      }
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor:colors.backgroundTertiary}]}>
                  {(() => {
                    const bankIcon = getBankIconLogo(bankName);
                    if (bankIcon.logoSvg) {
                      // Handle SVG components
                      return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                        width: 20,
                        height: 20,
                        fill: colors.text
                      });
                    } else if (bankIcon.logo) {
                      return (
                        <Image 
                          source={bankIcon.logo} 
                          style={{ width: 20, height: 20, resizeMode: 'contain' }}
                        />
                      );
                    } else {
                      return <Building2 size={20} color="#0EA5E9" />;
                    }
                  })()}
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Destination Account</Text>
                  <Text style={styles.detailValue}>{bankName} •••• {accountNumber.slice(-4)}</Text>
                  <Text style={styles.detailSubtext}>{accountName}</Text>
                </View>
                <Pressable 
                  style={styles.editButton} 
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    router.push({
                      pathname: '/create-payout/destination',
                      params: {
                        totalAmount: totalAmount,
                        frequency: frequency,
                        payoutAmount: payoutAmount,
                        duration: duration,
                        startDate: startDate,
                        bankName: bankName,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bankAccountId: bankAccountId,
                        payoutAccountId: payoutAccountId,
                        emergencyWithdrawal: emergencyWithdrawal.toString(),
                        customDates: customDates ? JSON.stringify(customDates) : '',
                        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? JSON.stringify(customDateAmounts) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                      }
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Plan Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValue}>{`₦${totalAmount}`}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Number of Payouts</Text>
                <Text style={styles.summaryValue}>{parseInt(duration)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount per Payout</Text>
                <Text style={styles.summaryValue}>{`₦${payoutAmount}`}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Frequency</Text>
                <Text style={styles.summaryValue}>{formatPayoutFrequency(frequency, dayOfWeek)}</Text>
              </View>

              {/* {emergencyWithdrawal && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Emergency Access</Text>
                  <View style={styles.emergencyBadge}>
                    <Text style={styles.emergencyBadgeText}>Enabled</Text>
                  </View>
                </View>
              )} */}

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Fees</Text>
                <Text style={styles.totalValue}>
                  ₦{feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.confirmationBox}>
              <View style={styles.checkIcon}>
                <Check size={20} color="#22C55E" />
              </View>
              <Text style={styles.confirmationText}>
                By continuing, you agree to lock {`₦${totalAmount}`} in your vault for the duration of this payout plan.
              </Text>
            </View>

            
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title={isLoading ? "Processing..." : "Start Payout Plan"}
        onPress={handleStartPlan}
        disabled={isLoading || isRefreshing || hasInsufficientBalance}
        loading={isLoading}
      />

      <PinVerificationModal
        isVisible={showPinVerification}
        onClose={handlePinVerificationClose}
        onSuccess={handlePinVerificationSuccess}
        title="Enter Pin to confirm"
        description="Enter your PIN to confirm payout plan"
        customVerifyPin={hasPayoutPin || hasAppLockPin ? verifyPayoutPin : undefined}
        biometricType="payout"
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
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 2,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.errorLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.error,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.error,
    lineHeight: 20,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 6,
    marginLeft: 8,
  },
  editButtonText: {
    fontSize: 14,
    color: '#1E3A8A',
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
  emergencyBadge: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emergencyBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#22C55E',
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
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#DCFCE7',
    marginBottom: 16,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  emergencyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#DBEAFE',
    marginBottom: 16,
  },
  emergencyInfoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyInfoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  balanceInfo: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  balanceInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontWeight: '600',
    color: colors.text,
  },
  insufficientBalance: {
    color: colors.error,
  },
  customAmountsList: {
    marginTop: 4,
    gap: 4,
  },
});