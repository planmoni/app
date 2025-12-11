import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Bell, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { PlanType } from '@/lib/planTypeMapping';
import { CATEGORIES } from './plan-details';

interface Bucket {
  id: string;
  name: string;
  targetAmount: string;
}

export default function ReviewScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { createCompletePlan } = useExpensePlans();
  
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const budgetStructure = params.budgetStructure as 'fixed' | 'estimated';
  const priority = params.priority as 'high' | 'medium' | 'low';
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const dateType = params.dateType as 'range' | 'one_time' | 'ongoing';
  const payoutSchedule = params.payoutSchedule as string;
  const requiredPerCycle = params.requiredPerCycle as string;
  const fundingMethod = params.fundingMethod as 'auto' | 'manual' | 'hybrid';
  const autoFundMinimum = params.autoFundMinimum as string | undefined;
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;
  const spendingPermission = (params.spendingPermission as 'open' | 'restricted') || 'open';
  const lockType = (params.lockType as 'none' | 'instant' | '24h_delay' | 'pin_required') || 'none';
  const pin = (params.pin as string) || '';
  const alertAt70Percent = (params.alertAt70Percent as string) === 'true';
  const alertRiskFailure = (params.alertRiskFailure as string) === 'true';
  const alertWeeklyProgress = (params.alertWeeklyProgress as string) === 'true';
  const requiredPerCycleNumber = parseFloat(requiredPerCycle || '0');
  
  const buckets: Bucket[] = params.buckets ? JSON.parse(params.buckets as string) : [];
  const [isCreating, setIsCreating] = useState(false);

  const getFundingMethodLabel = () => {
    switch (fundingMethod) {
      case 'auto':
        return 'Auto refresh';
      case 'hybrid':
        if (!autoFundMinimum) return 'Hybrid';
        const minValue = parseFloat(autoFundMinimum);
        if (Number.isNaN(minValue)) return 'Hybrid';
        return `Hybrid (min ₦${minValue.toLocaleString('en-US')})`;
      default:
        return 'Manual';
    }
  };

  const getLockTypeLabel = () => {
    switch (lockType) {
      case 'instant':
        return 'Instant lock';
      case '24h_delay':
        return '24h delay to unlock';
      case 'pin_required':
        return 'PIN required';
      default:
        return 'No lock';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Get selected categories for display
  const selectedCategories = React.useMemo(() => {
    if (!subCategories) return [];
    try {
      const parsed = JSON.parse(subCategories);
      const categoryIds = Object.keys(parsed);
      return categoryIds.map(id => CATEGORIES.find(cat => cat.id === id)).filter(Boolean);
    } catch {
      return [];
    }
  }, [subCategories]);

  const handleCreatePlan = async () => {
    haptics.mediumImpact();
    setIsCreating(true);

    try {
      // Parse plan types
      let planTypes: PlanType[] = [];
      if (planTypesParam) {
        try {
          planTypes = JSON.parse(planTypesParam);
        } catch (e) {
          console.error('Error parsing plan types:', e);
        }
      }

      // Determine plan type from selected categories if not explicitly set
      // For now, default to first selected type or 'one_time'
      const planType = planTypes.length > 0 ? planTypes[0] : 'one_time';

      // Parse subcategories for buckets
      let subCategoriesData: Record<string, string[]> = {};
      if (subCategories) {
        try {
          subCategoriesData = JSON.parse(subCategories);
        } catch (e) {
          console.error('Error parsing subcategories:', e);
        }
      }

      // Create buckets from subcategories if buckets not provided
      const bucketsToCreate = buckets.length > 0 ? buckets.map(b => {
        // Try to extract category and subcategory from bucket id or name
        const parts = b.id.split('_');
        return {
          category_id: parts[0] || '',
          subcategory_id: parts[1] || '',
          name: b.name,
          target_amount: parseFloat(b.targetAmount.replace(/,/g, '') || '0'),
        };
      }) : [];

      // Create complete plan
      const plan = await createCompletePlan({
        plan_name: planName,
        name: planName, // Keep name for backward compatibility
        total_budget: targetAmount,
        budget_structure: budgetStructure,
        start_date: startDateStr || null,
        end_date: endDateStr || null,
        plan_type: planType,
        priority: priority,
        funding_method: fundingMethod,
        payout_schedule: payoutSchedule as any,
        required_per_cycle: requiredPerCycleNumber,
        required_per_day: 0, // Will be calculated
        spending_permission: spendingPermission,
        lock_type: lockType,
        pin_hash: lockType === 'pin_required' ? pin : null, // In production, hash this
        alert_at_70_percent: alertAt70Percent,
        alert_risk_failure: alertRiskFailure,
        alert_weekly_progress: alertWeeklyProgress,
        buckets: bucketsToCreate,
      });

      // Navigate to success screen
      router.push({
        pathname: '/expense-planner/create/success',
        params: {
          planId: plan.id,
          planName: planName,
        },
      });
    } catch (error: any) {
      console.error('Error creating plan:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create plan. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Review & Create</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.replace('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Review your plan</Text>
        <Text style={styles.subtitle}>Please review all details before creating your plan</Text>

        {/* Plan Name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Plan Name</Text>
          </View>
          <Text style={styles.sectionValue}>{planName}</Text>
        </View>

        {/* Target & Deadline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Amount & Dates</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Target Amount</Text>
            <Text style={styles.infoValue}>₦{targetAmount.toLocaleString('en-US')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Start Date</Text>
            <Text style={styles.infoValue}>{formatDate(startDateStr)}</Text>
          </View>
          {dateType !== 'ongoing' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>End Date</Text>
              <Text style={styles.infoValue}>{formatDate(endDateStr)}</Text>
            </View>
          )}
          {dateType === 'ongoing' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>Ongoing</Text>
            </View>
          )}
        </View>

        {/* Required Contribution */}

        {/* Priority */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Priority Level</Text>
          </View>
          <Text style={styles.sectionValue}>
            {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Not set'}
          </Text>
        </View>

        {/* Funding Rule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Funding Rule</Text>
          </View>
          <Text style={styles.sectionValue}>{getFundingMethodLabel()}</Text>
        </View>

        {/* Wallet Lock Rule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Wallet Lock Rule</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Spending Permission</Text>
            <Text style={styles.infoValue}>
              {spendingPermission === 'open' ? 'Open' : 'Restricted'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lock Type</Text>
            <Text style={styles.infoValue}>{getLockTypeLabel()}</Text>
          </View>
        </View>

        {/* Alerts */}
        {(alertAt70Percent || alertRiskFailure || alertWeeklyProgress) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Alerts</Text>
            </View>
            {alertAt70Percent && (
              <View style={styles.alertItem}>
                <Check size={16} color={colors.primary} />
                <Text style={styles.alertText}>Notify at 70% spent</Text>
              </View>
            )}
            {alertRiskFailure && (
              <View style={styles.alertItem}>
                <Check size={16} color={colors.primary} />
                <Text style={styles.alertText}>Notify when plan risks failing</Text>
              </View>
            )}
            {alertWeeklyProgress && (
              <View style={styles.alertItem}>
                <Check size={16} color={colors.primary} />
                <Text style={styles.alertText}>Notify weekly progress</Text>
              </View>
            )}
          </View>
        )}

        {/* Selected Categories */}
        {selectedCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Categories</Text>
            <View style={styles.categoriesContainer}>
              {selectedCategories.slice(0, 5).map((category) => {
                if (!category) return null;
                const Icon = category.icon;
                return (
                  <View key={category.id} style={styles.categoryBadge}>
                    <Icon size={16} color={colors.primary} strokeWidth={1.5} />
                    <Text style={styles.categoryBadgeText}>{category.name}</Text>
                  </View>
                );
              })}
              {selectedCategories.length > 5 && (
                <Text style={styles.moreCategoriesText}>
                  +{selectedCategories.length - 5} more
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <FloatingButton
        title="Create Plan"
        onPress={handleCreatePlan}
        disabled={isCreating}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
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
      marginLeft: 8,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
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
      marginBottom: 32,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    sectionValue: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    infoLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    alertText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
    },
    categoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryBadgeText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    moreCategoriesText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      fontStyle: 'italic',
      alignSelf: 'center',
      paddingVertical: 6,
    },
  });
