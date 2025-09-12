import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { getBankIconLogo } from '@/lib/bankIcons';
import { formatCurrency } from '@/lib/formatters';
import TransactionModal from '@/components/TransactionModal';

interface RecentPayout {
  id: string;
  planName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  date: string;
  time: string;
}

interface MostRecentPayoutsCardProps {
  onTransactionPress?: (transaction: any) => void;
}

export default function MostRecentPayoutsCard({ onTransactionPress }: MostRecentPayoutsCardProps) {
  const { colors, isDark } = useTheme();
  const { transactions } = useRealtimeTransactions();
  const { payoutPlans } = useRealtimePayoutPlans();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentPayouts, setRecentPayouts] = useState<RecentPayout[]>([]);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const autoSlideTimer = useRef<number | null>(null);

  // Process transactions to get recent payouts
  useEffect(() => {
    const payoutTransactions = transactions
      .filter(tx => tx.type === 'payout' && tx.status === 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10); // Get max 5 recent payouts

    const processedPayouts: RecentPayout[] = payoutTransactions.map(tx => {
      const plan = payoutPlans.find(p => p.id === tx.payout_plan_id);
      const planName = plan?.name || 'Payout Plan';
      
      // Get bank info from the payout plan's linked account
      let bankName = 'Unknown Bank';
      let accountNumber = '****';
      
      if (plan?.payout_accounts) {
        bankName = plan.payout_accounts.bank_name;
        accountNumber = plan.payout_accounts.account_number;
      } else if (plan?.bank_accounts) {
        bankName = plan.bank_accounts.bank_name;
        accountNumber = plan.bank_accounts.account_number;
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
      const payoutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffTime = today.getTime() - payoutDate.getTime();
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
        planName,
        amount: tx.amount,
        bankName,
        accountNumber,
        date: dateStr,
        time: timeStr,
      };
    });

    setRecentPayouts(processedPayouts);
  }, [transactions, payoutPlans]);

  // Auto-slide functionality
  useEffect(() => {
    if (recentPayouts.length <= 1) return;

    const startAutoSlide = () => {
      autoSlideTimer.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % recentPayouts.length);
      }, 8000); // Change slide every 4 seconds
    };

    startAutoSlide();

    return () => {
      if (autoSlideTimer.current) {
        clearInterval(autoSlideTimer.current);
      }
    };
  }, [recentPayouts.length]);

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
    const currentPayout = recentPayouts[currentIndex];
    if (currentPayout && onTransactionPress) {
      // Find the original transaction data
      const originalTransaction = transactions.find(tx => 
        tx.id === currentPayout.id && tx.type === 'payout' && tx.status === 'completed'
      );
      
      if (originalTransaction) {
        onTransactionPress(originalTransaction);
      }
    }
  };

  // Don't render if no recent payouts
  if (recentPayouts.length === 0) {
    return null;
  }

  const styles = createStyles(colors, isDark);
  const currentPayout = recentPayouts[currentIndex];

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
                  outputRange: [10, 40],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.amount}>{formatCurrency(currentPayout.amount)}</Text>
            </View>
            
            <View style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentLabel}>Transfer sent to </Text>
                <View style={styles.bankInfo}>
                  <View style={styles.bankLogo}>
                    {(() => {
                      const bankIcon = getBankIconLogo(currentPayout.bankName);
                      
                      if (bankIcon.logoSvg) {
                        // Handle SVG components
                        return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                          width: 20,
                          height: 20,
                          fill: colors.textSecondary
                        });
                      } else if (bankIcon.logo) {
                        return (
                          <Image
                            source={bankIcon.logo}
                            style={styles.bankIconImage}
                            resizeMode="contain"
                          />
                        );
                      } else {
                        // Fallback to a generic bank icon
                        return <View style={styles.bankIconFallback} />;
                      }
                    })()}
                  </View>
                  <Text style={styles.bankDetails}>
                    {currentPayout.bankName.slice(0,20)} ***{currentPayout.accountNumber.slice(-4)}
                  </Text>
                </View>
              </View>
              <Text style={styles.dateTime}>
                {currentPayout.date} {currentPayout.time}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 20,
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
    paddingVertical: 10,
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
    color: '#10B981',
    textAlign: 'left',
    flex: 0,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  paymentLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  cardFooter: {
    alignItems: 'center', // Center the date/time
  },
  dateContainer: {
    alignItems: 'flex-start',
  },
  dateTime: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
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