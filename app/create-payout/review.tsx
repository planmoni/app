import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Platform } from 'react-native';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wallet, Calendar, Clock, Building2, TriangleAlert as AlertTriangle, Shield, Check, X, Target, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreatePayout } from '@/hooks/useCreatePayout';
import { useBalance } from '@/contexts/BalanceContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import ErrorMessage from '@/components/ErrorMessage';
import { useHaptics } from '@/hooks/useHaptics';
import { formatDisplayDate, formatPayoutFrequency, getDayOfWeekName } from '@/lib/formatters';
import { getPurposeLabel } from '@/lib/payout-purposes';
import { useBanks } from '@/hooks/useBanks';
import { getBankIconLogo } from '@/lib/bankIcons';
import { usePin } from '@/contexts/PinContext';
import PinVerificationModal from '@/components/PinVerificationModal';
import { supabase } from '@/lib/supabase';
import { calculatePayoutFees, calculatePayoutFeesCustom } from '@/lib/payout-fee-calculator';
import type { PayoutFeeResult } from '@/lib/payout-fee-calculator';
import { trackLifecycleEvent } from '@/lib/lifecycleTracking';
import { LifecycleEventName } from '@/lib/lifecycleEvents';
import { buildCustomDateTimesMap, formatTimeForDisplay } from '@/lib/payout-time';
import { formatPayoutMoney, hasCustomPayoutAmounts } from '@/lib/custom-payout-amounts';

export default function ReviewScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const { createPayout, isLoading, error } = useCreatePayout();
  const { balance, lockedBalance, refreshWallet, isLoading: walletLoading } = useBalance();
  const haptics = useHaptics();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<PayoutFeeResult | null>(null);
  const [showFeesBreakdownModal, setShowFeesBreakdownModal] = useState(false);
  const { banks } = useBanks();
  const { verifyPayoutPin, hasPayoutPin, payoutBiometricEnabled, hasAppLockPin } = usePin();

  useEffect(() => {
    void trackLifecycleEvent(LifecycleEventName.PAYOUT_PLAN_FLOW_STEP_DETAILS, { screen: 'review' });
  }, []);
  
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
  const customDateTimesRaw = params.customDateTimes ? JSON.parse(params.customDateTimes as string) : {};
  const customDateTimes =
    frequency === 'custom' && customDates.length > 0
      ? buildCustomDateTimesMap(customDates, customDateTimesRaw)
      : customDateTimesRaw;
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string) : undefined;
  const payoutHour = params.payoutHour ? parseInt(params.payoutHour as string) : undefined;
  const payoutMinute = params.payoutMinute ? parseInt(params.payoutMinute as string) : undefined;
  const purpose = params.purpose as string | undefined;
  const purposeOther = params.purposeOther as string | undefined;

  // Calculate available balance
  const availableBalance = balance - lockedBalance;
  
  // Parse total amount to number for comparison. Fee is taken from the amount (not added on top).
  const numericTotalAmount = parseFloat(totalAmount.replace(/,/g, ''));
  const hasInsufficientBalance =
    !walletLoading && !isRefreshing && numericTotalAmount > availableBalance;

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

  // Calculate fee breakdown (processing + stamp duty + transaction).
  // Single primitive dep key so effect doesn't re-run when params object reference changes.
  const feeDepsKey = `${totalAmount ?? ''}|${frequency ?? ''}|${duration ?? ''}|${(params as Record<string, unknown>).customDates ?? ''}|${(params as Record<string, unknown>).customDateAmounts ?? ''}`;
  useEffect(() => {
    if (!totalAmount || !frequency) {
      setFeeBreakdown(null);
      return;
    }
    const numericTotal = parseFloat(totalAmount.replace(/,/g, ''));
    if (isNaN(numericTotal) || numericTotal <= 0) {
      setFeeBreakdown(null);
      return;
    }
    const numPayouts = parseInt(duration || '0', 10) || 0;
    if (frequency === 'custom') {
      try {
        const customDatesStr = (params as Record<string, unknown>).customDates as string | undefined;
        const customDateAmountsStr = (params as Record<string, unknown>).customDateAmounts as string | undefined;
        const dates = customDatesStr ? JSON.parse(customDatesStr) : [];
        const amounts = customDateAmountsStr ? JSON.parse(customDateAmountsStr) : {};
        if (Array.isArray(dates) && dates.length > 0) {
          const perPayoutAmounts = dates.map((d: string) => {
            const raw = amounts[d];
            return typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) || 0 : Number(raw) || 0;
          });
          setFeeBreakdown(calculatePayoutFeesCustom(numericTotal, perPayoutAmounts));
        } else {
          setFeeBreakdown(null);
        }
      } catch {
        setFeeBreakdown(null);
      }
    } else if (numPayouts > 0) {
      setFeeBreakdown(calculatePayoutFees(numericTotal, numPayouts));
    } else {
      setFeeBreakdown(null);
    }
  }, [feeDepsKey]);

  const firstPayoutDate = getFirstPayoutDate();
  const showCustomPayoutAmounts = hasCustomPayoutAmounts(frequency, customDates, customDateAmounts);
  const customScheduleTotal = useMemo(() => {
    if (!showCustomPayoutAmounts) return 0;
    return customDates.reduce((sum: number, date: string) => {
      const raw = customDateAmounts[date] ?? payoutAmount;
      const num = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [showCustomPayoutAmounts, customDates, customDateAmounts, payoutAmount]);

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
      console.log('- Start date:', firstPayoutDate);
      console.log('- Bank account ID:', bankAccountId || null);
      console.log('- Payout account ID:', payoutAccountId || null);
      console.log('- Custom dates:', customDates);
      console.log('- Custom date amounts:', customDateAmounts);
      console.log('- Emergency withdrawal enabled:', emergencyWithdrawal);
      
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      
      await createPayout({
        name: purpose ? getPurposeLabel(purpose, purposeOther) : `${formatPayoutFrequency(frequency, dayOfWeek)} Payout Plan`,
        description: `${formatPayoutFrequency(frequency, dayOfWeek)} payout of ${payoutAmount}`,
        totalAmount: parseFloat(totalAmount.replace(/[^0-9.]/g, '')),
        payoutAmount: parseFloat(payoutAmount.replace(/[^0-9.]/g, '')),
        frequency: frequency as any,
        dayOfWeek: dayOfWeek,
        duration: parseInt(duration),
        startDate: firstPayoutDate,
        bankAccountId: bankAccountId || null,
        payoutAccountId: payoutAccountId || null,
        customDates,
        customDateAmounts: Object.keys(customDateAmounts).length > 0 ? customDateAmounts : undefined,
        customDateTimes:
          frequency === 'custom' && customDates.length > 0
            ? customDateTimes
            : Object.keys(customDateTimes).length > 0
              ? customDateTimes
              : undefined,
        emergencyWithdrawalEnabled: emergencyWithdrawal,
        payoutHour: payoutHour,
        payoutMinute: payoutMinute,
        purpose: purpose || undefined,
        purposeOther: purposeOther || undefined,
      });
    } catch (err) {
      console.error('Error in handleConfirmPayout:', err);
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    }
  }, [frequency, dayOfWeek, totalAmount, payoutAmount, duration, firstPayoutDate, bankAccountId, payoutAccountId, customDates, customDateAmounts, customDateTimes, emergencyWithdrawal, haptics, createPayout, isLoading, purpose, purposeOther]);

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

  function getFirstPayoutDate() {
    if (frequency === 'custom' && customDates.length > 0) {
      return customDates[0];
    }

    if (frequency === 'weekly_specific' && typeof dayOfWeek === 'number') {
      const today = new Date();
      const currentDay = today.getDay();
      const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
      const first = new Date(today);
      first.setDate(today.getDate() + daysToAdd);
      return first.toISOString().split('T')[0];
    }

    if (frequency === 'daily') {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      return next.toISOString().split('T')[0];
    }

    if (frequency === 'biweekly') {
      const next = new Date();
      next.setDate(next.getDate() + 14);
      return next.toISOString().split('T')[0];
    }

    if (frequency === 'end_of_month') {
      const today = new Date();
      const month = today.getMonth();
      const year = today.getFullYear();
      const endOfCurrentMonth = new Date(year, month + 1, 0);
      const first =
        today.getDate() >= endOfCurrentMonth.getDate()
          ? new Date(year, month + 2, 0)
          : endOfCurrentMonth;
      return first.toISOString().split('T')[0];
    }

    if (frequency === 'quarterly') {
      const next = new Date();
      next.setMonth(next.getMonth() + 3);
      return next.toISOString().split('T')[0];
    }

    if (frequency === 'biannual') {
      const next = new Date();
      next.setMonth(next.getMonth() + 6);
      return next.toISOString().split('T')[0];
    }

    if (frequency === 'annually') {
      const next = new Date();
      next.setFullYear(next.getFullYear() + 1);
      return next.toISOString().split('T')[0];
    }

    return startDate;
  }

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
        <Text style={styles.stepText}>Step 5 of 5</Text>
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
                  Insufficient balance. You need ₦{numericTotalAmount.toLocaleString()} but only have ₦{availableBalance.toLocaleString()} available. Fees are deducted from this amount.
                </Text>
              </View>
            )}

            <View style={styles.detailsList}>
              {purpose ? (
                <View style={styles.detailItem}>
                  <View style={[styles.detailIcon, { backgroundColor:colors.backgroundTertiary}]}>
                    <Target size={20} color={colors.text} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Purpose</Text>
                    <Text style={styles.detailValue}>{getPurposeLabel(purpose, purposeOther)}</Text>
                  </View>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => {
                      if (Platform.OS !== 'web') haptics.selection();
                      router.push({
                        pathname: '/create-payout/purpose',
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
                          customDateTimes: Object.keys(customDateTimes).length > 0 ? JSON.stringify(customDateTimes) : '',
                          dayOfWeek: dayOfWeek?.toString() || '',
                          payoutHour: payoutHour?.toString() || '',
                          payoutMinute: payoutMinute?.toString() || '',
                          purpose: purpose || '',
                          purposeOther: purposeOther || '',
                        },
                      });
                    }}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                </View>
              ) : null}

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
                        customDateTimes: Object.keys(customDateTimes).length > 0 ? JSON.stringify(customDateTimes) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                        purpose: purpose || '',
                        purposeOther: purposeOther || '',
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
                        const timeStr = customDateTimes[date] || '12:00';
                        return (
                          <Text key={date} style={styles.detailSubtext}>
                            {formatDisplayDate(date)}: {formatPayoutMoney(amount)} at {formatTimeForDisplay(timeStr)}
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
                        customDateTimes: Object.keys(customDateTimes).length > 0 ? JSON.stringify(customDateTimes) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                        purpose: purpose || '',
                        purposeOther: purposeOther || '',
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
                  <Text style={styles.detailSubtext}>First payout on {formatDisplayDate(firstPayoutDate)} at {getPayoutTimeDisplay()}</Text>
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
                        customDateTimes: Object.keys(customDateTimes).length > 0 ? JSON.stringify(customDateTimes) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                        purpose: purpose || '',
                        purposeOther: purposeOther || '',
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
                        customDateTimes: Object.keys(customDateTimes).length > 0 ? JSON.stringify(customDateTimes) : '',
                        dayOfWeek: dayOfWeek?.toString() || '',
                        payoutHour: payoutHour?.toString() || '',
                        payoutMinute: payoutMinute?.toString() || '',
                        purpose: purpose || '',
                        purposeOther: purposeOther || '',
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
              
              {showCustomPayoutAmounts ? (
                <View style={styles.summaryScheduleSection}>
                  <View style={styles.summaryScheduleHeader}>
                    <Text style={styles.summaryLabel}>Payout schedule</Text>
                    <Text style={styles.summaryScheduleMeta}>
                      {customDates.length} payout{customDates.length !== 1 ? 's' : ''} · {formatPayoutMoney(customScheduleTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryScheduleList}>
                    {customDates.map((date: string, index: number) => {
                      const amount = customDateAmounts[date] || payoutAmount;
                      const timeStr = customDateTimes[date] || '12:00';
                      const isLast = index === customDates.length - 1;
                      return (
                        <View
                          key={date}
                          style={[
                            styles.summaryScheduleRow,
                            isLast && styles.summaryScheduleRowLast,
                          ]}
                        >
                          <View style={styles.summaryScheduleIndex}>
                            <Text style={styles.summaryScheduleIndexText}>{index + 1}</Text>
                          </View>
                          <View style={styles.summaryScheduleDetails}>
                            <Text style={styles.summaryScheduleDate} numberOfLines={1}>
                              {formatDisplayDate(date)}
                            </Text>
                            <Text style={styles.summaryScheduleTime}>
                              {formatTimeForDisplay(timeStr)}
                            </Text>
                          </View>
                          <Text style={styles.summaryScheduleAmount}>
                            {formatPayoutMoney(amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount per Payout</Text>
                  <Text style={styles.summaryValue}>{`₦${payoutAmount}`}</Text>
                </View>
              )}

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
                <View style={styles.totalFeesLabelRow}>
                  <Text style={styles.totalLabel}>Total Fees</Text>
                  {feeBreakdown && feeBreakdown.totalFees > 0 && (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        if (Platform.OS !== 'web') haptics.selection();
                        setShowFeesBreakdownModal(true);
                      }}
                      style={styles.feesInfoIconWrap}
                    >
                      <Info size={18} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.totalValue}>
                  ₦{(feeBreakdown?.totalFees ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      <Modal
        visible={showFeesBreakdownModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFeesBreakdownModal(false)}
      >
        <Pressable style={styles.feesModalOverlay} onPress={() => setShowFeesBreakdownModal(false)}>
          <Pressable style={styles.feesModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.feesModalHeader}>
              <Text style={styles.feesModalTitle}>Fee breakdown</Text>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (Platform.OS !== 'web') haptics.selection();
                  setShowFeesBreakdownModal(false);
                }}
                style={styles.feesModalCloseBtn}
              >
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
            {feeBreakdown && (
              <View style={styles.feesBreakdownBody}>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Processing fee (1.5% capped at ₦500)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Stamp duty (₦50 per payout above ₦9,999)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.stampDuty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Transaction fee (₦10.75 per payout)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.transactionFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.feesBreakdownRow, styles.feesBreakdownTotalRow]}>
                  <Text style={styles.feesBreakdownTotalLabel}>Total fees</Text>
                  <Text style={styles.feesBreakdownTotalValue}>
                    ₦{feeBreakdown.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <FloatingButton 
        title={isLoading ? "Processing..." : "Start Payout Plan"}
        onPress={handleStartPlan}
        disabled={isLoading || isRefreshing || walletLoading || hasInsufficientBalance}
        loading={isLoading || walletLoading}
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
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 0,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 4,
  },
  totalFeesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feesInfoIconWrap: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 0,
  },
  feesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  feesModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  feesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feesModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  feesModalCloseBtn: {
    padding: 4,
  },
  feesBreakdownBody: {
    paddingVertical: 20,
    gap: 14,
  },
  feesBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feesBreakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  feesBreakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  feesBreakdownTotalRow: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feesBreakdownTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  feesBreakdownTotalValue: {
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
  summaryScheduleSection: {
    marginBottom: 12,
  },
  summaryScheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  summaryScheduleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  summaryScheduleList: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  summaryScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  summaryScheduleRowLast: {
    borderBottomWidth: 0,
  },
  summaryScheduleIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryScheduleIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryScheduleDetails: {
    flex: 1,
    minWidth: 0,
  },
  summaryScheduleDate: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  summaryScheduleTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryScheduleAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 0,
  },
});