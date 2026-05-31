import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useExpensePlans } from '@/hooks/useExpensePlans';

interface Bucket {
  id: string;
  name: string;
  targetAmount: string;
  lockedAmount?: string;
  categoryId?: string;
  subCategoryId?: string;
  category_id?: string;
  subcategory_id?: string;
}

export default function NameExpenseScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { finalizeExpensePlan, saveDraftExpensePlan, saveLastStep, saveExpenseBuckets } = useExpensePlans();
  
  const totalBudget = parseFloat((params.totalBudget as string) || '0');
  const budgetStructure = (params.budgetStructure as 'fixed' | 'estimated') || 'fixed';
  const buckets: Bucket[] = params.buckets ? JSON.parse(params.buckets as string) : [];
  const maturityDate = (params.maturityDate as string) || (params.startDate as string);
  const skipFunding = params.skipFunding === 'true';
  const totalLocked = parseFloat((params.totalLocked as string) || '0');

  const [planName, setPlanName] = useState(params.planName as string || '');
  const [isCreating, setIsCreating] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(params.planId as string | undefined);
  const initializedRef = useRef(false);

  // Create draft plan on mount if it doesn't exist (fallback)
  useEffect(() => {
    const initializeDraftPlan = async () => {
      if (!currentPlanId && !initializedRef.current && totalBudget > 0) {
        initializedRef.current = true;
        try {
          console.log('No planId found on name-expense screen, creating draft plan...', {
            totalBudget,
            budgetStructure,
            maturityDate,
          });
          const draftPlan = await saveDraftExpensePlan({
            total_budget: totalBudget,
            start_date: maturityDate || undefined,
            end_date: undefined,
          });
          if (draftPlan?.id) {
            console.log('Draft plan created successfully on name-expense screen:', draftPlan.id);
            setCurrentPlanId(draftPlan.id);
          } else {
            console.error('Draft plan created but no ID returned:', draftPlan);
          }
        } catch (error) {
          console.error('Error initializing draft plan on name-expense screen:', error);
          // Don't show alert here - let handleCreate handle it
        }
      }
    };

    initializeDraftPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlanId, totalBudget]);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleCreate = async () => {
    if (!planName.trim()) {
      Alert.alert('Plan Name Required', 'Please enter a name for your expense plan');
      haptics.notification();
      return;
    }

    // Use currentPlanId if available, otherwise try params
    let planId = currentPlanId || (params.planId as string | undefined);

    haptics.mediumImpact();
    setIsCreating(true);
    
    try {
      // If planId is still missing, create draft plan first with all available data
      if (!planId) {
        console.log('No planId found in handleCreate, creating draft plan with all data...');
        const newDraftPlan = await saveDraftExpensePlan({
          name: planName.trim(),
          total_budget: totalBudget,
          start_date: maturityDate || undefined,
          end_date: undefined,
        });
        
        if (!newDraftPlan || !newDraftPlan.id) {
          throw new Error('Failed to create draft plan: No plan ID returned');
        }
        
        planId = newDraftPlan.id;
        setCurrentPlanId(newDraftPlan.id);
        console.log('Draft plan created in handleCreate:', planId);
      } else {
        // Ensure all plan data is saved before finalizing
        console.log('Saving all plan data before finalizing...', {
          planId,
          name: planName.trim(),
          totalBudget,
          budgetStructure,
          maturityDate,
        });
        
        await saveDraftExpensePlan({
          planId,
          name: planName.trim(),
          total_budget: totalBudget,
          start_date: maturityDate || undefined,
          end_date: undefined,
        });
        
        console.log('Plan data saved successfully');
      }

      // Save buckets if they exist (buckets should have been saved earlier, but ensure they're saved)
      if (buckets && buckets.length > 0 && planId) {
        console.log('Saving buckets before finalizing plan...', buckets.length);
        try {
          // Extract category_id and subcategory_id from bucket
          // Bucket id format is "categoryId_subCategoryId" or we use categoryId/subCategoryId directly
          const bucketsToSave = buckets.map((bucket: Bucket, index: number) => {
            // Try multiple ways to get category and subcategory IDs
            let categoryId = bucket.categoryId || bucket.category_id;
            let subCategoryId = bucket.subCategoryId || bucket.subcategory_id;
            
            // If not found, try to extract from id format: "categoryId_subCategoryId"
            if (!categoryId || !subCategoryId) {
              const parts = bucket.id ? bucket.id.split('_') : [];
              categoryId = categoryId || parts[0] || '';
              subCategoryId = subCategoryId || parts[1] || '';
            }
            
            return {
              category_id: categoryId,
              subcategory_id: subCategoryId,
              name: bucket.name || '',
              target_amount: parseFloat((bucket.targetAmount || '0').toString().replace(/,/g, '')),
              order_index: index,
            };
          }).filter(b => b.category_id && b.subcategory_id); // Only save buckets with valid IDs

          if (bucketsToSave.length > 0 && planId) {
            await saveExpenseBuckets(planId, bucketsToSave);
            console.log('Buckets saved successfully:', bucketsToSave.length);
          } else {
            console.warn('No valid buckets to save - all buckets missing category_id or subcategory_id');
          }
        } catch (bucketError) {
          console.error('Error saving buckets during finalization:', bucketError);
          // Don't throw - buckets might already be saved
        }
      }

      // Finalize the draft plan (change status to active and ensure name is set)
      // This changes status from 'draft' to 'active', so it will no longer show as draft
      if (!planId) {
        throw new Error('Plan ID is required to finalize plan');
      }
      
      console.log('Finalizing plan...', planId);
      const plan = await finalizeExpensePlan(planId, planName.trim());

      if (!plan || !plan.id) {
        throw new Error('Failed to finalize plan: No plan returned');
      }

      console.log('Plan finalized successfully:', plan.id);

      // Navigate to success screen
      router.replace({
        pathname: '/expense-planner/create/success',
        params: {
          planName: planName.trim(),
          totalBudget: totalBudget.toString(),
          planId: plan.id,
          skipFunding: skipFunding ? 'true' : 'false',
        },
      });
    } catch (error: any) {
      console.error('Error creating expense plan:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create expense plan. Please try again.';
      
      if (error?.message) {
        if (error.message.includes('502') || error.message.includes('Bad Gateway') || error.message.includes('temporarily unavailable')) {
          errorMessage = 'Server temporarily unavailable. Please check your internet connection and try again.';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Network connection issue. Please check your internet and try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsCreating(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Name Your Plan</Text>
        <Pressable 
          onPress={async () => {
            haptics.selection();
            const planIdToSave = currentPlanId || (params.planId as string | undefined);
            if (planIdToSave) {
              await saveLastStep(planIdToSave, '/expense-planner/create/name-expense');
            }
            router.replace('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Give your expense plan a name</Text>
          <Text style={styles.sectionDescription}>
            Choose a name that helps you identify this budget plan
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g., Holiday Trip Budget"
              placeholderTextColor={colors.textTertiary}
              value={planName}
              onChangeText={setPlanName}
              autoFocus
            />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Plan Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Budget</Text>
              <Text style={styles.summaryValue}>₦{totalBudget.toLocaleString()}</Text>
            </View>

            {maturityDate && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Maturity Date</Text>
                <Text style={styles.summaryValue}>{formatDateForDisplay(maturityDate)}</Text>
              </View>
            )}

            {!skipFunding && totalLocked > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Locked Funds</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  ₦{totalLocked.toLocaleString()}
                </Text>
              </View>
            )}

            <View style={styles.bucketsSection}>
              <Text style={styles.bucketsTitle}>Expense Buckets ({buckets.length})</Text>
              {buckets.map((bucket, index) => (
                <View key={bucket.id || index} style={styles.bucketItem}>
                  <Text style={styles.bucketName}>{bucket.name}</Text>
                  <View style={styles.bucketAmounts}>
                    <Text style={styles.bucketTarget}>
                      Target: ₦{parseFloat(bucket.targetAmount.replace(/,/g, '') || '0').toLocaleString()}
                    </Text>
                    {!skipFunding && bucket.lockedAmount && parseFloat(bucket.lockedAmount.replace(/,/g, '') || '0') > 0 && (
                      <Text style={styles.bucketLocked}>
                        Locked: ₦{parseFloat(bucket.lockedAmount.replace(/,/g, '') || '0').toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Create Plan"
        onPress={handleCreate}
        disabled={!planName.trim() || isCreating}
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
      padding: 10,
      paddingBottom: 100,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    inputContainer: {
      marginBottom: 24,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
      minHeight: 56,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      flex: 1,
    },
    summaryValue: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      textAlign: 'right',
    },
    bucketsSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bucketsTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    bucketItem: {
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bucketItemLast: {
      borderBottomWidth: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    bucketName: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    bucketAmounts: {
      gap: 4,
    },
    bucketTarget: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    bucketLocked: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.primary,
      fontWeight: '600',
    },
  });

