import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Clock, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan } from '@/types/expense-planner';
import { getCategoryIcon } from '@/lib/expenseCategories';
import { getBudgetDuration, isBudgetStarted } from '@/lib/expensePlanUtils';

interface PlanDetailsInfoProps {
  plan: ExpensePlan;
  currentBalance: number;
  onViewBalance?: () => void;
}

export default function PlanDetailsInfo({ plan, currentBalance, onViewBalance }: PlanDetailsInfoProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  // Get all subcategory icons
  const getAllSubcategoryIcons = () => {
    if (!plan?.buckets || plan.buckets.length === 0) {
      return [];
    }

    return plan.buckets.map(bucket => {
      const Icon = getCategoryIcon(bucket.category_id);
      return { bucket, Icon };
    }).filter(item => item.Icon);
  };

  const subcategoryIcons = getAllSubcategoryIcons();

  // Calculate spending progress
  const totalBudget = plan?.total_budget || 0;
  const totalSpent = plan?.total_spent || 0;
  const percentageSpent = totalBudget > 0 
    ? ((totalSpent / totalBudget) * 100) 
    : 0;
  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  // Calculate budget duration
  const budgetDuration = plan?.start_date && plan?.end_date 
    ? getBudgetDuration(plan.start_date, plan.end_date) 
    : null;

  // Get funding method (check both direct field and metadata)
  const fundingMethod = plan?.funding_method || plan?.metadata?.funding_method || 'manual';
  
  // Get auto top-up details
  const autoTopupAmount = (plan as any)?.auto_topup_amount || (plan as any)?.metadata?.auto_topup_amount;
  const autoTopupFrequency = (plan as any)?.auto_topup_frequency || (plan as any)?.metadata?.auto_topup_frequency;
  
  // Get frequency label
  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return frequency?.charAt(0).toUpperCase() + frequency?.slice(1) || '';
    }
  };

  // Get start action
  const startAction = plan?.metadata?.start_action || plan?.start_action || 'wallet';
  const payoutAccountLabel = plan?.metadata?.payout_account_label || plan?.payout_account_label;
  const payoutAccountBankName = plan?.metadata?.payout_account_bank_name || plan?.payout_account_bank_name;
  
  // Check if budget has started
  const budgetStarted = plan?.start_date ? isBudgetStarted(plan.start_date) : false;

  // Calculate next funding countdown for auto plans (returns date string and amount)
  const getNextFundingCountdown = () => {
    // Check if auto top-up is enabled
    const autoTopupEnabled = (plan as any)?.auto_topup_enabled === true || 
                             (plan as any)?.metadata?.auto_topup_enabled === true;
    
    if (fundingMethod !== 'auto' || !autoTopupEnabled || !plan?.start_date) return null;
    
    const startDate = new Date(plan.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    const budgetStarted = today >= startDate;
    if (budgetStarted) return null;
    
    const todayForCalc = new Date();
    todayForCalc.setHours(0, 0, 0, 0);
    
    // Use auto_topup_next_date if available (most accurate)
    const autoTopupNextDate = (plan as any)?.auto_topup_next_date || 
                              (plan as any)?.metadata?.auto_topup_next_date;
    
    let nextDate: Date | null = null;
    let dateString: string | null = null;
    
    if (autoTopupNextDate) {
      nextDate = new Date(autoTopupNextDate);
      nextDate.setHours(0, 0, 0, 0);
      
      // Don't show if next date is today or in the past
      if (nextDate <= todayForCalc) return null;
      
      const daysUntil = Math.ceil((nextDate.getTime() - todayForCalc.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) return null;
      dateString = daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
    } else {
      // Fallback: calculate next funding date based on auto_topup_start_date and frequency
      const autoTopupStartDate = (plan as any)?.auto_topup_start_date || 
                                  (plan as any)?.metadata?.auto_topup_start_date;
      const autoTopupEndDate = (plan as any)?.auto_topup_end_date || 
                               (plan as any)?.metadata?.auto_topup_end_date;
      
      if (autoTopupStartDate) {
        const topupStart = new Date(autoTopupStartDate);
        topupStart.setHours(0, 0, 0, 0);
        
        // If start date is in the future, that's the next funding date
        if (topupStart > todayForCalc) {
          nextDate = topupStart;
          const endDate = autoTopupEndDate ? new Date(autoTopupEndDate) : null;
          if (endDate && topupStart > endDate) return null;
          const daysUntil = Math.ceil((topupStart.getTime() - todayForCalc.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 0) return null;
          dateString = daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
        } else {
          // Calculate next date based on frequency
          nextDate = new Date(topupStart);
          const endDate = autoTopupEndDate ? new Date(autoTopupEndDate) : null;
          
          // Get frequency for calculation
          const calcFrequency = (plan as any)?.auto_topup_frequency || 
                                 (plan as any)?.metadata?.auto_topup_frequency || 
                                 'weekly';
          
          // Find the next funding date that hasn't passed yet
          while (nextDate <= todayForCalc && (!endDate || nextDate <= endDate)) {
            if (calcFrequency === 'daily') {
              nextDate.setDate(nextDate.getDate() + 1);
            } else if (calcFrequency === 'weekly') {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (calcFrequency === 'monthly') {
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else {
              // Default to weekly
              nextDate.setDate(nextDate.getDate() + 7);
            }
          }
          
          // Don't show if next date is past end date or today
          if (endDate && nextDate > endDate) return null;
          if (nextDate <= todayForCalc) return null;
          
          const daysUntil = Math.ceil((nextDate.getTime() - todayForCalc.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 0) return null;
          dateString = daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
        }
      } else {
        // No auto top-up dates available
        return null;
      }
    }
    
    // Return object with date string and amount
    return {
      dateString,
      amount: autoTopupAmount || 0,
    };
  };

  const nextFundingInfo = getNextFundingCountdown();

  const formatBalance = (amount: number) => {
    if (!amount) return '₦0';
    return `₦${amount.toLocaleString('en-NG')}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <>
      {/* Subcategories with Icons */}
      {subcategoryIcons.length > 0 && (
        <View style={styles.subcategoriesCard}>
          <Text style={styles.sectionLabel}>Categories</Text>
          <View style={styles.subcategoriesGrid}>
            {subcategoryIcons.map(({ bucket, Icon }, index) => (
              <View key={bucket.id} style={styles.subcategoryItem}>
                <View style={styles.subcategoryIconContainer}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <Text style={styles.subcategoryName} numberOfLines={1}>
                  {bucket.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
       <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Spending Progress</Text>
          <Text style={styles.progressPercentage}>
            {Math.round(percentageSpent)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(Math.max(percentageSpent, 0), 100)}%`,
                backgroundColor:
                  percentageSpent >= 100
                    ? colors.primary
                    : percentageSpent >= 75
                    ? '#10B981'
                    : percentageSpent >= 50
                    ? '#F59E0B'
                    : percentageSpent >= 25
                    ? '#F97316'
                    : '#EF4444',
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Spent: {formatBalance(totalSpent)} / {formatBalance(plan.total_budget)}
          </Text>
          <Text style={styles.remainingText}>
            {formatBalance(remainingBudget)} remaining in budget
          </Text>
        </View>
      </View>

      {/* Budget Amount (hidden when started) */}
      {!budgetStarted && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Budget Amount</Text>
          <Text style={styles.infoValue}>{formatBalance(plan.total_budget)}</Text>
        </View>
      )}

      {/* Start Date - End Date */}
      {plan.start_date && plan.end_date && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Budget Period</Text>
          <Text style={styles.infoValue}>
            {formatDate(plan.start_date)} - {formatDate(plan.end_date)}
          </Text>
        </View>
      )}

      {/* Budget Duration */}
      {budgetDuration && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Duration</Text>
          <Text style={styles.infoValue}>
            {budgetDuration} {budgetDuration === 1 ? 'day' : 'days'}
          </Text>
        </View>
      )}

      {/* Funding Method & Start Rule (hidden when started) */}
      {!budgetStarted && (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Funding Method</Text>
            <Text style={styles.infoValue}>
              {fundingMethod === 'auto' && autoTopupAmount && autoTopupFrequency
                ? `Auto - ${formatBalance(autoTopupAmount)} ${getFrequencyLabel(autoTopupFrequency)}`
                : fundingMethod === 'auto' 
                ? 'Auto' 
                : 'Manual'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Plan Start Rule</Text>
            {startAction === 'wallet' ? (
              <View>
                <Text style={styles.infoValue}>
                  {budgetStarted ? 'Keep balance in Plan' : 'Move to wallet balance'}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.infoValue}>Auto payout to bank</Text>
                {payoutAccountLabel && (
                  <Text style={styles.payoutAccountText}>
                    {payoutAccountBankName} ••••{payoutAccountLabel.split('••••')[1] || ''}
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* Spending Progress */}
     

      {/* Next Funding Countdown (Auto plans) */}
      {nextFundingInfo && (
        <View style={styles.countdownCard}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={styles.countdownText}>
            Next funding: {nextFundingInfo.dateString}
            {nextFundingInfo.amount > 0 && ` - ${formatBalance(nextFundingInfo.amount)}`}
          </Text>
        </View>
      )}
    </>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    subcategoriesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 12,
      fontWeight: '600',
    },
    subcategoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    subcategoryItem: {
      alignItems: 'center',
      minWidth: 80,
    },
    subcategoryIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    subcategoryName: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.text,
      textAlign: 'center',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 6,
    },
    infoValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    payoutAccountText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 4,
    },
    availableBalanceLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 4,
    },
    availableBalanceText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '500',
    },
    progressCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    progressPercentage: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressInfo: {
      gap: 4,
    },
    progressText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    remainingText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.primary,
    },
    extraFundsText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: '#22C55E',
    },
    countdownCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countdownText: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });

