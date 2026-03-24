import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Clock, Calendar, ChevronDown, ShoppingCart, CreditCard, Settings, Info, ArrowDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan } from '@/types/expense-planner';
import { getCategoryIcon, getCategoryById, CATEGORIES } from '@/lib/expenseCategories';
import { getBudgetDuration, isBudgetStarted } from '@/lib/expensePlanUtils';
import { router } from 'expo-router';

interface PlanDetailsInfoProps {
  plan: ExpensePlan;
  currentBalance: number;
  onViewBalance?: () => void;
  onSpend?: () => void;
  onFundPlan?: () => void;
  onAdjustBudget?: () => void;
  budgetStarted?: boolean;
  totalBudget?: number;
  fundingMethod?: string;
}

export default function PlanDetailsInfo({ 
  plan, 
  currentBalance, 
  onViewBalance,
  onSpend,
  onFundPlan,
  onAdjustBudget,
  budgetStarted = false,
  totalBudget = 0,
  fundingMethod = 'manual'
}: PlanDetailsInfoProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Get categories and subcategories from plan
  const getCategoriesWithSubcategories = () => {
    // Read categories and subcategories directly from plan
    const planCategories = (plan as any)?.categories || [];
    const planSubcategories = (plan as any)?.subcategories || [];
    
    // If plan has categories/subcategories stored directly, use them
    if (Array.isArray(planCategories) && planCategories.length > 0) {
      // Group subcategories by category
      const grouped: Array<{
        categoryId: string;
        categoryName: string;
        categoryIcon: any;
        subcategories: Array<{ id: string; name: string }>;
      }> = [];
      
      planCategories.forEach((categoryId: string) => {
        const category = getCategoryById(categoryId);
        if (!category) return;
        
        // Get subcategories for this category
        const categorySubcategories = planSubcategories
          .filter((sub: any) => sub.category_id === categoryId)
          .map((sub: any) => {
            // Find the subcategory name from the category definition
            const subcategoryDef = category.subCategories?.find(s => s.id === sub.subcategory_id);
            return {
              id: sub.subcategory_id,
              name: subcategoryDef?.name || sub.subcategory_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            };
          });
        
        if (categorySubcategories.length > 0) {
          grouped.push({
            categoryId,
            categoryName: category.name,
            categoryIcon: category.icon,
            subcategories: categorySubcategories,
          });
        }
      });
      
      return grouped;
    }
    
    // Fallback: try to get from buckets (for backward compatibility)
    if (plan?.buckets && plan.buckets.length > 0) {
      const categoryMap = new Map<string, {
        categoryId: string;
        categoryName: string;
        categoryIcon: any;
        subcategories: Array<{ id: string; name: string }>;
      }>();
      
      plan.buckets.forEach(bucket => {
        const category = getCategoryById(bucket.category_id);
        if (!category) return;
        
        if (!categoryMap.has(bucket.category_id)) {
          categoryMap.set(bucket.category_id, {
            categoryId: bucket.category_id,
            categoryName: category.name,
            categoryIcon: category.icon,
            subcategories: [],
          });
        }
        
        const entry = categoryMap.get(bucket.category_id)!;
        // Find subcategory name
        const subcategoryDef = category.subCategories?.find(s => s.id === bucket.subcategory_id);
        const subcategoryName = subcategoryDef?.name || bucket.name || bucket.subcategory_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        
        // Only add if not already added
        if (!entry.subcategories.find(s => s.id === bucket.subcategory_id)) {
          entry.subcategories.push({
            id: bucket.subcategory_id,
            name: subcategoryName,
          });
        }
      });
      
      return Array.from(categoryMap.values());
    }
    
    return [];
  };

  const categoriesWithSubcategories = getCategoriesWithSubcategories();

  // Calculate spending progress
  const planTotalBudget = totalBudget || plan?.total_budget || 0;
  const totalSpent = plan?.total_spent || 0;
  const percentageSpent = planTotalBudget > 0 
    ? ((totalSpent / planTotalBudget) * 100) 
    : 0;
  const remainingBudget = Math.max(0, planTotalBudget - totalSpent);
  const percentageFunded = planTotalBudget > 0
    ? ((currentBalance / planTotalBudget) * 100)
    : 0;
  const remainingToFund = Math.max(0, planTotalBudget - currentBalance);

  // Calculate budget duration
  const budgetDuration = plan?.start_date && plan?.end_date 
    ? getBudgetDuration(plan.start_date, plan.end_date) 
    : null;

  // Get funding method (use prop if provided, otherwise check both direct field and metadata)
  const planFundingMethod = fundingMethod || plan?.funding_method || plan?.metadata?.funding_method || 'manual';
  
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
  
  // Check if budget has started (use prop if provided, otherwise calculate)
  const planBudgetStarted = budgetStarted !== undefined ? budgetStarted : (plan?.start_date ? isBudgetStarted(plan.start_date) : false);

  // Calculate next funding countdown for auto plans (returns date string and amount)
  const getNextFundingCountdown = () => {
    // Check if auto top-up is enabled
    const autoTopupEnabled = (plan as any)?.auto_topup_enabled === true || 
                             (plan as any)?.metadata?.auto_topup_enabled === true;
    
    if (planFundingMethod !== 'auto' || !autoTopupEnabled || !plan?.start_date) return null;
    
    const startDate = new Date(plan.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    const hasStarted = today >= startDate;
    if (hasStarted) return null;
    
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
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {planBudgetStarted ? 'Spending Progress' : 'Funding Progress'}
          </Text>
          <Text style={styles.progressPercentage}>
            {Math.round(planBudgetStarted ? percentageSpent : percentageFunded)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  Math.max(planBudgetStarted ? percentageSpent : percentageFunded, 0),
                  100
                )}%`,
                backgroundColor:
                  (planBudgetStarted ? percentageSpent : percentageFunded) >= 100
                    ? '#1E3A8A'
                    : (planBudgetStarted ? percentageSpent : percentageFunded) >= 75
                    ? '#1E3A8A'
                    : (planBudgetStarted ? percentageSpent : percentageFunded) >= 50
                    ? '#1E3A8A'
                    : (planBudgetStarted ? percentageSpent : percentageFunded) >= 25
                    ? '#1E3A8A'
                    : '#1E3A8A',
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          {planBudgetStarted ? (
            <>
              <Text style={styles.progressText}>
                Spent: {formatBalance(totalSpent)} / {formatBalance(planTotalBudget)}
              </Text>
              <Text style={styles.remainingText}>
                {remainingBudget > 0
                  ? `${formatBalance(remainingBudget)} remaining in budget`
                  : 'Budget fully spent'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.progressText}>
                Funded: {formatBalance(currentBalance)} / {formatBalance(planTotalBudget)}
              </Text>
              <Text style={styles.remainingText}>
                {remainingToFund > 0
                  ? `${formatBalance(remainingToFund)} remaining to add`
                  : 'Budget fully funded'}
              </Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.actionsCard}>
        {/* For partially funded budgets that have started, show only Spend button */}
        {planBudgetStarted && currentBalance > 0 && currentBalance < planTotalBudget ? (
          <Pressable 
            style={styles.actionButton}
            onPress={onSpend}
          >
            <Text style={styles.actionButtonText}>Spend</Text>
          </Pressable>
        ) : (
          <>
            {/* Add Funds Button - Only for Manual plans that are not fully funded */}
            {planFundingMethod === 'manual' && currentBalance < planTotalBudget ? (
              <Pressable 
                style={styles.actionButton}
                onPress={onFundPlan}
              >
                <ArrowDown size={20} color={isDark ? colors.text : colors.primary} />
                <Text style={styles.actionButtonText}>Add Funds</Text>
              </Pressable>
            ) : planFundingMethod === 'manual' && currentBalance >= planTotalBudget ? (
              // Plan is fully funded, don't show button
              null
            ) : (
              <View style={styles.disabledActionButton}>
                <ArrowDown size={20} color={colors.textTertiary} />
                <View style={styles.disabledActionButtonContent}>
                  <Text style={styles.disabledActionButtonText}>Add Funds</Text>
                  <Text style={styles.disabledActionButtonReason}>
                    Auto-funded plans are funded automatically
                  </Text>
                </View>
              </View>
            )}

            {/* Adjust Budget Button - Only show if budget hasn't started */}
          </>
        )}
      </View>

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

      {/* View Plan Details Button */}
      <Pressable
        style={styles.viewDetailsButton}
        onPress={() => router.push(`/expense-planner/${plan.id}/details`)}
      >
        <Info size={18} color= {isDark ? colors.text : colors.primary} />
        <Text style={styles.viewDetailsButtonText}>View Plan Details</Text>
        <ArrowRight size={18} color={isDark ? colors.text : colors.primary} />
      </Pressable>
    </>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    categoriesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      marginBottom: 16,
      fontWeight: '600',
    },
    categoryGroup: {
      marginBottom: 20,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    categoryIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    categoryName: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    subcategoriesList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginLeft: 42, // Align with category name (icon width + margin)
    },
    subcategoryChip: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subcategoryChipText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
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
      color: isDark ? colors.text : colors.primary,
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
      color: colors.textSecondary,
    },
    showAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      paddingVertical: 12,
      gap: 6,
    },
    showAllButtonText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
    chevronIcon: {
      transform: [{ rotate: '0deg' }],
    },
    chevronIconRotated: {
      transform: [{ rotate: '180deg' }],
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
    actionsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
    },
    actionButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: isDark ? colors.text : colors.primary,
    },
    actionButtonTextSecondary: {
      color: isDark ? colors.text : colors.primary,
    },
    disabledActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.6,
    },
    disabledActionButtonContent: {
      flex: 1,
    },
    disabledActionButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.textTertiary,
    },
    disabledActionButtonReason: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textTertiary,
      marginTop: 2,
    },
    viewDetailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    viewDetailsButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: isDark ? colors.text : colors.primary,
      flex: 1,
      textAlign: 'center',
    },
  });

