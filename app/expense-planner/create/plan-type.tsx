import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Search, Repeat, Target, Calendar, ChevronDown, ChevronRight, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { CATEGORIES } from './plan-details';
import { getCategoriesForPlanType, PLAN_TYPE_INFO, PlanType, getPlanTypeForCategory } from '@/lib/planTypeMapping';

export default function PlanTypeScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.planId as string | undefined;
  const quickCategory = params.quickCategory as string | undefined;

  const [selectedPlanTypes, setSelectedPlanTypes] = useState<PlanType[]>([]);
  const [searchQueries, setSearchQueries] = useState<Record<PlanType, string>>({
    recurring: '',
    one_time: '',
    long_term: '',
  });
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<PlanType, Set<string>>>({
    recurring: new Set(),
    one_time: new Set(),
    long_term: new Set(),
  });

  const planTypes: PlanType[] = ['recurring', 'one_time', 'long_term'];

  // If coming from Quick Plans, pre-select the plan type and expand that category
  useEffect(() => {
    if (!quickCategory) return;

    const inferredPlanType = getPlanTypeForCategory(quickCategory);

    // Pre-select plan type
    setSelectedPlanTypes(prev => {
      if (prev.includes(inferredPlanType)) return prev;
      return [...prev, inferredPlanType];
    });

    // Expand the specific category so its subcategories are visible
    setExpandedCategories(prev => {
      const next = { ...prev };
      const set = new Set(prev[inferredPlanType]);
      set.add(quickCategory);
      next[inferredPlanType] = set;
      return next;
    });
  }, [quickCategory]);

  const handlePlanTypeToggle = (planType: PlanType) => {
    haptics.selection();
    setSelectedPlanTypes(prev => {
      if (prev.includes(planType)) {
        return prev.filter(t => t !== planType);
      }
      return [...prev, planType];
    });
  };

  const handleSearchChange = (planType: PlanType, query: string) => {
    setSearchQueries(prev => ({
      ...prev,
      [planType]: query,
    }));
  };

  const getFilteredCategories = (planType: PlanType) => {
    const allCategories = getCategoriesForPlanType(planType, CATEGORIES);
    const query = searchQueries[planType].toLowerCase();
    
    if (!query) return allCategories;
    
    return allCategories.filter(category => {
      const categoryMatch = category.name.toLowerCase().includes(query);
      const subCategoryMatch = category.subCategories.some(sub =>
        sub.name.toLowerCase().includes(query)
      );
      return categoryMatch || subCategoryMatch;
    });
  };

  const toggleCategoryExpand = (planType: PlanType, categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev[planType]);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...prev, [planType]: next };
    });
  };

  const toggleSubCategory = (subId: string) => {
    setSelectedSubCategories(prev => {
      if (prev.includes(subId)) {
        return prev.filter(id => id !== subId);
      }
      return [...prev, subId];
    });
    haptics.selection();
  };

  const handleContinue = () => {
    if (selectedPlanTypes.length === 0) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    
    // Navigate straight to plan-name with selected plan types/subcategories
    router.push({
      pathname: '/expense-planner/create/plan-name',
      params: {
        planTypes: JSON.stringify(selectedPlanTypes),
        ...(selectedSubCategories.length > 0 && { subCategories: JSON.stringify(selectedSubCategories) }),
        ...(planId && { planId }),
      },
    });
  };

  const getPlanTypeIcon = (planType: PlanType) => {
    switch (planType) {
      case 'recurring':
        return Repeat;
      case 'one_time':
        return Target;
      case 'long_term':
        return Calendar;
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
        <Text style={styles.headerTitle}>Choose Your Spending Plan</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.replace('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>What spending are you planning?</Text>
          <Text style={styles.subtitle}>Pick one or more spending plan types to budget smarter</Text>

          {planTypes.map((planType) => {
            const info = PLAN_TYPE_INFO[planType];
            const Icon = getPlanTypeIcon(planType);
            const isSelected = selectedPlanTypes.includes(planType);
            const filteredCategories = getFilteredCategories(planType);

            return (
              <View key={planType} style={styles.planTypeSection}>
                <Pressable
                  onPress={() => handlePlanTypeToggle(planType)}
                  style={[
                    styles.planTypeHeader,
                    isSelected && styles.planTypeHeaderSelected,
                  ]}
                >
                  <View style={styles.planTypeHeaderLeft}>
                    <View style={[
                      styles.planTypeIconContainer,
                      isSelected && styles.planTypeIconContainerSelected,
                    ]}>
                      <Icon size={24} color={isSelected ? colors.primary : colors.text} />
                    </View>
                    <View style={styles.planTypeInfo}>
                      <Text style={styles.planTypeLabel}>{info.label}</Text>
                      <Text style={styles.planTypeDescription}>{info.description}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}>
                    {isSelected && <View style={styles.checkboxInner} />}
                  </View>
                </Pressable>

                {isSelected && (
                  <View style={styles.categoriesContainer}>
                    <View style={styles.searchContainer}>
                      <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder={`Search ${info.label.toLowerCase()} categories...`}
                        placeholderTextColor={colors.textTertiary}
                        value={searchQueries[planType]}
                        onChangeText={(query) => handleSearchChange(planType, query)}
                      />
                    </View>

                    <View style={styles.categoriesList}>
                      {filteredCategories.length === 0 ? (
                        <Text style={styles.noResultsText}>No categories found</Text>
                      ) : (
                        filteredCategories.map((category) => {
                          const CategoryIcon = category.icon;
                          const isExpanded = expandedCategories[planType].has(category.id);
                          return (
                            <View key={category.id} style={styles.categoryWrapper}>
                              <Pressable
                                style={styles.categoryHeader}
                                onPress={() => toggleCategoryExpand(planType, category.id)}
                              >
                                <View style={styles.categoryLeft}>
                                  <CategoryIcon size={20} color={colors.textSecondary} strokeWidth={1.5} />
                                  <Text style={styles.categoryName}>{category.name}</Text>
                                  <Text style={styles.categoryCount}>{category.subCategories.length} items</Text>
                                </View>
                                {isExpanded ? (
                                  <ChevronDown size={18} color={colors.textSecondary} />
                                ) : (
                                  <ChevronRight size={18} color={colors.textSecondary} />
                                )}
                              </Pressable>

                              {isExpanded && (
                                <View style={styles.subCategoryList}>
                                  {category.subCategories.map((sub) => {
                                    const selected = selectedSubCategories.includes(sub.id);
                                    return (
                                      <Pressable
                                        key={sub.id}
                                        style={[styles.subCategoryItem, selected && styles.subCategoryItemSelected]}
                                        onPress={() => toggleSubCategory(sub.id)}
                                      >
                                        <Text style={[styles.subCategoryText, selected && styles.subCategoryTextSelected]}>
                                          {sub.name}
                                        </Text>
                                        {selected && (
                                          <View style={styles.subCategoryCheck}>
                                            <Check size={16} color="#fff" />
                                          </View>
                                        )}
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={selectedPlanTypes.length === 0}
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
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
    },
    planTypeSection: {
      marginBottom: 16,
    },
    planTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    planTypeHeaderSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    planTypeHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },
    planTypeIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.accentBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planTypeIconContainerSelected: {
      backgroundColor: colors.primary + '20',
    },
    planTypeInfo: {
      flex: 1,
    },
    planTypeLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    planTypeDescription: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 18,
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
    categoriesContainer: {
      marginTop: 12,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
    },
    categoriesList: {
      gap: 8,
    },
    categoryWrapper: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    categoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    categoryName: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      fontWeight: '600',
    },
    categoryCount: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    subCategoryList: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 8,
    },
    subCategoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subCategoryItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    subCategoryText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    subCategoryTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    subCategoryCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noResultsText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });
