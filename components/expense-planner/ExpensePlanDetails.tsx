import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { ExpensePlan, ExpenseBucket } from '@/types/expense-planner';
import { getCategoryById } from '@/lib/expenseCategories';

interface ExpensePlanDetailsProps {
  plan: ExpensePlan | null;
  buckets?: ExpenseBucket[];
}

export default function ExpensePlanDetails({ plan, buckets = [] }: ExpensePlanDetailsProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  if (!plan) {
    return null;
  }

  // Use buckets from prop or plan.buckets
  const planBuckets = buckets.length > 0 ? buckets : (plan.buckets || []);

  // Group buckets by category
  const groupedBuckets = useMemo(() => {
    const grouped: Record<string, {
      category: ReturnType<typeof getCategoryById>;
      buckets: ExpenseBucket[];
      totalAmount: number;
    }> = {};

    planBuckets.forEach(bucket => {
      const categoryId = bucket.category_id;
      if (!grouped[categoryId]) {
        grouped[categoryId] = {
          category: getCategoryById(categoryId),
          buckets: [],
          totalAmount: 0,
        };
      }
      grouped[categoryId].buckets.push(bucket);
      grouped[categoryId].totalAmount += bucket.target_amount || 0;
    });

    return Object.values(grouped);
  }, [planBuckets]);

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.detailsCard}>
      <Text style={styles.detailsCardTitle}>Plan Details</Text>
      
      {/* Total Amount at Top */}
      <View style={styles.totalAmountContainer}>
        <View style={styles.totalAmountIconContainer}>
          <DollarSign size={24} color={colors.primary} />
        </View>
        <View style={styles.totalAmountContent}>
          <Text style={styles.totalAmountLabel}>Total Budget</Text>
          <Text style={styles.totalAmountValue}>
            ₦{plan.total_budget.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Categories List */}
      {groupedBuckets.length > 0 ? (
        <View style={styles.categoriesContainer}>
          {groupedBuckets.map((group, groupIndex) => {
            const CategoryIcon = group.category?.icon;
            const categoryName = group.category?.name || 'Unknown Category';

            return (
              <View 
                key={group.category?.id || groupIndex} 
                style={[
                  styles.categoryGroup,
                  groupIndex === groupedBuckets.length - 1 && styles.categoryGroupLast
                ]}
              >
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryIconContainer}>
                    {CategoryIcon ? (
                      <CategoryIcon size={20} color={colors.primary} />
                    ) : null}
                  </View>
                  <View style={styles.categoryHeaderContent}>
                    <Text style={styles.categoryName}>{categoryName}</Text>
                    <Text style={styles.categoryTotalAmount}>
                      ₦{group.totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Subcategories */}
                <View style={styles.subcategoriesContainer}>
                  {group.buckets.map((bucket, bucketIndex) => {
                    const subCategory = group.category?.subCategories.find(
                      sub => sub.id === bucket.subcategory_id
                    );
                    const subCategoryName = subCategory?.name || bucket.name;

                    return (
                      <View 
                        key={bucket.id} 
                        style={[
                          styles.subcategoryRow,
                          bucketIndex === group.buckets.length - 1 && styles.subcategoryRowLast
                        ]}
                      >
                        <View style={styles.subcategoryDot} />
                        <Text style={styles.subcategoryName}>{subCategoryName}</Text>
                        <Text style={styles.subcategoryAmount}>
                          ₦{bucket.target_amount.toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No categories added yet</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    detailsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsCardTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 20,
    },
    totalAmountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    totalAmountIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    totalAmountContent: {
      flex: 1,
    },
    totalAmountLabel: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 4,
    },
    totalAmountValue: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    categoriesContainer: {
      gap: 20,
    },
    categoryGroup: {
      marginBottom: 20,
    },
    categoryGroupLast: {
      marginBottom: 0,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    categoryIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    categoryHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryName: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    categoryTotalAmount: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    subcategoriesContainer: {
      marginLeft: 48,
      gap: 8,
    },
    subcategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    subcategoryRowLast: {
      borderBottomWidth: 0,
    },
    subcategoryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textSecondary,
      marginRight: 12,
    },
    subcategoryName: {
      flex: 1,
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
    subcategoryAmount: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    emptyState: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });

