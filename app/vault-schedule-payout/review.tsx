import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Wallet,
  Calendar,
  Clock,
  Building2,
  TriangleAlert as AlertTriangle,
  Check,
  X,
  Info,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import ErrorMessage from '@/components/ErrorMessage';
import { useHaptics } from '@/hooks/useHaptics';
import { formatDisplayDate, formatPayoutFrequency } from '@/lib/formatters';
import { getBankIconLogo } from '@/lib/bankIcons';
import { usePin } from '@/contexts/PinContext';
import PinVerificationModal from '@/components/PinVerificationModal';
import { calculatePayoutFees, calculatePayoutFeesCustom } from '@/lib/payout-fee-calculator';
import type { PayoutFeeResult } from '@/lib/payout-fee-calculator';
import { useCreateVaultPayoutSchedule } from '@/hooks/useCreateVaultPayoutSchedule';

export default function VaultScheduleReviewScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const { createVaultPayoutSchedule, isLoading, error } = useCreateVaultPayoutSchedule();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<PayoutFeeResult | null>(null);
  const [showFeesBreakdownModal, setShowFeesBreakdownModal] = useState(false);
  const { verifyPayoutPin, hasPayoutPin, payoutBiometricEnabled, hasAppLockPin } = usePin();

  // Stable idempotency key for this screen session — prevents duplicates on double-tap or retry
  const idempotencyKeyRef = useRef<string>(
    `vps_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  );

  const totalAmount = params.totalAmount as string;
  const frequency = params.frequency as string;
  const payoutAmount = params.payoutAmount as string;
  const duration = params.duration as string;
  const startDate = params.startDate as string;
  const bankName = params.bankName as string;
  const accountNumber = (params.accountNumber as string) || '';
  const accountName = params.accountName as string;
  const payoutAccountId = params.payoutAccountId as string;
  const dayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek as string, 10) : undefined;
  const payoutHour = params.payoutHour ? parseInt(params.payoutHour as string, 10) : 12;
  const payoutMinute = params.payoutMinute ? parseInt(params.payoutMinute as string, 10) : 0;
  const vaultPlanId = params.vaultPlanId as string;
  const vaultMaxAmount = params.vaultMaxAmount as string;
  const vaultMaturityDate = (params.vaultMaturityDate as string) || '';
  const customDatesParam = (params.customDates as string) || '';
  const customDateAmountsParam = (params.customDateAmounts as string) || '';
  const customDateTimesParam = (params.customDateTimes as string) || '';
  const customDates = useMemo(
    () => (customDatesParam ? JSON.parse(customDatesParam) : []),
    [customDatesParam]
  );
  const customDateAmounts = useMemo(
    () => (customDateAmountsParam ? JSON.parse(customDateAmountsParam) : {}),
    [customDateAmountsParam]
  );
  const customDateTimes = useMemo(
    () => (customDateTimesParam ? JSON.parse(customDateTimesParam) : {}),
    [customDateTimesParam]
  );

  const numericTotalAmount = parseFloat((totalAmount || '0').replace(/,/g, ''));
  const vaultCap = parseFloat(String(vaultMaxAmount || '0').replace(/,/g, ''));
  const hasInsufficientVault = numericTotalAmount > vaultCap;

  const forwardParams = useMemo(
    () => ({
      totalAmount: totalAmount || '',
      frequency: frequency || '',
      payoutAmount: payoutAmount || '',
      duration: duration || '',
      startDate: startDate || '',
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      accountName: accountName || '',
      bankAccountId: params.bankAccountId || '',
      payoutAccountId: payoutAccountId || '',
      emergencyWithdrawal: 'true',
      customDates: customDatesParam,
      customDateAmounts: customDateAmountsParam,
      customDateTimes: customDateTimesParam,
      dayOfWeek: dayOfWeek !== undefined ? String(dayOfWeek) : '',
      payoutHour: String(payoutHour),
      payoutMinute: String(payoutMinute),
      vaultPlanId: vaultPlanId || '',
      vaultMaxAmount: vaultMaxAmount || '',
      vaultMaturityDate: vaultMaturityDate || '',
    }),
    [
      totalAmount,
      frequency,
      payoutAmount,
      duration,
      startDate,
      bankName,
      accountNumber,
      accountName,
      payoutAccountId,
      params.bankAccountId,
      dayOfWeek,
      payoutHour,
      payoutMinute,
      vaultPlanId,
      vaultMaxAmount,
      vaultMaturityDate,
      customDatesParam,
      customDateAmountsParam,
      customDateTimesParam,
    ]
  );

  const feeDepsKey = `${totalAmount ?? ''}|${duration ?? ''}|${frequency ?? ''}|${customDatesParam}|${customDateAmountsParam}`;
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
      const perPayoutAmounts = (customDates as string[]).map((date: string) => {
        const raw = customDateAmounts?.[date];
        return typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) || 0 : Number(raw) || 0;
      });
      setFeeBreakdown(calculatePayoutFeesCustom(numericTotal, perPayoutAmounts));
    } else if (numPayouts > 0) {
      setFeeBreakdown(calculatePayoutFees(numericTotal, numPayouts));
    } else {
      setFeeBreakdown(null);
    }
  }, [feeDepsKey, totalAmount, frequency, duration, customDates, customDateAmounts]);

  const getDurationDisplay = useCallback(() => {
    const durationNum = parseInt(duration, 10);
    switch (frequency) {
      case 'daily':
        return durationNum === 1 ? '1 day' : `${durationNum} days`;
      case 'weekly':
      case 'weekly_specific':
        return durationNum === 1 ? '1 week' : `${durationNum} weeks`;
      case 'biweekly':
        return durationNum === 1 ? '2 weeks' : `${durationNum * 2} weeks`;
      case 'monthly':
      case 'end_of_month':
        return durationNum === 1 ? '1 month' : `${durationNum} months`;
      case 'quarterly':
        return durationNum === 1 ? '3 months' : `${durationNum * 3} months`;
      case 'biannual':
        return durationNum === 1 ? '6 months' : `${durationNum * 6} months`;
      case 'annually':
        return durationNum === 1 ? '1 year' : `${durationNum} years`;
      default:
        return `${durationNum} payouts`;
    }
  }, [duration, frequency]);

  const getPayoutTimeDisplay = useCallback(() => {
    const date = new Date();
    date.setHours(payoutHour, payoutMinute, 0, 0);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [payoutHour, payoutMinute]);

  const getInitialNextPayoutDate = useCallback(
    (startDateValue: string, freq: string, customDateList: string[] = [], selectedDayOfWeek?: number) => {
      if (freq === 'custom' && customDateList.length > 0) {
        const firstCustom = [...customDateList].sort()[0];
        return firstCustom;
      }

      const start = new Date(startDateValue);
      const next = new Date(start);

      if (freq === 'weekly_specific' && typeof selectedDayOfWeek === 'number') {
        const currentDay = start.getDay();
        let daysToAdd = (selectedDayOfWeek - currentDay + 7) % 7;
        // For recurring schedules, if today matches selected weekday, push to next week.
        if (daysToAdd === 0) daysToAdd = 7;
        next.setDate(start.getDate() + daysToAdd);
        return formatDisplayDate(next.toISOString());
      }

      switch (freq) {
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
          next.setDate(start.getDate() + 7);
      }

      return formatDisplayDate(next.toISOString());
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (isLoading) return;
    if (!payoutAccountId) {
      showToast?.('Select a payout account to continue.', 'error');
      return;
    }
    if (!vaultPlanId) {
      showToast?.('Missing vault plan. Go back and try again.', 'error');
      return;
    }

    const startDateOnly = (startDate || '').split('T')[0];
    const initialNextPayoutDate = getInitialNextPayoutDate(
      startDateOnly,
      frequency,
      customDates as string[],
      typeof dayOfWeek === 'number' ? dayOfWeek : undefined
    );
    try {
      if (Platform.OS !== 'web') haptics.mediumImpact();
      const result = await createVaultPayoutSchedule({
        budgetPlanId: vaultPlanId,
        payoutAccountId,
        totalAmount: numericTotalAmount,
        frequency,
        duration: parseInt(duration, 10),
        startDate: startDateOnly,
        nextPayoutDate: initialNextPayoutDate,
        dayOfWeek:
          frequency === 'weekly_specific' && typeof dayOfWeek === 'number' ? dayOfWeek : null,
        payoutHour,
        payoutMinute,
        metadata: {
          idempotency_key: idempotencyKeyRef.current,
          customDates,
          customDateAmounts,
          customDateTimes,
        },
      });

      showToast?.('Vault payout schedule created', 'success');
      router.replace({
        pathname: '/vault-schedule-payout/success',
        params: {
          ...forwardParams,
          scheduleId: result?.schedule_id || '',
        },
      });
    } catch (err) {
      console.error(err);
      if (Platform.OS !== 'web') haptics.error();
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      showToast?.(msg, 'error');
    }
  }, [
    isLoading,
    payoutAccountId,
    vaultPlanId,
    startDate,
    createVaultPayoutSchedule,
    numericTotalAmount,
    frequency,
    duration,
    dayOfWeek,
    payoutHour,
    payoutMinute,
    showToast,
    forwardParams,
    haptics,
    customDates,
    customDateAmounts,
    customDateTimes,
    getInitialNextPayoutDate,
  ]);

  const handleStartPlan = useCallback(async () => {
    if (hasInsufficientVault) {
      Alert.alert(
        'Vault balance',
        `This schedule needs ₦${numericTotalAmount.toLocaleString()} from your vault. Reduce the amount or add funds to the vault.`,
        [{ text: 'OK' }]
      );
      return;
    }
    if (Platform.OS !== 'web') haptics.mediumImpact();
    const requiresVerification = payoutBiometricEnabled || hasPayoutPin || hasAppLockPin;
    if (!requiresVerification) {
      await handleConfirm();
      return;
    }
    setShowPinVerification(true);
  }, [
    hasInsufficientVault,
    numericTotalAmount,
    haptics,
    payoutBiometricEnabled,
    hasPayoutPin,
    hasAppLockPin,
    handleConfirm,
  ]);

  const handlePinVerificationSuccess = useCallback(async () => {
    setShowPinVerification(false);
    await handleConfirm();
  }, [handleConfirm]);

  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const canSubmit = !hasInsufficientVault && !isRefreshing && Boolean(payoutAccountId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vault payout schedule</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.replace('/(tabs)');
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
            <Text style={styles.title}>Review & confirm</Text>
            <Text style={styles.description}>
              Fees are taken from your gross vault amount (not added on top).
            </Text>

            {error ? <ErrorMessage message={error} /> : null}

            {hasInsufficientVault ? (
              <View style={styles.warningBox}>
                <AlertTriangle size={20} color={colors.error} />
                <Text style={styles.warningText}>
                  Amount exceeds the vault cap for this plan (₦{vaultCap.toLocaleString()}).
                </Text>
              </View>
            ) : null}

            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: colors.backgroundTertiary }]}>
                  <Wallet size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Total (from vault)</Text>
                  <Text style={styles.detailValue}>{`₦${totalAmount}`}</Text>
                </View>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') haptics.selection();
                    router.push({
                      pathname: '/vault-schedule-payout/amount',
                      params: { planId: vaultPlanId, totalAmount },
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: colors.backgroundTertiary }]}>
                  <Calendar size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Schedule</Text>
                  <Text style={styles.detailValue}>{formatPayoutFrequency(frequency, dayOfWeek)}</Text>
                  <Text style={styles.detailSubtext}>{`₦${payoutAmount}`} per payout</Text>
                </View>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') haptics.selection();
                    router.push({
                      pathname: '/create-payout/frequency-selection',
                      params: forwardParams,
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: colors.backgroundTertiary }]}>
                  <Clock size={20} color={colors.text} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{getDurationDisplay()}</Text>
                  <Text style={styles.detailSubtext}>
                    First payout (from maturity date) on {formatDisplayDate(startDate)} at {getPayoutTimeDisplay()}
                  </Text>
                </View>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') haptics.selection();
                    router.push({
                      pathname: '/create-payout/frequency-selection',
                      params: forwardParams,
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: colors.backgroundTertiary }]}>
                  {(() => {
                    const bankIcon = getBankIconLogo(bankName);
                    if (bankIcon.logoSvg) {
                      return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                        width: 20,
                        height: 20,
                        fill: colors.text,
                      });
                    }
                    if (bankIcon.logo) {
                      return (
                        <Image
                          source={bankIcon.logo}
                          style={{ width: 20, height: 20, resizeMode: 'contain' }}
                        />
                      );
                    }
                    return <Building2 size={20} color="#0EA5E9" />;
                  })()}
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Destination</Text>
                  <Text style={styles.detailValue}>
                    {bankName} •••• {accountNumber.slice(-4)}
                  </Text>
                  <Text style={styles.detailSubtext}>{accountName}</Text>
                </View>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    if (Platform.OS !== 'web') haptics.selection();
                    router.push({
                      pathname: '/vault-schedule-payout/destination',
                      params: forwardParams,
                    });
                  }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total from vault</Text>
                <Text style={styles.summaryValue}>{`₦${totalAmount}`}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Number of payouts</Text>
                <Text style={styles.summaryValue}>{parseInt(duration, 10)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <View style={styles.totalFeesLabelRow}>
                  <Text style={styles.totalLabel}>Total fees (from vault amount)</Text>
                  {feeBreakdown && feeBreakdown.totalFees > 0 ? (
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
                  ) : null}
                </View>
                <Text style={styles.totalValue}>
                  ₦{(feeBreakdown?.totalFees ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.confirmationBox}>
              <View style={styles.checkIcon}>
                <Check size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.confirmationText}>
                ₦{numericTotalAmount.toLocaleString()} will be deducted from your vault now, including
                fees. Bank payouts run on the schedule (when processing is enabled).
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
            {feeBreakdown ? (
              <View style={styles.feesBreakdownBody}>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Processing fee (1.5% capped at ₦500)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.processingFee.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Stamp duty (₦50 per payout above ₦9,999)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.stampDuty.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={styles.feesBreakdownRow}>
                  <Text style={styles.feesBreakdownLabel}>Transaction fee (₦10.75 per payout)</Text>
                  <Text style={styles.feesBreakdownValue}>
                    ₦{feeBreakdown.transactionFee.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View style={[styles.feesBreakdownRow, styles.feesBreakdownTotalRow]}>
                  <Text style={styles.feesBreakdownTotalLabel}>Total fees</Text>
                  <Text style={styles.feesBreakdownTotalValue}>
                    ₦{feeBreakdown.totalFees.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <FloatingButton
        title={isLoading ? 'Processing…' : 'Confirm schedule'}
        onPress={handleStartPlan}
        disabled={isLoading || isRefreshing || !canSubmit}
        loading={isLoading}
      />

      {showPinVerification ? (
        <PinVerificationModal
          isVisible={showPinVerification}
          onClose={() => setShowPinVerification(false)}
          onSuccess={handlePinVerificationSuccess}
          title="Enter PIN to confirm"
          description="Confirm vault payout schedule"
          customVerifyPin={hasPayoutPin || hasAppLockPin ? verifyPayoutPin : undefined}
          biometricType="payout"
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      paddingBottom: 100,
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
      marginBottom: 24,
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
  });
