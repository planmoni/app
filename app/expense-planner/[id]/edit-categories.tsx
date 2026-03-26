import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Search } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { CATEGORIES } from '@/app/expense-planner/create/plan-details';

export default function EditCategoriesScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const { expensePlans, updateExpensePlan, fetchExpensePlans } = useExpensePlans();
  
  const plan = expensePlans.find(p => p.id === planId);
  const currentBalance = (plan as any)?.current_balance || 0;
  const planTotalBudget = plan?.total_budget ?? 0;
  const isPartiallyFunded = currentBalance > 0 && planTotalBudget > 0 && currentBalance < planTotalBudget;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from plan
  useEffect(() => {
    if (!plan) return;
    
    const planCategories = (plan as any)?.categories || [];
    const planSubcategories = (plan as any)?.subcategories || [];
    
    if (planSubcategories && Array.isArray(planSubcategories)) {
      const subcategoriesMap: Record<string, string[]> = {};
      planSubcategories.forEach((sub: any) => {
        const categoryId = sub.category_id || sub.categoryId;
        const subcategoryId = sub.subcategory_id || sub.subcategoryId;
        if (categoryId && subcategoryId) {
          if (!subcategoriesMap[categoryId]) {
            subcategoriesMap[categoryId] = [];
          }
          if (!subcategoriesMap[categoryId].includes(subcategoryId)) {
            subcategoriesMap[categoryId].push(subcategoryId);
          }
        }
      });
      setSelectedSubCategories(subcategoriesMap);
    }
  }, [plan]);

  const filteredCategories = useMemo(() => {
    let categories = CATEGORIES;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      categories = categories.filter(category => {
        const categoryNameMatch = category.name.toLowerCase().includes(query);
        const subCategoryMatch = category.subCategories.some(subCategory =>
          subCategory.name.toLowerCase().includes(query)
        );
        return categoryNameMatch || subCategoryMatch;
      });
    }
    return categories;
  }, [searchQuery]);

  const handleCategoryClick = (categoryId: string) => {
    if (isPartiallyFunded) return;
    haptics.selection();
    setSelectedCategoryId(prev => prev === categoryId ? null : categoryId);
  };

  const handleSubCategoryToggle = (categoryId: string, subCategoryId: string) => {
    if (isPartiallyFunded) return;
    haptics.selection();
    setSelectedSubCategories(prev => {
      const current = prev[categoryId] || [];
      const isSelected = current.includes(subCategoryId);
      
      return {
        ...prev,
        [categoryId]: isSelected
          ? current.filter(id => id !== subCategoryId)
          : [...current, subCategoryId],
      };
    });
  };

  const handleDone = async () => {
    if (isPartiallyFunded) {
      Alert.alert('Not Editable', 'Categories can’t be edited once the vault is partially funded.');
      haptics.notification();
      return;
    }
    const allSelectedSubCategories = Object.values(selectedSubCategories).flat();
    
    if (allSelectedSubCategories.length === 0) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      const uniqueCategories = Object.keys(selectedSubCategories);
      const subcategoriesArray: Array<{ category_id: string; subcategory_id: string }> = [];
      
      Object.entries(selectedSubCategories).forEach(([categoryId, subcategoryIds]) => {
        subcategoryIds.forEach(subcategoryId => {
          subcategoriesArray.push({
            category_id: categoryId,
            subcategory_id: subcategoryId,
          });
        });
      });

      await updateExpensePlan(planId, {
        categories: uniqueCategories,
        subcategories: subcategoriesArray,
      });
      await fetchExpensePlans();
      haptics.notification();
      router.back();
    } catch (error: any) {
      console.error('Error updating categories:', error);
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Categories</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.description}>
          Select the categories and subcategories for this budget
        </Text>

        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!isPartiallyFunded}
          />
        </View>

        <View style={styles.categoriesContainer}>
          {filteredCategories.map(category => {
            const isSelected = selectedCategoryId === category.id;
            const selectedSubs = selectedSubCategories[category.id] || [];
            const CategoryIcon = category.icon;
            
            return (
              <View key={category.id} style={styles.categoryItem}>
                <Pressable
                  style={styles.categoryHeader}
                  onPress={() => handleCategoryClick(category.id)}
                >
                  <View style={styles.categoryHeaderLeft}>
                    {CategoryIcon && <CategoryIcon size={24} color={colors.primary} />}
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </View>
                  <Text style={styles.subcategoryCount}>
                    {selectedSubs.length} selected
                  </Text>
                </Pressable>
                {isSelected && (
                  <View style={styles.subcategoriesContainer}>
                    {category.subCategories.map(subCategory => {
                      const isSubSelected = selectedSubs.includes(subCategory.id);
                      return (
                        <Pressable
                          key={subCategory.id}
                          style={[
                            styles.subcategoryItem,
                            isSubSelected && styles.subcategoryItemSelected,
                          ]}
                          onPress={() => handleSubCategoryToggle(category.id, subCategory.id)}
                        >
                          <View style={[
                            styles.checkbox,
                            isSubSelected && styles.checkboxSelected,
                          ]}>
                            {isSubSelected && <View style={styles.checkboxInner} />}
                          </View>
                          <Text style={styles.subcategoryName}>{subCategory.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <FloatingButton
        title="Done"
        onPress={handleDone}
        disabled={isSaving || isPartiallyFunded || Object.values(selectedSubCategories).flat().length === 0}
        hapticType="medium"
      />
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
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
    },
    categoriesContainer: {
      gap: 12,
    },
    categoryItem: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    categoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    categoryName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    subcategoryCount: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    subcategoriesContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    subcategoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      gap: 12,
    },
    subcategoryItemSelected: {
      backgroundColor: colors.primary + '10',
    },
    subcategoryName: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      flex: 1,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxInner: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
  });

