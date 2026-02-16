import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { formatCurrency } from '@/lib/formatters';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';

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
  onTransactionPress?: (transaction: any) => void;
}

const MostRecentPayoutsCard = ({ onTransactionPress }: MostRecentPayoutsCardProps) => {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { isAuthenticated } = useRequireAuth();
  const { transactions } = useRealtimeTransactions();
  const { payoutPlans } = useRealtimePayoutPlans();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const autoSlideTimer = useRef<number | null>(null);

  const styles = useMemo(() => createStyles(colors, isDark, textSizeMultiplier), [colors, isDark, textSizeMultiplier]);

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
            const destParts = tx.destination.split(' ');
            if (destParts.length >= 2) {
              bankName = destParts.slice(0, -1).join(' ');
              const fullAccountNumber = destParts[destParts.length - 1];
              accountNumber = fullAccountNumber.length >= 4 
                ? `*** ${fullAccountNumber.slice(-4)}`
                : '****';
            } else if (destParts.length === 1) {
              bankName = destParts[0];
              accountNumber = '****';
            }
          } else {
            bankName = 'Bank Account';
            accountNumber = '****';
          }
        }
        
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
      }, 6000);
    };

    startAutoSlide();

    return () => {
      if (autoSlideTimer.current) {
        clearInterval(autoSlideTimer.current);
      }
    };
  }, [recentTransactions.length]);

  // Animate slide changes
  useEffect(() => {
    slideAnimation.setValue(100);
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, slideAnimation]);

  const handleCardPress = () => {
    const currentTransaction = recentTransactions[currentIndex];
    if (currentTransaction && onTransactionPress) {
      const originalTransaction = transactions.find(tx => tx.id === currentTransaction.id);
      if (originalTransaction) {
        onTransactionPress(originalTransaction);
      }
    }
  };

  const handleViewAllTransactions = () => {
    router.push('/transactions');
    logAnalyticsEvent('view_all_transactions', { source: 'most_recent_card' });
  };

  if (!isAuthenticated || recentTransactions.length === 0) {
    return null;
  }

  const currentTransaction = recentTransactions[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Most Recent</Text>
        <Pressable style={styles.viewAllButton} onPress={handleViewAllTransactions}>
          <Text style={styles.viewAllText}>See all transactions</Text>
        </Pressable>
      </View>
      <View style={styles.cardContainer}>
        <Pressable style={styles.card} onPress={handleCardPress}>
          <Animated.View 
            style={[
              styles.cardContent,
              {
                transform: [{ translateY: slideAnimation }],
                opacity: slideAnimation.interpolate({
                  inputRange: [0, 50],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.amountContainer}>
                <Text style={[
                  styles.amount,
                  { 
                    color: currentTransaction.type === 'deposit' 
                      ? colors.text 
                      : currentTransaction.type === 'withdrawal'
                      ? '#F97316'
                      : colors.text
                  }
                ]}>
                  {currentTransaction.type === 'deposit' ? '+' : currentTransaction.type === 'withdrawal' ? '-' : ''}
                  {formatCurrency(currentTransaction.amount)}
                </Text>
                <Text style={styles.dateTime}>
                  {currentTransaction.date} {currentTransaction.time}
                </Text>
              </View>
            </View>
            
            <View style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentLabel}>{currentTransaction.description}</Text>
                {currentTransaction.type !== 'deposit' && currentTransaction.type !== 'withdrawal' && (
                  <View style={styles.bankInfo}>
                    <View style={styles.bankLogo}>
                      {(() => {
                        const bankIcon = getBankIconLogo(currentTransaction.bankName);
                        if (bankIcon.logoSvg) {
                          return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                            width: 16,
                            height: 16,
                          });
                        } else if (bankIcon.logo) {
                          return (
                            <Image
                              source={bankIcon.logo}
                              style={{ width: 16, height: 16 }}
                              resizeMode="contain"
                            />
                          );
                        } else {
                          return (
                            <Text style={styles.bankInitials}>
                              {currentTransaction.bankName.substring(0, 2).toUpperCase()}
                            </Text>
                          );
                        }
                      })()}
                    </View>
                    <Text style={styles.bankName}>{currentTransaction.bankName}</Text>
                    {currentTransaction.accountNumber && (
                      <Text style={styles.accountNumber}>**{currentTransaction.accountNumber.slice(-4)}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginTop: Platform.OS === 'ios' ? 20 : 1,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  viewAllButton: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 30,
  },
  viewAllText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.text,
    fontWeight: '500',
  },
  cardContainer: {
    position: 'relative',
  },
  card: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical:15,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardContent: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  amount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 25 : 20, textSizeMultiplier),
    fontWeight: '600',
    textAlign: 'left',
    flex: 0,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'space-between',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  paymentLabel: {
    fontSize: getScaledFontSize(15, textSizeMultiplier),
    color: colors.textSecondary,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: '90%',
  },
  bankLogo: {
    width: Platform.OS === 'ios' ? 24 : 20,
    height: Platform.OS === 'ios' ? 24 : 20,
    marginRight: Platform.OS === 'ios' ? 3 : 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bankName: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginRight: 1,
    flexShrink: 1,
  },
  accountNumber: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  bankInitials: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  dateTime: {
    fontSize: getScaledFontSize(13, textSizeMultiplier),
    marginTop: 5,
    color: colors.textSecondary,
    fontWeight: '400',
    textAlign: 'right',
    flex: 0,
  },
});

export default React.memo(MostRecentPayoutsCard);
