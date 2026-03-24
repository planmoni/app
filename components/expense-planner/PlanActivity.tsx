import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { Zap, Hand, ShoppingCart, ArrowRight, ArrowDown } from 'lucide-react-native';

interface PlanTransaction {
  id: string;
  type: 'auto_allocation' | 'manual_topup' | 'spending' | 'withdrawal';
  amount: number;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  created_at: string;
}

interface PlanActivityProps {
  transactions: PlanTransaction[];
}

export default function PlanActivity({ transactions }: PlanActivityProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'auto_allocation':
        return Zap;
      case 'manual_topup':
        return Hand;
      case 'spending':
        return ShoppingCart;
      case 'withdrawal':
        return ArrowRight;
      default:
        return ArrowDown;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'auto_allocation':
        return 'Auto Allocation';
      case 'manual_topup':
        return 'Manual Top-up';
      case 'spending':
        return 'Spending';
      case 'withdrawal':
        return 'Withdrawal';
      default:
        return 'Transaction';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const transactionDate = new Date(date);
    transactionDate.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - transactionDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (transactions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Activity</Text>
      <View style={styles.activityCard}>
        {transactions.map((transaction) => {
          const Icon = getTransactionIcon(transaction.type);
          const isDebit = transaction.type === 'spending' || transaction.type === 'withdrawal';
          
          return (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={[
                styles.iconContainer,
                isDebit ? styles.iconContainerDebit : styles.iconContainerCredit,
              ]}>
                <Icon 
                  size={20} 
                  color={isDebit ? '#EF4444' : '#22C55E'} 
                />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionType}>
                  {getTransactionLabel(transaction.type)}
                </Text>
                {transaction.description && (
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                )}
                <Text style={styles.transactionDate}>
                  {formatDate(transaction.created_at)}
                </Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                isDebit && styles.transactionAmountDebit,
              ]}>
                {isDebit ? '-' : '+'}₦{transaction.amount.toLocaleString('en-US')}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    activityCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    emptyContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 40,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    transactionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainerCredit: {
      backgroundColor: '#22C55E' + '20',
    },
    iconContainerDebit: {
      backgroundColor: '#EF4444' + '20',
    },
    transactionInfo: {
      flex: 1,
    },
    transactionType: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    transactionDescription: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 2,
    },
    transactionDate: {
      fontSize: getScaledFontSize(11, textSizeMultiplier),
      color: colors.textTertiary,
    },
    transactionAmount: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '700',
      color: '#22C55E',
    },
    transactionAmountDebit: {
      color: '#EF4444',
    },
  });
