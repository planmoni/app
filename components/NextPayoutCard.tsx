import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import CountdownTimer from '@/components/CountdownTimer';
import { getBankIconLogo } from '@/lib/bankIcons';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';

interface NextPayoutCardProps {
  nextPayout: any;
}

export default function NextPayoutCard({ nextPayout }: NextPayoutCardProps) {
  const { colors, isDark } = useTheme();
  const { showBalances } = useBalance();
  const { textSizeMultiplier } = useTextSize();
  const { isAuthenticated } = useRequireAuth();
  const [nextPayoutAmount, setNextPayoutAmount] = useState<number | null>(null);

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  };

  // Fetch custom payout amount for the next payout date if it's a custom plan
  useEffect(() => {
    const fetchNextPayoutAmount = async () => {
      if (!nextPayout || nextPayout.frequency !== 'custom' || !nextPayout.next_payout_date) {
        setNextPayoutAmount(null);
        return;
      }

      try {
        const nextDateString = new Date(nextPayout.next_payout_date).toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('custom_payout_dates')
          .select('amount')
          .eq('payout_plan_id', nextPayout.id)
          .eq('payout_date', nextDateString)
          .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

        if (error) {
          // Only log non-PGRST116 errors (PGRST116 is expected when no rows found)
          if (error.code !== 'PGRST116') {
            console.error('Error fetching next payout amount:', error);
          }
          // Fallback to plan's payout_amount
          setNextPayoutAmount(nextPayout.payout_amount);
          return;
        }

        if (data && data.amount !== null && data.amount !== undefined) {
          const amount = parseFloat(data.amount.toString());
          setNextPayoutAmount(amount > 0 ? amount : nextPayout.payout_amount);
        } else {
          // If no custom amount found, use plan's payout_amount
          setNextPayoutAmount(nextPayout.payout_amount);
        }
      } catch (error) {
        // Only log unexpected errors
        console.error('Unexpected error fetching next payout amount:', error);
        setNextPayoutAmount(nextPayout.payout_amount);
      }
    };

    fetchNextPayoutAmount();
  }, [nextPayout?.id, nextPayout?.frequency, nextPayout?.next_payout_date, nextPayout?.payout_amount]);

  const handleViewPayout = (id: string) => {
    router.push({
      pathname: '/view-payout',
      params: { id }
    });
    logAnalyticsEvent('view_payout', { payout_id: id });
  }

  // Don't render if user is not authenticated or no next payout
  if (!isAuthenticated || !nextPayout) return null;

  const styles = createStyles(colors, isDark, textSizeMultiplier);

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
                {nextPayout.status === 'active' ? 'Next Payout' : 'Paused'}
              </Text>
            </View>
          </View>
          
          <View style={styles.payoutDetails}>
            <View style={styles.payoutInfo}>
              <Text style={styles.payoutAmount}>
                {formatBalance(nextPayoutAmount !== null ? nextPayoutAmount : nextPayout.payout_amount)}
              </Text>
              
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

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number ) => StyleSheet.create({
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
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  payoutCard: {
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 15 : 5,
    backgroundColor: colors.card,
    borderWidth: 0.5,
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
    marginBottom: Platform.OS === 'ios' ? 5 : -1,
  },
  payoutName: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '400',
    color: colors.text,
    maxWidth: '72%',
  },
  activeTag: {
    backgroundColor: isDark ? colors.accent : colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeTagText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.primary,
    fontWeight: '600',
  },
  payoutDetails: {
    marginBottom: 1,
  },
  payoutInfo: {
    marginBottom: 10,
  },
  payoutAmount: {
    fontSize: getScaledFontSize(24, textSizeMultiplier),
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
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
    fontSize: getScaledFontSize(14, textSizeMultiplier),
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