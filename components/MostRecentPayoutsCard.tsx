import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Image, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { formatCurrency } from '@/lib/formatters';
import TransactionModal from '@/components/TransactionModal';
import { router } from 'expo-router';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface RecentTransaction {
  id: string;
  type: 'payout' | 'deposit' | 'withdrawal' | 'expense_plan_topup' | 'referral_bonus';
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

export default function MostRecentPayoutsCard({ onTransactionPress }: MostRecentPayoutsCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { isAuthenticated } = useRequireAuth();
  const { transactions } = useRealtimeTransactions();
  const { payoutPlans } = useRealtimePayoutPlans();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const autoSlideTimer = useRef<number | null>(null);

  // Process transactions to get recent payouts, deposits, withdrawals, and budget top-ups
  useEffect(() => {
    // Get all relevant transactions (payouts, deposits, withdrawals, expense_plan_topup)
    const relevantTransactions = transactions
      .filter(tx => 
        (tx.type === 'payout' && tx.status === 'completed') ||
        (tx.type === 'deposit' && tx.status === 'completed') ||
        (tx.type === 'withdrawal' && tx.status === 'completed') ||
        (tx.type === 'expense_plan_topup' && tx.status === 'completed')
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
        description = 'Added to your Planmoni wallet';
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
      } else if (tx.type === 'expense_plan_topup') {
        // For budget top-ups, get plan name from source or destination
        planName = 'Budget Top-Up';
        description = 'Funds deducted from wallet to budget plan';
        bankName = 'Planmoni Wallet';
        accountNumber = '';
        
        // Try to get plan name from source or destination if available
        if (tx.source && tx.source !== 'wallet' && tx.source !== 'Wallet') {
          planName = tx.source;
        } else if (tx.destination && tx.destination !== 'wallet' && tx.destination !== 'Wallet') {
          planName = tx.destination;
        }
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

  // Handle card press to open transaction modal
  const handleCardPress = () => {
    const currentTransaction = recentTransactions[currentIndex];
    if (currentTransaction && onTransactionPress) {
      // Find the original transaction data
      const originalTransaction = transactions.find(tx => 
        tx.id === currentTransaction.id
      );
      
      if (originalTransaction) {
        onTransactionPress(originalTransaction);
      }
    }
  };

  // Handle view all transactions
  const handleViewAllTransactions = () => {
    router.push('/transactions');
    logAnalyticsEvent('view_all_transactions', { source: 'most_recent_card' });
  };

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Don't render if no recent payouts
  if (recentTransactions.length === 0) {
    return null;
  }

  const styles = createStyles(colors, isDark, textSizeMultiplier);
  const currentTransaction = recentTransactions[currentIndex];

  return (
    <View style={styles.container}>
      {/* <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Most Recent</Text>
        <Pressable style={styles.viewAllButton} onPress={handleViewAllTransactions}>
          <Text style={styles.viewAllText}>View all</Text>
        </Pressable>
      </View> */}
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
            <View style={styles.cardHeader}>
              <View style={styles.amountContainer}>
                <Text style={[
                  styles.amount,
                  { 
                    color: currentTransaction.type === 'deposit' || currentTransaction.type === 'expense_plan_topup'
                      ? colors.text // Green for deposits and budget top-ups
                      : currentTransaction.type === 'withdrawal'
                      ? '#F97316' // Orange for withdrawals  
                      : colors.text // Default for payouts
                  }
                ]}>
                  {currentTransaction.type === 'deposit' || currentTransaction.type === 'expense_plan_topup' ? '' : currentTransaction.type === 'withdrawal' ? '-' : ''}
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
                {currentTransaction.type !== 'deposit' && currentTransaction.type !== 'withdrawal' && currentTransaction.type !== 'expense_plan_topup' && (
                  <View style={styles.bankInfo}>
                    <View style={styles.bankLogo}>
                      {(() => {
                        const bankIcon = getBankIconLogo(currentTransaction.bankName);
                        
                        if (bankIcon.logoSvg) {
                          // Handle SVG components
                          return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                            width: 16,
                            height: 16,
                          });
                        } else if (bankIcon.logo) {
                          // Handle PNG/JPG images
                          return (
                            <Image
                              source={bankIcon.logo}
                              style={{ width: 16, height: 16 }}
                              resizeMode="contain"
                            />
                          );
                        } else {
                          // Fallback to bank name initials
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
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginTop: Platform.OS === 'ios' ? 1 : 1,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.text,
    fontWeight: '600',
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
  
  
    overflow: 'hidden', // Hide content that slides outside the card
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 25 : 20, textSizeMultiplier),
    fontWeight: '700',
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
    flexWrap: 'wrap', // Prevent wrapping
    maxWidth: '90%',
  },
  bankLogo: {
    width: Platform.OS === 'ios' ? 24 : 20,
    height: Platform.OS === 'ios' ? 24 : 20,
    marginRight: Platform.OS === 'ios' ? 3 : 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // Prevent logo from shrinking
  },
  bankName: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginRight: 1, // Add small margin between name and account number
    flexShrink: 1, // Allow name to shrink if needed
  },
  accountNumber: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 0, // Prevent account number from shrinking
  },
  bankInitials: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cardFooter: {
    alignItems: 'center', // Center the date/time
  },
  dateContainer: {
    alignItems: 'flex-start',
  },
  dateTime: {
    fontSize: getScaledFontSize(13, textSizeMultiplier),
    marginTop: 5,
    color: colors.textSecondary,
    fontWeight: '400',
    textAlign: 'right', // Change from 'center' to 'right'
    flex: 0,
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