import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import Card from '@/components/Card';
import { logAnalyticsEvent } from '@/lib/firebase';

interface SummaryCardProps {
  totalPaidOut: number;
  pendingPayouts: number;
  completionRate: number;
  activePlans: any[];
  payoutPlans: any[];
  getLastPayoutDate: () => string;
}

export default function SummaryCard({ 
  totalPaidOut, 
  pendingPayouts, 
  completionRate, 
  activePlans, 
  payoutPlans, 
  getLastPayoutDate 
}: SummaryCardProps) {
  const { colors, isDark } = useTheme();
  const { showBalances } = useBalance();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  };

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Payout Summary</Text>
        {/* <Calendar size={20} color={colors.textSecondary} /> */}
      </View>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryItems}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total amount of plans created</Text>
            <Text style={styles.summaryValue}>{formatBalance(totalPaidOut)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending payouts</Text>
            <Text style={styles.summaryValue}>{formatBalance(pendingPayouts)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Completion Rate</Text>
            <Text style={styles.summaryValue}>{completionRate}%</Text>
          </View>
        </View>
        {isSummaryExpanded && (
          <View style={styles.expandedContent}>
            {/* <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Active Plans</Text>
              <Text style={styles.summaryValue}>{activePlans.length}</Text>
            </View> */}
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Plans</Text>
              <Text style={styles.summaryValue}>{payoutPlans.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Final payout date</Text>
              <Text style={styles.summaryValue}>
                {getLastPayoutDate()}
              </Text>
            </View>
          </View>
        )}
        <Pressable 
          style={styles.seeMoreButton} 
          onPress={() => {
            setIsSummaryExpanded(!isSummaryExpanded);
            logAnalyticsEvent('toggle_summary', { expanded: !isSummaryExpanded });
          }}
        >
          <Text style={styles.seeMoreText}>
            {isSummaryExpanded ? 'Show less' : 'See more'}
          </Text>
          {isSummaryExpanded ? (
            <ChevronUp size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
        </Pressable>
      </Card>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '700',
    color: colors.text,
  },
  summaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 6,
  },
  summaryItems: {
    paddingHorizontal: 1,
    paddingTop: 16,
    gap: 16,
  },
  expandedContent: {
    paddingHorizontal: 1,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: Platform.OS === 'ios' ? 16 : 10,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    fontWeight: '600',
    color: colors.text,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Platform.OS === 'ios' ? 16 : 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: Platform.OS === 'ios' ? 16 : 10,
  },
  seeMoreText: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
}); 