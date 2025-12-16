import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan } from '@/types/expense-planner';
import { getCategoryIcon, getCategoryById, CATEGORIES } from '@/lib/expenseCategories';
import { 
  getDaysRemaining, 
  isBudgetStarted, 
  formatDateRange, 
  formatDaysRemaining,
  getBudgetDuration,
  getDraftResumeStep
} from '@/lib/expensePlanUtils';
import { Trash2, Clock, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useHaptics } from '@/hooks/useHaptics';

interface ExpensePlanCardProps {
  plan: ExpensePlan;
  onPress: () => void;
  onDelete?: () => void;
}

export default function ExpensePlanCard({ plan, onPress, onDelete }: ExpensePlanCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { deleteExpensePlan, fetchExpensePlans } = useExpensePlans();
  const haptics = useHaptics();


  // Get funding status (default to plan status if not calculated)
  const fundingStatus = plan.funding_status || (plan.status === 'draft' ? 'draft' : 'unfunded');

  // Get status tag colors and label
  const getStatusTagStyle = () => {
    switch (fundingStatus) {
      case 'draft':
        return {
          backgroundColor: isDark ? '#3A3A3A' : '#E5E5E5',
          textColor: isDark ? '#B0B0B0' : '#6B6B6B',
          label: 'Draft',
        };
      case 'unfunded':
        return {
          backgroundColor: isDark ? '#2A3A4A' : '#E8F0F5',
          textColor: isDark ? '#7FA8C4' : '#5A8AA8',
          label: 'Unfunded',
        };
      case 'partially_funded':
        return {
          backgroundColor: isDark ? '#4A3A2A' : '#FFF4E6',
          textColor: isDark ? '#D4A574' : '#D97706',
          label: 'Partially Funded',
        };
      case 'funded':
        return {
          backgroundColor: colors.backgroundTertiary,
          textColor: colors.primary,
          label: 'Funded',
        };
      default:
        return {
          backgroundColor: isDark ? '#3A3A3A' : '#E5E5E5',
          textColor: isDark ? '#B0B0B0' : '#6B6B6B',
          label: plan.status,
        };
    }
  };

  const statusTag = getStatusTagStyle();
  
  // If plan is unfunded but has some funds, show percentage funded instead
  const getStatusLabel = () => {
    if (fundingStatus === 'unfunded' && currentBalance > 0) {
      return `${Math.round(percentageFunded)}% funded`;
    }
    return statusTag.label;
  };

  // Get unique category icons and names (max 3)
  // This should work for all plans regardless of funding status
  const getCategoryIcons = () => {
    if (!plan.buckets || plan.buckets.length === 0) {
      return [];
    }

    const uniqueCategories = new Set<string>();
    const icons: Array<{ categoryId: string; Icon: any; categoryName: string }> = [];

    for (const bucket of plan.buckets) {
      if (uniqueCategories.size >= 3) break;
      
      // Ensure bucket has category_id
      if (!bucket.category_id) {
        continue;
      }
      
      if (!uniqueCategories.has(bucket.category_id)) {
        const category = getCategoryById(bucket.category_id);
        if (category && category.icon) {
          const Icon = category.icon;
          // Verify icon is a valid component (function or React component)
          if (Icon && (typeof Icon === 'function' || typeof Icon === 'object')) {
            uniqueCategories.add(bucket.category_id);
            icons.push({ 
              categoryId: bucket.category_id, 
              Icon,
              categoryName: category.name
            });
          }
        }
      }
    }

    return icons;
  };

  // Get selected subcategories with their names
  const getSelectedSubcategories = () => {
    if (!plan.buckets || plan.buckets.length === 0) {
      return [];
    }

    const subcategories: Array<{ categoryId: string; subcategoryId: string; subcategoryName: string; categoryName: string }> = [];

    for (const bucket of plan.buckets) {
      // Ensure bucket has required fields
      if (!bucket.category_id || !bucket.subcategory_id) {
        continue;
      }
      
      const category = getCategoryById(bucket.category_id);
      if (category) {
        const subcategory = category.subCategories.find(sub => sub.id === bucket.subcategory_id);
        if (subcategory) {
          subcategories.push({
            categoryId: bucket.category_id,
            subcategoryId: bucket.subcategory_id,
            subcategoryName: subcategory.name,
            categoryName: category.name
          });
        }
      }
    }

    return subcategories;
  };

  const categoryIcons = getCategoryIcons();
  const selectedSubcategories = getSelectedSubcategories();

  // Calculate progress percentage
  const percentageUsed = plan.total_budget > 0 ? (plan.total_spent / plan.total_budget) * 100 : 0;
  
  // Calculate percentage funded (current_balance / total_budget)
  const currentBalance = (plan as any).current_balance || 0;
  const percentageFunded = plan.total_budget > 0 ? (currentBalance / plan.total_budget) * 100 : 0;
  
  // Calculate remaining amount to add
  const remainingToAdd = Math.max(0, plan.total_budget - currentBalance);
  
  // Calculate extra funds (over-funded)
  const extraFunds = Math.max(0, currentBalance - plan.total_budget);
  
  // Calculate next funding countdown for auto plans
  const fundingMethod = plan.funding_method || (plan as any).metadata?.funding_method || 'manual';
  const payoutSchedule = (plan as any).payout_schedule || 'weekly';
  const requiredPerCycle = (plan as any).required_per_cycle || 0;
  
  // Calculate next funding date for auto plans
  const getNextFundingCountdown = () => {
    // Check if auto top-up is enabled
    const autoTopupEnabled = (plan as any).auto_topup_enabled === true || 
                             (plan as any).metadata?.auto_topup_enabled === true;
    
    if (fundingMethod !== 'auto' || !autoTopupEnabled || !plan.start_date || budgetStarted) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use auto_topup_next_date if available (most accurate - should be tomorrow for first funding)
    const autoTopupNextDate = (plan as any).auto_topup_next_date || 
                               (plan as any).metadata?.auto_topup_next_date;
    if (autoTopupNextDate) {
      const nextDate = new Date(autoTopupNextDate);
      nextDate.setHours(0, 0, 0, 0);
      
      // Don't show if next date is today or in the past
      if (nextDate <= today) return null;
      
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) return null;
      return daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
    }
    
    // Fallback: use auto_topup_start_date (should be tomorrow for first funding)
    const autoTopupStartDate = (plan as any).auto_topup_start_date || 
                                (plan as any).metadata?.auto_topup_start_date;
    const autoTopupFrequency = (plan as any).auto_topup_frequency || 
                                (plan as any).metadata?.auto_topup_frequency || 
                                'weekly';
    const autoTopupEndDate = (plan as any).auto_topup_end_date || 
                             (plan as any).metadata?.auto_topup_end_date;
    
    if (autoTopupStartDate) {
      const startDate = new Date(autoTopupStartDate);
      startDate.setHours(0, 0, 0, 0);
      
      // If start date is in the future, that's the next funding date
      if (startDate > today) {
        const endDate = autoTopupEndDate ? new Date(autoTopupEndDate) : null;
        // Check if it's before end date
        if (endDate && startDate > endDate) return null;
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 0) return null;
        return daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
      }
      
      // Calculate next date based on frequency from start date
      let nextDate = new Date(startDate);
      const endDate = autoTopupEndDate ? new Date(autoTopupEndDate) : null;
      
      // Find the next funding date that hasn't passed yet
      while (nextDate <= today && (!endDate || nextDate <= endDate)) {
        if (autoTopupFrequency === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (autoTopupFrequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (autoTopupFrequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
          // Default to weekly
          nextDate.setDate(nextDate.getDate() + 7);
        }
      }
      
      // Don't show if next date is past end date or today
      if (endDate && nextDate > endDate) return null;
      if (nextDate <= today) return null;
      
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) return null;
      return daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
    }
    
    // No auto top-up dates available - don't show next funding
    return null;
  };
  
  const nextFundingCountdown = getNextFundingCountdown();

  // Date calculations
  const budgetStarted = isBudgetStarted(plan.start_date);
  const daysRemaining = getDaysRemaining(plan.start_date, plan.end_date);
  const dateRange = formatDateRange(plan.start_date, plan.end_date);
  const daysRemainingText = formatDaysRemaining(daysRemaining);
  
  // Calculate days until start date for better messaging
  const getDaysUntilStart = () => {
    if (!plan.start_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(plan.start_date);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  const daysUntilStart = getDaysUntilStart();
  
  // Get status message based on budget state
  const getBudgetStatusMessage = () => {
    if (!plan.start_date) return daysRemainingText;
    
    if (daysUntilStart === null) return daysRemainingText;
    
    if (daysUntilStart > 1) {
      return `Starts in ${daysUntilStart} days`;
    } else if (daysUntilStart === 1) {
      return 'Starts Tomorrow';
    } else if (daysUntilStart === 0) {
      return 'Budget started';
    } else {
      // Budget has started
      const daysSinceStart = Math.abs(daysUntilStart);
      if (daysSinceStart === 1) {
        return 'Budget spend ongoing';
      } else {
        return daysRemainingText; // Use the regular days remaining text
      }
    }
  };
  
  const budgetStatusMessage = getBudgetStatusMessage();
  
  // Get health status
  const healthStatus = (plan as any).health_status || 'on_track';

  // Handle delete for draft plans
  const handleDelete = async (e: any) => {
    e.stopPropagation(); // Prevent card press
    haptics.mediumImpact();
    
    Alert.alert(
      'Delete Draft Plan',
      `Are you sure you want to delete "${plan.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.mediumImpact();
              // Delete from database
              await deleteExpensePlan(plan.id);
              // Refresh the plans list to reflect the deletion
              await fetchExpensePlans();
              haptics.notification();
              // Call optional callback if provided
              if (onDelete) {
                onDelete();
              }
            } catch (error: any) {
              console.error('Error deleting plan:', error);
              haptics.notification();
              
              // Provide user-friendly error message
              let errorMessage = 'Failed to delete plan. Please try again.';
              if (error?.message) {
                if (error.message.includes('not found') || error.message.includes('permission')) {
                  errorMessage = 'Plan not found or you do not have permission to delete it.';
                } else if (error.message.includes('network') || error.message.includes('connection')) {
                  errorMessage = 'Network error. Please check your connection and try again.';
                } else {
                  errorMessage = error.message;
                }
              }
              
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  // Handle press - for draft plans, resume from last step
  const handlePress = () => {
    if (plan.status === 'draft') {
      const resumeStep = getDraftResumeStep(plan);
      
      // Build params based on what we have
      const params: any = {
        planId: plan.id,
      };

      // Only add budget info if it exists
      if (plan.total_budget) {
        params.totalBudget = plan.total_budget.toString();
      }

      // Add dates if they exist
      if (plan.start_date) params.startDate = plan.start_date;
      if (plan.end_date) params.endDate = plan.end_date;

      // Add buckets/subcategories if they exist
      if (plan.buckets && plan.buckets.length > 0) {
        const subCategories: Record<string, string[]> = {};
        plan.buckets.forEach(bucket => {
          if (!subCategories[bucket.category_id]) {
            subCategories[bucket.category_id] = [];
          }
          subCategories[bucket.category_id].push(bucket.subcategory_id);
        });
        params.subCategories = JSON.stringify(subCategories);
        
        // For buckets screen, we need the bucket data with target amounts
        if (resumeStep.includes('buckets')) {
          params.buckets = JSON.stringify(plan.buckets.map(b => ({
            id: b.id,
            categoryId: b.category_id,
            subCategoryId: b.subcategory_id,
            name: b.name,
            targetAmount: b.target_amount ? b.target_amount.toString() : '0',
          })));
        }
      } else if (resumeStep.includes('buckets') || resumeStep.includes('plan-details')) {
        // If no buckets but we're going to buckets or plan-details, 
        // we still need subcategories if dates exist (means categories were selected)
        // This handles the case where user selected categories but hasn't allocated amounts yet
        if (plan.start_date && plan.end_date) {
          // User has dates, so they went through plan-details, but buckets weren't saved yet
          // We can't recover subcategories, so they'll need to re-select in plan-details
          // Or go to buckets where they can see the categories from the flow
        }
      }

      haptics.selection();
      router.push({
        pathname: resumeStep as any,
        params,
      });
    } else {
      onPress();
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);
  const isDraft = plan.status === 'draft';

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      <View style={styles.planHeader}>
        <Text style={styles.planName} numberOfLines={1} ellipsizeMode="tail">
          {plan.name}
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusTag, { backgroundColor: statusTag.backgroundColor }]}>
              <Text style={[styles.statusTagText, { color: statusTag.textColor }]}>
                {getStatusLabel()}
          </Text>
            </View>
          </View>
          {isDraft && (
            <Pressable
              onPress={handleDelete}
              style={styles.deleteButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountColumn}>
          <Text style={styles.planAmount}>₦{plan.total_budget.toLocaleString()}</Text>
        </View>
        {currentBalance > 0 && (
          <View style={styles.balanceColumn}>
            {/* <Text style={styles.balanceLabel}>Current Balance</Text> */}
            {/* <Text style={styles.balanceAmount}>₦{currentBalance.toLocaleString()}</Text> */}
            {/* <Text style={styles.percentageFunded}>{Math.round(percentageFunded)}% funded</Text> */}
          </View>
        )}
      </View>
      
      {/* Required per cycle */}
      {requiredPerCycle > 0 && (
        <View style={styles.requiredRow}>
          <Text style={styles.requiredLabel}>Required per {payoutSchedule === 'daily' ? 'day' : payoutSchedule === 'weekly' ? 'week' : payoutSchedule === 'biweekly' ? '2 weeks' : 'month'}</Text>
          <Text style={styles.requiredAmount}>₦{requiredPerCycle.toLocaleString()}</Text>
        </View>
      )}
      
      {/* Health Status */}
      {healthStatus !== 'on_track' && (
        <View style={[
          styles.healthBadge,
          healthStatus === 'slightly_behind' && styles.healthBadgeWarning,
          healthStatus === 'at_risk' && styles.healthBadgeDanger,
          healthStatus === 'unachievable' && styles.healthBadgeCritical,
        ]}>
          <Text style={styles.healthBadgeText}>
            {healthStatus === 'slightly_behind' ? 'Slightly Behind' :
             healthStatus === 'at_risk' ? 'At Risk' :
             'Unachievable'}
          </Text>
        </View>
      )}

      {(categoryIcons.length > 0 || selectedSubcategories.length > 0) && (
        <View style={styles.categoriesRow}>
          {categoryIcons.length > 0 && (
            <View style={styles.categoryIconsContainer}>
              {categoryIcons.map(({ categoryId, Icon }, index) => {
                // Handle both lucide icons and icon wrapper components
                const IconComponent = Icon;
                return (
                  <View 
                    key={categoryId} 
                    style={[
                      styles.categoryIconBadge,
                      index > 0 && styles.stackedIcon,
                      { zIndex: index + 1 } // Last icon (rightmost) has highest z-index for proper stacking
                    ]}
                  >
                    {IconComponent && (
                      <IconComponent 
                        size={14} 
                        color={colors.primary}
                        strokeWidth={1.5}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {selectedSubcategories.length > 0 && (
            <View style={styles.selectedCategoriesContainer}>
              {selectedSubcategories.slice(0, 2).map((sub, index) => (
                <Text key={`${sub.categoryId}-${sub.subcategoryId}`} style={styles.selectedCategoryText} numberOfLines={1}>
                  {sub.subcategoryName}{index < Math.min(selectedSubcategories.length, 2) - 1 ? ', ' : ''}
                </Text>
              ))}
              {selectedSubcategories.length > 2 && (
                <Text style={styles.selectedCategoryText}>
                  +{selectedSubcategories.length - 2} more
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Show dates */}
      {dateRange && (
        <View style={styles.datesRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={styles.datesText}>{dateRange}</Text>
        </View>
      )}

      {/* Show amount remaining to add or extra funds */}
      {!budgetStarted && remainingToAdd > 0 && (
        <View style={styles.remainingRow}>
          <Text style={styles.remainingLabel}>Remaining to add</Text>
          <Text style={styles.remainingAmount}>₦{remainingToAdd.toLocaleString()}</Text>
        </View>
      )}

      {extraFunds > 0 && (
        <View style={styles.extraFundsRow}>
          <Text style={styles.extraFundsLabel}>Extra funds</Text>
          <Text style={styles.extraFundsAmount}>+₦{extraFunds.toLocaleString()}</Text>
        </View>
      )}

      {/* Show auto-fund countdown */}
      {nextFundingCountdown && (
        <View style={styles.fundingCountdownRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={styles.fundingCountdownText}>
            Next funding: {nextFundingCountdown}
          </Text>
        </View>
      )}

      {/* Progress bar - show funding progress before start, spending progress after */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: budgetStarted
                ? `${Math.min(Math.max(100 - percentageUsed, 0), 100)}%` // Show remaining budget (100% to 0%)
                : `${Math.min(Math.max(percentageFunded, 0), 100)}%`, // Show funding progress (0% to 100%)
              backgroundColor: budgetStarted
                ? (percentageUsed > 100
                    ? '#EF4444'
                    : percentageUsed > 75
                    ? '#F97316'
                    : percentageUsed > 50
                    ? '#F59E0B'
                    : '#22C55E')
                : (percentageFunded >= 100
                    ? colors.primary
                    : percentageFunded >= 75
                    ? '#10B981'
                    : percentageFunded >= 50
                    ? '#F59E0B'
                    : percentageFunded >= 25
                    ? '#F97316'
                    : '#EF4444'),
            },
          ]}
        />
      </View>

      {/* Show progress info */}
      {budgetStarted ? (
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Spending • ₦{plan.total_spent.toLocaleString()}/₦{plan.total_budget.toLocaleString()}
          </Text>
        </View>
      ) : (
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Funded {Math.round(percentageFunded)}% • ₦{currentBalance.toLocaleString()}/₦{plan.total_budget.toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.footerRow}>
        {budgetStatusMessage && (
          <Text style={styles.daysRemaining}>{budgetStatusMessage}</Text>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: Platform.OS === 'ios' ? 16 : 12,
      marginBottom: Platform.OS === 'ios' ? 12 : 8,
      borderWidth: 0.5,
      borderColor: colors.border,
      minWidth: 280,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      // marginBottom: 12,
    },
    planName: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusContainer: {
      alignItems: 'flex-end',
    },
    deleteButton: {
      padding: 4,
      borderRadius: 8,
    },
    statusTag: {
      paddingHorizontal: Platform.OS === 'ios' ? 12 : 10,
      paddingVertical: Platform.OS === 'ios' ? 6 : 4,
      borderRadius: 16,
    },
    statusTagText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
      fontWeight: '600',
    },
    amountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      // marginBottom: 12,
      gap: 12,
    },
    amountColumn: {
      flex: 1,
    },
    planAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 25 : 24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    balanceColumn: {
      alignItems: 'flex-end',
    },
    balanceLabel: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 11 : 10, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 2,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    percentageFunded: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 11 : 10, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '500',
    },
    requiredRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    requiredLabel: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    requiredAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    healthBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 8,
    },
    healthBadgeWarning: {
      backgroundColor: '#FEF3C7',
    },
    healthBadgeDanger: {
      backgroundColor: '#FEE2E2',
    },
    healthBadgeCritical: {
      backgroundColor: '#FEE2E2',
    },
    healthBadgeText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 11 : 10, textSizeMultiplier),
      fontWeight: '600',
      color: '#D97706',
    },
    categoriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    categoryIconsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'visible', // Allow icons to overlap
    },
    categoryIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    stackedIcon: {
      marginLeft: -14, // Half overlap (50% of 28px width)
    },
    categoryCount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    selectedCategoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      flex: 1,
      marginLeft: 8,
    },
    selectedCategoryText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    datesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    datesText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    remainingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    remainingLabel: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    remainingAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    extraFundsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    extraFundsLabel: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    extraFundsAmount: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
      fontWeight: '600',
      color: '#22C55E',
    },
    fundingCountdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    fundingCountdownText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    progressBar: {
      height: Platform.OS === 'ios' ? 6 : 4,
      backgroundColor: colors.border,
      borderRadius: 3,
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressInfo: {
      marginBottom: 8,
    },
    progressText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
      color: colors.textSecondary,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    dateRange: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    separator: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
      color: colors.textSecondary,
      marginHorizontal: 6,
    },
    daysRemainingContainer: {
      marginBottom: 8,
    },
    daysRemaining: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 11, textSizeMultiplier),
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
