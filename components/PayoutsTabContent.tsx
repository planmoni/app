import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Clock } from 'lucide-react-native';
import NextPayoutCard from '@/components/NextPayoutCard';
import PayoutPlansSection from '@/components/PayoutPlansSection';

type PayoutsTabContentProps = {
  screenWidth: number;
  styles: any;
  colors: any;
  formatBalance: (amount: number) => string;
  lockedBalance: number;
  nextPayout: any;
  activePlans: any[];
  payoutsTotalPaid: number;
  payoutsTotalAmount: number;
  onRequireAuth?: () => boolean;
  setShowNewPlanInfoModal: (value: boolean) => void;
  setShowHowItWorksModal: (value: boolean) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

export default function PayoutsTabContent({
  screenWidth,
  styles,
  colors,
  formatBalance,
  lockedBalance,
  nextPayout,
  activePlans,
  payoutsTotalPaid,
  payoutsTotalAmount,
  onRequireAuth,
  setShowNewPlanInfoModal,
  setShowHowItWorksModal,
  isRefreshing = false,
  onRefresh,
}: PayoutsTabContentProps) {
  const payoutProgress = payoutsTotalAmount > 0
    ? (payoutsTotalPaid / payoutsTotalAmount) * 100
    : 0;

  return (
    <View style={[styles.tabPage, { width: screenWidth }]}>
      <ScrollView
        style={styles.tabScrollView}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
      <View style={styles.payoutsBalanceCard}>
        <View style={styles.payoutsBalanceContent}>
          <View style={styles.payoutsBalanceInfo}>
            <Text style={styles.payoutsBalanceLabel}>Total amount in payout plans</Text>
            <Text style={styles.payoutsBalanceAmount}>{formatBalance(lockedBalance)}</Text>
            <View style={styles.payoutsBalanceProgress}>
              <View style={styles.payoutsBalanceProgressTrack}>
                <View
                  style={[
                    styles.payoutsBalanceProgressFill,
                    { width: `${Math.min(Math.max(payoutProgress, 0), 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.payoutsBalanceProgressText}>
                Total paid out {formatBalance(payoutsTotalPaid)} / {formatBalance(payoutsTotalAmount)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <NextPayoutCard nextPayout={nextPayout} />

        <PayoutPlansSection
          activePlans={activePlans}
          onRequireAuth={onRequireAuth}
          onShowNewPlanInfo={() => setShowNewPlanInfoModal(true)}
          onShowHowItWorks={() => setShowHowItWorksModal(true)}
        />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
