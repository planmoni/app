import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Lock, Save } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function FundingChoiceScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveExpenseBuckets, saveLastStep } = useExpensePlans();
  const [isSaving, setIsSaving] = useState(false);
  
  const totalBudget = params.totalBudget as string;
  const budgetStructure: 'fixed' = 'fixed';
  const buckets = params.buckets ? JSON.parse(params.buckets as string) : [];
  const planName = params.planName as string;
  const maturityDate = (params.maturityDate as string) || (params.startDate as string);
  const planId = params.planId as string | undefined;

  const handleFundBudget = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/create-vault/fund-budget',
      params: {
        totalBudget,
        buckets: JSON.stringify(buckets),
        planName: planName || '',
        maturityDate,
        planId,
      },
    });
  };

  const handleSaveForLater = async () => {
    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Ensure we have a planId
      let activePlanId = planId;
      
      if (!activePlanId) {
        // Create draft plan with all current data
        const draftPlan = await saveDraftExpensePlan({
          total_budget: parseFloat(totalBudget),
          start_date: maturityDate || undefined,
          end_date: undefined,
        });
        
        if (!draftPlan || !draftPlan.id) {
          throw new Error('Failed to create draft plan');
        }
        
        activePlanId = draftPlan.id;
      } else {
        // Update existing draft plan with all current data
        await saveDraftExpensePlan({
          planId: activePlanId,
          total_budget: parseFloat(totalBudget),
          start_date: maturityDate || undefined,
          end_date: undefined,
        });
      }

      // Save buckets if they exist
      if (buckets && buckets.length > 0) {
        const bucketsToSave = buckets.map((bucket: any) => ({
          category_id: bucket.categoryId || bucket.category_id,
          subcategory_id: bucket.subCategoryId || bucket.subcategory_id,
          name: bucket.name,
          target_amount: parseFloat(bucket.targetAmount || bucket.target_amount || '0'),
        }));
        
        await saveExpenseBuckets(activePlanId, bucketsToSave);
      }

    // Navigate to name expense screen with funding skipped
    router.push({
      pathname: '/create-vault/name-expense',
      params: {
        totalBudget,
        buckets: JSON.stringify(buckets),
        planName: planName || '',
        maturityDate,
          planId: activePlanId,
        skipFunding: 'true',
      },
    });
    } catch (error: any) {
      console.error('Error saving plan for later:', error);
      Alert.alert('Error', error.message || 'Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Funding Options</Text>
        <Pressable 
          onPress={async () => {
            haptics.selection();
            if (planId) {
              await saveLastStep(planId, '/create-vault/funding-choice');
            }
            router.dismissTo('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>How would you like to proceed?</Text>
        <Text style={styles.description}>
          You can lock funds now to ensure they're available when needed, or save the plan for later.
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable 
            style={styles.optionCard}
            onPress={handleFundBudget}
          >
            <View style={styles.optionIconContainer}>
              <Lock size={32} color={colors.primary} />
            </View>
            <Text style={styles.optionTitle}>Fund Budget</Text>
            <Text style={styles.optionDescription}>
              Lock funds from your balance that will be accessible during your budget period
            </Text>
          </Pressable>

          <Pressable 
            style={styles.optionCard}
            onPress={handleSaveForLater}
          >
            <View style={styles.optionIconContainer}>
              <Save size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.optionTitle}>Save for Later</Text>
            <Text style={styles.optionDescription}>
              Create the plan without locking funds. You can fund it later when ready.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 32,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: 20,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    optionIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    optionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    optionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
  });

