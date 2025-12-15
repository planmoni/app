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
  setShowNewPlanInfoModal,
  setShowHowItWorksModal,
  isRefreshing = false,
  onRefresh,
}: PayoutsTabContentProps) {
  return (
    <View style={[styles.tabPage, { width: screenWidth }]}>
      <ScrollView
        style={styles.tabScrollView}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
      <View style={styles.payoutsBalanceCard}>
        <View style={styles.payoutsBalanceContent}>
          <View style={styles.payoutsBalanceInfo}>
            <Text style={styles.payoutsBalanceLabel}>Payout plans balance</Text>
            <Text style={styles.payoutsBalanceAmount}>{formatBalance(lockedBalance)}</Text>
            <View style={styles.payoutsBalanceSubtext}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.payoutsBalanceSubtextText}>
                {formatBalance(lockedBalance)} locked in payout plans
              </Text>
            </View>
          </View>
        </View>
      </View>

      <NextPayoutCard nextPayout={nextPayout} />

        <PayoutPlansSection
          activePlans={activePlans}
          onShowNewPlanInfo={() => setShowNewPlanInfoModal(true)}
          onShowHowItWorks={() => setShowHowItWorksModal(true)}
        />
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
