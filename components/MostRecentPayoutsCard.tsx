import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { formatCurrency } from '@/lib/formatters';
import TransactionModal from '@/components/TransactionModal';

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

export default function MostRecentPayoutsCard({ onTransactionPress }: MostRecentPayoutsCardProps) {
  const { colors, isDark } = useTheme();
  const { transactions } = useRealtimeTransactions();
  const { payoutPlans } = useRealtimePayoutPlans();
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
        description = 'Paid to';
      } else if (tx.type === 'deposit') {
        planName = 'Wallet Deposit';
        description = 'Added to your Planmoni wallet';
        // For deposits, we might not have bank info, so use a default
        bankName = 'Planmoni Wallet';
        accountNumber = '';
      } else if (tx.type === 'withdrawal') {
        planName = 'Emergency Withdrawal';
        description = 'Emergency withdrawal processed to';
        // For withdrawals, try to get bank info from destination
        if (tx.destination) {
          // Try to extract bank name from destination
          const destParts = tx.destination.split(' ');
          if (destParts.length > 0) {
            bankName = destParts[0];
            accountNumber = destParts[destParts.length - 1] || '****';
          }
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
        dateStr = 'Today';
      } else if (diffDays === 1) {
        dateStr = 'Yesterday';
      } else if (diffDays <= 7) {
        dateStr = `${diffDays} days ago`;
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
    slideAnimation.setValue(50);
    
    // Animate to center position
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 300,
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

  // Don't render if no recent payouts
  if (recentTransactions.length === 0) {
    return null;
  }

  const styles = createStyles(colors, isDark);
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
            <View style={styles.cardHeader}>
              <View style={styles.amountContainer}>
                <Text style={[
                  styles.amount,
                  { 
                    color: currentTransaction.type === 'deposit' 
                      ? colors.text // Green for deposits
                      : currentTransaction.type === 'withdrawal'
                      ? '#F97316' // Orange for withdrawals  
                      : '#22C55E' // Default for payouts
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
                <Text style={styles.paymentLabel}>{currentTransaction.description} </Text>
                {currentTransaction.type !== 'deposit' && (
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

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginTop: 15,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  cardContainer: {
    position: 'relative',
  },
  card: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical:15,
    borderWidth: 1,
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
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 12,
    maxWidth: '60%',
  },
  amount: {
    fontSize: 25,
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
    fontSize: 15,
    color: colors.textSecondary,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Prevent wrapping
    maxWidth: '90%',
  },
  bankLogo: {
    width: 24,
    height: 24,
    marginRight: 3,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // Prevent logo from shrinking
  },
  bankName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginRight: 1, // Add small margin between name and account number
    flexShrink: 1, // Allow name to shrink if needed
  },
  accountNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 0, // Prevent account number from shrinking
  },
  bankInitials: {
    fontSize: 14,
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
    fontSize: 14,
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