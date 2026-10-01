import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
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
  isLoading?: boolean;
  customDateAmounts?: Record<string, Record<string, number>>;
  onRequireAuth?: () => boolean;
  setShowAddByCodeModal: (value: boolean) => void;
  setShowNewPlanInfoModal: (value: boolean) => void;
  setShowHowItWorksModal: (value: boolean) => void;
  isUserAuthenticated?: boolean;
  onShowWelcomeModal?: () => void;
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
  isLoading = false,
  customDateAmounts = {},
  onRequireAuth,
  setShowAddByCodeModal,
  setShowNewPlanInfoModal,
  setShowHowItWorksModal,
  isUserAuthenticated = true,
  onShowWelcomeModal,
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
        <View style={styles.payoutsBalanceWatermark} pointerEvents="none">
          <CalendarDays size={110} color="#FFFFFF" strokeWidth={1.5} />
        </View>
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

      <NextPayoutCard nextPayout={nextPayout} customDateAmounts={customDateAmounts} />

        <PayoutPlansSection
          activePlans={activePlans}
          isLoading={isLoading}
          customDateAmounts={customDateAmounts}
          onRequireAuth={onRequireAuth}
          onShowAddByCodeModal={() => setShowAddByCodeModal(true)}
          onShowNewPlanInfo={() => setShowNewPlanInfoModal(true)}
          onShowHowItWorks={() => setShowHowItWorksModal(true)}
          isUserAuthenticated={isUserAuthenticated}
          onShowWelcomeModal={onShowWelcomeModal}
        />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
