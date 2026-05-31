import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, ChevronDown, Pencil, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { ExpensePlan } from '@/types/expense-planner';
import { getCategoryById } from '@/lib/expenseCategories';
import { isBudgetStarted } from '@/lib/expensePlanUtils';
import { useHaptics } from '@/hooks/useHaptics';
import { useCloseExpensePlanVault } from '@/hooks/useCloseExpensePlanVault';

export default function PlanDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { expensePlans } = useExpensePlans();
  const haptics = useHaptics();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const requestCloseVault = useCloseExpensePlanVault(id);

  const plan = expensePlans.find(p => p.id === id) as ExpensePlan | undefined;

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Plan not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const budgetStarted = plan?.start_date ? isBudgetStarted(plan.start_date) : false;

  const currentBalance = (plan as any)?.current_balance ?? 0;
  const planTotalBudget = plan.total_budget ?? 0;
  const isPartiallyFunded = currentBalance > 0 && currentBalance < planTotalBudget;

  // Enable Close Vault only when the vault has no added funds yet (0%) or the progress rounds to 0%.
  // This should be independent of whether the budget period has started.
  const fundingProgressPercentRounded = planTotalBudget > 0
    ? Math.round((currentBalance / planTotalBudget) * 100)
    : 0;

  const showCloseVault =
    currentBalance <= 0 ||
    (planTotalBudget > 0 && fundingProgressPercentRounded === 0);

  // Get funding method
  const fundingMethod = plan?.funding_method || plan?.metadata?.funding_method || 'manual';
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

  // Get categories and subcategories
  const getCategoriesWithSubcategories = () => {
    const planCategories = (plan as any)?.categories || [];
    const planSubcategories = (plan as any)?.subcategories || [];
    
    if (Array.isArray(planCategories) && planCategories.length > 0) {
      const grouped: Array<{
        categoryId: string;
        categoryName: string;
        categoryIcon: any;
        subcategories: Array<{ id: string; name: string }>;
      }> = [];
      
      planCategories.forEach((categoryId: string) => {
        const category = getCategoryById(categoryId);
        if (!category) return;
        
        const categorySubcategories = planSubcategories
          .filter((sub: any) => sub.category_id === categoryId)
          .map((sub: any) => {
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
    
    // Fallback to buckets
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
        const subcategoryDef = category.subCategories?.find(s => s.id === bucket.subcategory_id);
        const subcategoryName = subcategoryDef?.name || bucket.name || bucket.subcategory_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        
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

  const handleSpend = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/spend/[planId]',
      params: { planId: id as string },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vault Details</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          hitSlop={8}
        >
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {budgetStarted && (
          <Pressable
            style={styles.spendButton}
            onPress={handleSpend}
            accessibilityRole="button"
            accessibilityLabel="Spend from vault"
          >
            <ShoppingCart size={20} color={isDark ? colors.text : colors.primary} />
            <Text style={styles.spendButtonText}>Spend</Text>
          </Pressable>
        )}

        {/* Budget Amount (hidden when started) */}
        {!budgetStarted && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoLabel}>Vault Amount</Text>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push({
                    pathname: '/expense-planner/[id]/edit-amount',
                    params: { id: id as string },
                  });
                }}
                style={styles.editButton}
              >
                <Pencil size={16} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={styles.infoValue}>{formatBalance(plan.total_budget)}</Text>
          </View>
        )}

        {/* Maturity Date */}
        {plan.start_date && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoLabel}>Maturity Date</Text>
              {!budgetStarted && !isPartiallyFunded && (
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/expense-planner/[id]/edit-period',
                      params: { id: id as string },
                    });
                  }}
                  style={styles.editButton}
                >
                  <Pencil size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>
            <Text style={styles.infoValue}>
              {formatDate(plan.start_date)}
            </Text>
          </View>
        )}

        {/* Funding Method & Start Rule (hidden when started) */}
        {!budgetStarted && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Text style={styles.infoLabel}>Funding Method</Text>
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/expense-planner/[id]/edit-funding',
                      params: { id: id as string },
                    });
                  }}
                  style={styles.editButton}
                >
                  <Pencil size={16} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.infoValue}>
                {fundingMethod === 'auto' && autoTopupAmount && autoTopupFrequency
                  ? `Auto - ${formatBalance(autoTopupAmount)} ${getFrequencyLabel(autoTopupFrequency)}`
                  : fundingMethod === 'auto' 
                  ? 'Auto' 
                  : 'Manual'}
              </Text>
            </View>

            {/* <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Text style={styles.infoLabel}>Vault Start Rule</Text>
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/expense-planner/[id]/edit-start-rule',
                      params: { id: id as string },
                    });
                  }}
                  style={styles.editButton}
                >
                  <Pencil size={16} color={colors.primary} />
                </Pressable>
              </View>
              {startAction === 'wallet' ? (
                <View>
                  <Text style={styles.infoValue}>
                    {budgetStarted ? 'Keep balance in Vault' : 'Spend directly from vault'}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.infoValue}>Auto payout to bank account</Text>
                  {payoutAccountLabel && (
                    <Text style={styles.payoutAccountText}>
                      {payoutAccountBankName} ••••{payoutAccountLabel.split('••••')[1] || ''}
                    </Text>
                  )}
                </View>
              )}
            </View> */}
          </>
        )}

        {/* Categories */}
        {categoriesWithSubcategories.length > 0 && (
          <View style={styles.categoriesCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Categories</Text>
              {!budgetStarted && !isPartiallyFunded && (
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/expense-planner/[id]/edit-categories',
                      params: { id: id as string },
                    });
                  }}
                  style={styles.editButton}
                >
                  <Pencil size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>
            {(showAllCategories ? categoriesWithSubcategories : categoriesWithSubcategories.slice(0, 3)).map((categoryGroup) => {
              const CategoryIcon = categoryGroup.categoryIcon;
              return (
                <View key={categoryGroup.categoryId} style={styles.categoryGroup}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryIconContainer}>
                      {CategoryIcon && React.createElement(CategoryIcon, {
                        size: 20,
                        color: colors.primary,
                        strokeWidth: 2,
                      })}
                    </View>
                    <Text style={styles.categoryName}>{categoryGroup.categoryName}</Text>
                  </View>
                  <View style={styles.subcategoriesList}>
                    {categoryGroup.subcategories.map((subcategory) => (
                      <View key={subcategory.id} style={styles.subcategoryChip}>
                        <Text style={styles.subcategoryChipText}>{subcategory.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {categoriesWithSubcategories.length > 3 && (
              <Pressable
                onPress={() => setShowAllCategories(!showAllCategories)}
                style={styles.showAllButton}
              >
                <Text style={styles.showAllButtonText}>
                  {showAllCategories ? 'Show less' : `Show all (${categoriesWithSubcategories.length - 3} more)`}
                </Text>
                <ChevronDown
                  size={16}
                  color={colors.primary}
                  style={[
                    styles.chevronIcon,
                    showAllCategories && styles.chevronIconRotated
                  ]}
                />
              </Pressable>
            )}
          </View>
        )}

        {showCloseVault && (
          <Pressable
            style={styles.closeVaultButton}
            onPress={() =>
              requestCloseVault({ planName: plan.name, currentBalance })
            }
          >
            <X size={20} color={colors.textTertiary} />
            <Text style={styles.closeVaultButtonText}>Close Vault</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      padding: 4,
    },
    placeholder: {
      width: 32,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    spendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '20',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 12,
    },
    spendButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: isDark ? colors.text : colors.primary,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    infoLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
    },
    editButton: {
      padding: 4,
      borderRadius: 6,
      backgroundColor: colors.primary + '10',
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
    categoriesCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
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
      marginLeft: 42,
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
    closeVaultButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
      marginBottom: 24,
    },
    closeVaultButtonText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: '#EF4444',
    },
  });

