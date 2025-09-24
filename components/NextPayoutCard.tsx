import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import CountdownTimer from '@/components/CountdownTimer';
import { getBankIconLogo } from '@/lib/bankIcons';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';

interface NextPayoutCardProps {
  nextPayout: any;
}

export default function NextPayoutCard({ nextPayout }: NextPayoutCardProps) {
  const { colors, isDark } = useTheme();
  const { showBalances } = useBalance();

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  };

  const handleViewPayout = (id: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id }
    });
    logAnalyticsEvent('view_payout', { payout_id: id });
  };

  if (!nextPayout) return null;

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Up Next</Text>
      </View>
      <Pressable 
        style={styles.payoutCard}
        onPress={() => handleViewPayout(nextPayout.id)}
      >
        <View style={styles.payoutCardContent}>
          <View style={styles.payoutHeader}>
            <Text style={styles.payoutName}>{nextPayout.name}</Text>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>
                {nextPayout.status === 'active' ? 'Outgoing' : 'Paused'}
              </Text>
            </View>
          </View>
          
          <View style={styles.payoutDetails}>
            <View style={styles.payoutInfo}>
              <Text style={styles.payoutAmount}>{formatBalance(nextPayout.payout_amount)}</Text>
              
              {/* Payout Account Information */}
              {(nextPayout.payout_accounts || nextPayout.bank_accounts) && (
                <View style={styles.payoutAccountInfo}>
                  <Text style={styles.payoutAccountLabel}>To</Text>
                  <View style={styles.bankIconContainer}>
                    {(() => {
                      const bankName = nextPayout.payout_accounts?.bank_name || nextPayout.bank_accounts?.bank_name || '';
                      const bankIcon = getBankIconLogo(bankName);
                      
                      if (bankIcon.logoSvg) {
                        // Handle SVG components
                        return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                          width: 12,
                          height: 12,
                          fill: colors.textSecondary
                        });
                      } else if (bankIcon.logo) {
                        return (
                          <Image
                            source={bankIcon.logo}
                            style={styles.bankIcon}
                            resizeMode="contain"
                          />
                        );
                      } else {
                        // Fallback to a generic bank icon
                        return <View style={styles.bankIconFallback} />;
                      }
                    })()}
                  </View>
                  <Text style={styles.payoutAccountText}>
                    {(nextPayout.payout_accounts?.bank_name || nextPayout.bank_accounts?.bank_name || 'Unknown Bank')} 
                    **** {(nextPayout.payout_accounts?.account_number || nextPayout.bank_accounts?.account_number || '').slice(-4)} - 
                    {(nextPayout.payout_accounts?.account_name || nextPayout.bank_accounts?.account_name || 'Unknown Account')}
                  </Text>
                </View>
              )}
              
              {nextPayout.next_payout_date && (
                <CountdownTimer 
                  targetDate={nextPayout.next_payout_date} 
                  style={styles.dateContainer}
                />
              )}
            </View>
          </View>
        </View>
      </Pressable>
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
    marginTop: 15,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  payoutCard: {
    borderRadius: 16,
    padding: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  payoutCardContent: {
    padding: 1,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  payoutName: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
    maxWidth: '72%',
  },
  activeTag: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F8FCF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeTagText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  payoutDetails: {
    marginBottom: 1,
  },
  payoutInfo: {
    marginBottom: 10,
  },
  payoutAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  payoutAccountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  payoutAccountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bankIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bankIcon: {
    width: 12,
    height: 12,
  },
  bankIconFallback: {
    width: 12,
    height: 12,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  payoutAccountText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F8FCF4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
}); 