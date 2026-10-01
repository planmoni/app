import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Image, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Transaction } from '@/hooks/useRealtimeTransactions';
import { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { formatCurrency } from '@/lib/formatters';
import TransactionModal from '@/components/TransactionModal';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import SkeletonBox from '@/components/SkeletonBox';

interface RecentTransaction {
  id: string;
  type: 'payout' | 'deposit' | 'withdrawal';
  planName?: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  date: string;
  time: string;
  description: string;
}

interface MostRecentPayoutsCardProps {
  transactions: Transaction[];
  payoutPlans: PayoutPlan[];
  isLoading?: boolean;
  onTransactionPress?: (transaction: any) => void;
}

export default function MostRecentPayoutsCard({ transactions, payoutPlans, isLoading = false, onTransactionPress }: MostRecentPayoutsCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { isAuthenticated } = useRequireAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const autoSlideTimer = useRef<number | null>(null);

  // Process transactions to get recent payouts, deposits, and withdrawals
  useEffect(() => {
    // Get all relevant transactions (payouts, deposits, withdrawals)
    const relevantTransactions = transactions
      .filter(tx => 
        (tx.type === 'payout' && tx.status === 'completed') ||
        (tx.type === 'deposit' && tx.status === 'completed') ||
        (tx.type === 'withdrawal' && tx.status === 'completed')
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5); // Get max 5 recent transactions

    const processedTransactions: RecentTransaction[] = relevantTransactions.map(tx => {
      let planName = '';
      let bankName = 'Unknown Bank';
      let accountNumber = '****';
      let description = '';

      if (tx.type === 'payout') {
        const plan = payoutPlans.find(p => p.id === tx.payout_plan_id);
        planName = plan?.name || 'Payout Plan';
        
        // Get bank info from the payout plan's linked account
        if (plan?.payout_accounts) {
          bankName = plan.payout_accounts.bank_name;
          accountNumber = plan.payout_accounts.account_number;
        } else if (plan?.bank_accounts) {
          bankName = plan.bank_accounts.bank_name;
          accountNumber = plan.bank_accounts.account_number;
        }
        description = 'Payout sent to';
      } else if (tx.type === 'deposit') {
        planName = 'Wallet Deposit';
        description = 'Deposit successful';
        // For deposits, we might not have bank info, so use a default
        bankName = 'Planmoni Wallet';
        accountNumber = '';
      } else if (tx.type === 'withdrawal') {
        planName = 'Emergency Withdrawal';
        
        // For emergency withdrawals, get account info from the plan's linked account
        const plan = payoutPlans.find(p => p.id === tx.payout_plan_id);
        if (plan) {
          // Get bank info from the payout plan's linked account
          if (plan.payout_accounts) {
            bankName = plan.payout_accounts.bank_name;
            const fullAccountNumber = plan.payout_accounts.account_number;
            accountNumber = fullAccountNumber && fullAccountNumber.length >= 4 
              ? `*** ${fullAccountNumber.slice(-4)}`
              : '****';
          } else if (plan.bank_accounts) {
            bankName = plan.bank_accounts.bank_name;
            const fullAccountNumber = plan.bank_accounts.account_number;
            accountNumber = fullAccountNumber && fullAccountNumber.length >= 4 
              ? `*** ${fullAccountNumber.slice(-4)}`
              : '****';
          }
        }
        
        // If we still don't have account info, try to get it from destination
        if (!bankName || bankName === 'Unknown Bank') {
          if (tx.destination && tx.destination !== 'bank_account') {
            // Try to extract bank name and account number from destination
            // Format is typically "BankName AccountNumber"
            const destParts = tx.destination.split(' ');
            if (destParts.length >= 2) {
              // Bank name is everything except the last part (account number)
              bankName = destParts.slice(0, -1).join(' ');
              const fullAccountNumber = destParts[destParts.length - 1];
              // Mask the account number showing only last 4 digits
              accountNumber = fullAccountNumber.length >= 4 
                ? `*** ${fullAccountNumber.slice(-4)}`
                : '****';
            } else if (destParts.length === 1) {
              // Fallback if only one part
              bankName = destParts[0];
              accountNumber = '****';
            }
          } else {
            // Final fallback for generic destination
            bankName = 'Bank Account';
            accountNumber = '****';
          }
        }
        
        // Update description to include the masked account info
        description = `Emergency withdrawal processed to ${bankName} ${accountNumber}`;
      }
      
      const date = new Date(tx.created_at);
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      // Format relative date
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const transactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffTime = today.getTime() - transactionDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let dateStr = '';
      if (diffDays === 0) {
        dateStr = 'Today at';
      } else if (diffDays === 1) {
        dateStr = 'Yesterday at';
      } else if (diffDays <= 7) {
        dateStr = `${diffDays} days ago at`;
      } else {
        // For older dates, show the actual date
        dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      }

      return {
        id: tx.id,
        type: tx.type,
        planName,
        amount: tx.amount,
        bankName,
        accountNumber,
        date: dateStr,
        time: timeStr,
        description,
      };
    });

    setRecentTransactions(processedTransactions);
  }, [transactions, payoutPlans]);

  // Auto-slide functionality
  useEffect(() => {
    if (recentTransactions.length <= 1) return;

    const startAutoSlide = () => {
      autoSlideTimer.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % recentTransactions.length);
      }, 6000); // Change slide every 4 seconds
    };

    startAutoSlide();

    return () => {
      if (autoSlideTimer.current) {
        clearInterval(autoSlideTimer.current);
      }
    };
  }, [recentTransactions.length]);

  // Animate slide changes with up slide effect
  useEffect(() => {
    // Reset animation to start from bottom
    slideAnimation.setValue(100);
    
    // Animate to center position
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, slideAnimation]);

  const handleCardPress = () => {
    router.push('/transactions');
    logAnalyticsEvent('view_all_transactions', { source: 'most_recent_card' });
  };

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show skeleton while first load is in progress
  if (isLoading && recentTransactions.length === 0) {
    return (
      <View style={{ marginTop: 0, marginBottom: Platform.OS === 'ios' ? 10 : 8 }}>
        <View style={{
          backgroundColor: isDark ? colors.card : '#FFFFFF',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 0.5,
          borderColor: colors.border,
          gap: 8,
        }}>
          <SkeletonBox width={140} height={18} borderRadius={6} />
          <SkeletonBox width="60%" height={12} borderRadius={6} />
        </View>
      </View>
    );
  }

  // Don't render if no recent transactions
  if (recentTransactions.length === 0) {
    return null;
  }

  const styles = createStyles(colors, isDark, textSizeMultiplier);
  const currentTransaction = recentTransactions[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        <Pressable style={styles.card} onPress={handleCardPress}>
          <Animated.View 
            style={[
              styles.cardContent,
              {
                transform: [
                  {
                    translateY: slideAnimation,
                  },
                ],
                opacity: slideAnimation.interpolate({
                  inputRange: [0, 50],
                  outputRange: [1, 20],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <View style={styles.amountRow}>
              <Text
                style={[
                  styles.amount,
                  {
                    color: currentTransaction.type === 'withdrawal' ? '#F97316' : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {currentTransaction.type === 'deposit' ? '+' : currentTransaction.type === 'withdrawal' ? '-' : ''}
                {formatCurrency(currentTransaction.amount)}
              </Text>
              <Text style={styles.dateTime} numberOfLines={1}>
                {currentTransaction.date} {currentTransaction.time}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.paymentLabel} numberOfLines={1}>
                {currentTransaction.description}
              </Text>
              {currentTransaction.type !== 'deposit' && currentTransaction.type !== 'withdrawal' && (
                <View style={styles.bankInfo}>
                  <View style={styles.bankLogo}>
                    {(() => {
                      const bankIcon = getBankIconLogo(currentTransaction.bankName);

                      if (bankIcon.logoSvg) {
                        return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                          width: 14,
                          height: 14,
                        });
                      }
                      if (bankIcon.logo) {
                        return (
                          <Image
                            source={bankIcon.logo}
                            style={{ width: 14, height: 14 }}
                            resizeMode="contain"
                          />
                        );
                      }
                      return (
                        <Text style={styles.bankInitials}>
                          {currentTransaction.bankName.substring(0, 2).toUpperCase()}
                        </Text>
                      );
                    })()}
                  </View>
                  <Text style={styles.bankName} numberOfLines={1}>
                    {currentTransaction.bankName}
                  </Text>
                  {currentTransaction.accountNumber ? (
                    <Text style={styles.accountNumber}>
                      **{currentTransaction.accountNumber.slice(-4)}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginTop: 0,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 2,
    paddingLeft: 8,
  },
  viewAllText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardContainer: {
    position: 'relative',
  },
  card: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardContent: {
    // Container for the animated content
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  planName: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 12,
    maxWidth: '60%',
  },
  amount: {
    fontSize: getScaledFontSize(18, textSizeMultiplier),
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    flexShrink: 1,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  bankLogo: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bankName: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  accountNumber: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  bankInitials: {
    fontSize: getScaledFontSize(9, textSizeMultiplier),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardFooter: {
    alignItems: 'center', // Center the date/time
  },
  dateContainer: {
    alignItems: 'flex-start',
  },
  dateTime: {
    fontSize: getScaledFontSize(11, textSizeMultiplier),
    color: colors.textTertiary,
    fontWeight: '500',
    flexShrink: 0,
  },
  // Remove pagination-related styles
  // pagination: {
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   marginTop: 12,
  //   gap: 6,
  // },
  // paginationDot: {
  //   width: 6,
  //   height: 6,
  //   borderRadius: 3,
  //   backgroundColor: colors.border,
  // },
  // paginationDotActive: {
  //   backgroundColor: colors.primary,
  //   width: 20,
  //   height: 6,
  //   borderRadius: 3,
  // },
  bankIconImage: {
    width: 20,
    height: 20,
  },
  bankIconFallback: {
    width: 20,
    height: 20,
    backgroundColor: colors.border,
    borderRadius: 4,
  },
}); 