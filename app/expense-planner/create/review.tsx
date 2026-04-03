import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Bell, Check, Landmark } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { PlanType } from '@/lib/planTypeMapping';
import { CATEGORIES } from './plan-details';
import { getBankIconLogo } from '@/lib/bankIcons';
import { trackLifecycleEvent } from '@/lib/lifecycleTracking';
import { LifecycleEventName } from '@/lib/lifecycleEvents';

interface Bucket {
  id: string;
  name: string;
  targetAmount: string;
}

export default function ReviewScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { createCompletePlan } = useExpensePlans();
  
  const planName = params.planName as string;
  const targetAmount = parseFloat((params.targetAmount as string) || '0');
  const startDateStr = params.startDate as string;
  const endDateStr = params.endDate as string;
  const dateType = params.dateType as 'range' | 'one_time' | 'ongoing';
  const payoutSchedule = params.payoutSchedule as string;
  const requiredPerCycle = params.requiredPerCycle as string;
  const fundingMethod = params.fundingMethod as 'auto' | 'manual';
  const startAction = (params.startAction as 'wallet' | 'auto_payout') || 'wallet';
  const payoutAccountId = (params.payoutAccountId as string) || '';
  const payoutAccountLabel = (params.payoutAccountLabel as string) || '';
  const payoutAccountBankName = (params.payoutAccountBankName as string) || '';
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;
  const spendingPermission = (params.spendingPermission as 'open' | 'restricted') || 'open';
  const lockType = (params.lockType as 'none' | 'instant' | '24h_delay' | 'pin_required') || 'none';

  useEffect(() => {
    void trackLifecycleEvent(LifecycleEventName.VAULT_FLOW_STEP_CONFIRM, {
      screen: 'review',
      planName: planName ?? undefined,
    });
  }, [planName]);
  const pin = (params.pin as string) || '';
  const alertAt70Percent = (params.alertAt70Percent as string) === 'true';
  const alertRiskFailure = (params.alertRiskFailure as string) === 'true';
  const alertWeeklyProgress = (params.alertWeeklyProgress as string) === 'true';
  const requiredPerCycleNumber = parseFloat(requiredPerCycle || '0');
  // Auto top-up parameters
  const autoTopupEnabled = (params.autoTopupEnabled as string) === 'true';
  const autoTopupFrequency = params.autoTopupFrequency as string | undefined;
  const autoTopupAmount = params.autoTopupAmount as string | undefined;
  const autoTopupStartDate = params.autoTopupStartDate as string | undefined;
  const autoTopupEndDate = params.autoTopupEndDate as string | undefined;
  const autoTopupNextDate = params.autoTopupNextDate as string | undefined;
  const autoTopupTotalCycles = params.autoTopupTotalCycles as string | undefined;
  
  const buckets: Bucket[] = params.buckets ? JSON.parse(params.buckets as string) : [];
  const [isCreating, setIsCreating] = useState(false);

  const getFundingMethodLabel = () => {
    return fundingMethod === 'auto' ? 'Auto top-up' : 'Manual';
  };

  const getStartActionLabel = () => {
    if (startAction === 'auto_payout') {
      return payoutAccountLabel ? `Auto payout to ${payoutAccountLabel}` : 'Auto payout to bank';
    }
    return 'Spend directly from budget';
  };

  const bankIcon = payoutAccountBankName ? getBankIconLogo(payoutAccountBankName) : {};
  const SvgLogo = bankIcon.logoSvg as any;
  const PngLogo = bankIcon.logo as any;

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

      // If we have subCategoriesData but no buckets, create buckets from subCategoriesData
      // This happens when coming from plan-details page
      if (bucketsToCreate.length === 0 && Object.keys(subCategoriesData).length > 0) {
        // Create bucket structures from subCategoriesData
        // We'll use 0 for target_amount since amounts aren't set yet
        Object.entries(subCategoriesData).forEach(([categoryId, subcategoryIds]) => {
          subcategoryIds.forEach(subcategoryId => {
            bucketsToCreate.push({
              category_id: categoryId,
              subcategory_id: subcategoryId,
              name: `${categoryId}_${subcategoryId}`, // Temporary name
              target_amount: 0, // Will be set later
            });
          });
        });
      }

      // Create complete plan
      const plan = await createCompletePlan({
        plan_name: planName,
        name: planName, // Keep name for backward compatibility
        total_budget: targetAmount,
        start_date: startDateStr || null,
        end_date: endDateStr || null,
        funding_method: fundingMethod,
        payout_schedule: payoutSchedule as any,
        required_per_cycle: requiredPerCycleNumber,
        required_per_day: 0, // Will be calculated
        alert_at_70_percent: alertAt70Percent,
        alert_risk_failure: alertRiskFailure,
        alert_weekly_progress: alertWeeklyProgress,
        metadata: {
          start_action: startAction,
          payout_account_id: payoutAccountId || null,
          payout_account_label: payoutAccountLabel || null,
          payout_account_bank_name: payoutAccountBankName || null,
          // Auto top-up configuration
          auto_topup_enabled: autoTopupEnabled,
          auto_topup_frequency: autoTopupFrequency || null,
          auto_topup_amount: autoTopupAmount ? parseFloat(autoTopupAmount) : null,
          auto_topup_start_date: autoTopupStartDate || null,
          auto_topup_end_date: autoTopupEndDate || null,
          auto_topup_next_date: autoTopupNextDate || null,
          auto_topup_total_cycles: autoTopupTotalCycles ? parseInt(autoTopupTotalCycles) : null,
        },
        buckets: bucketsToCreate,
      });

      // Navigate to success screen
      router.push({
        pathname: '/expense-planner/create/success',
        params: {
          planId: plan.id,
          planName: planName,
          totalBudget: targetAmount.toString(),
          fundingMethod: fundingMethod || 'manual',
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
        <Text style={styles.title}>Review your vault</Text>
        <Text style={styles.subtitle}>Please review all details before creating your vault</Text>

        {/* Plan Name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vault Name</Text>
          </View>
          <Text style={styles.sectionValue}>{planName}</Text>
        </View>

        {/* Target & Deadline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vault Amount & Dates</Text>
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

        {/* Funding Rule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Funding Rule</Text>
          </View>
          <Text style={styles.sectionValue}>{getFundingMethodLabel()}</Text>
          {autoTopupEnabled && autoTopupFrequency && autoTopupAmount && (
            <View style={styles.autoTopupInfo}>
              <Text style={styles.autoTopupLabel}>Top-up frequency:</Text>
              <Text style={styles.autoTopupValue}>
                ₦{parseFloat(autoTopupAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {autoTopupFrequency === 'daily' ? 'day' : autoTopupFrequency === 'weekly' ? 'week' : autoTopupFrequency === 'biweekly' ? '2 weeks' : autoTopupFrequency === 'monthly' ? 'month' : autoTopupFrequency === 'quarterly' ? 'quarter' : 'year'}
              </Text>
              {autoTopupStartDate && autoTopupEndDate && (
                <>
                  <Text style={styles.autoTopupLabel}>Top-up period:</Text>
                  <Text style={styles.autoTopupValue}>
                    {formatDate(autoTopupStartDate)} to {formatDate(autoTopupEndDate)}
                  </Text>
                </>
              )}
              {autoTopupTotalCycles && (
                <>
                  <Text style={styles.autoTopupLabel}>Total cycles:</Text>
                  <Text style={styles.autoTopupValue}>{autoTopupTotalCycles}</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Budget Start Action */}
        

        {/* Wallet Lock Rule */}

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
                <Text style={styles.alertText}>Notify when vault risks failing</Text>
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
                    <Icon size={16} color={isDark ? colors.text : colors.primary} strokeWidth={1.5} />
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
        title="Create Vault"
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
    },
    autoTopupInfo: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    autoTopupLabel: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 4,
    },
    autoTopupValue: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
      alignSelf: 'center',
      paddingVertical: 6,
    },
    payoutAccountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    bankLogoContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankLogoImage: {
      width: 28,
      height: 28,
    },
    payoutAccountTextContainer: {
      flex: 1,
    },
    payoutAccountMeta: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
