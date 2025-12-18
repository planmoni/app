import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useRealtimeWallet } from '@/hooks/useRealtimeWallet';
import BucketAllocationSummary from '@/components/expense-planner/BucketAllocationSummary';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { supabase } from '@/lib/supabase';
import { 
  Plane, Utensils, ShoppingBag, Film, Receipt, Heart, GraduationCap, Car, Home, 
  Sparkles, Bed, Zap, Droplet, Wrench, CreditCard, Target, Fuel, Bus, Baby, 
  Activity, Scissors, Wifi, Smartphone, Music, Shirt, Gift, MoreHorizontal, 
  DollarSign, PiggyBank, Settings, Users 
} from 'lucide-react-native';

interface SubCategoryBucket {
  id: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  icon: any;
  targetAmount: string;
  lockedAmount?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  housing_rent: Home,
  utilities_bills: Zap,
  infrastructure_tax: Wrench,
  fuel_gas: Fuel,
  car_maintenance: Settings,
  commute: Bus,
  air_travel: Plane,
  food: Utensils,
  shopping: ShoppingBag,
  clothing_fashion: Shirt,
  debt_payments: CreditCard,
  financial_goals: Target,
  education: GraduationCap,
  child_care: Baby,
  healthcare: Heart,
  personal_care: Scissors,
  data_communication: Wifi,
  entertainment_social: Music,
  gifts_ceremonies: Gift,
  miscellaneous: MoreHorizontal,
};

export default function FundBudgetScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { availableBalance } = useRealtimeWallet();
  const { lockExpenseFunds, getExpenseBuckets, saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  
  const totalBudget = parseFloat((params.totalBudget as string) || '0');
  const planId = params.planId as string | undefined;
  const budgetStructure: 'fixed' = 'fixed';
  const startDate = params.startDate as string;
  const endDate = params.endDate as string;

  const [bucketStates, setBucketStates] = useState<SubCategoryBucket[]>([]);
  const [dbBuckets, setDbBuckets] = useState<Array<{ id: string; category_id: string; subcategory_id: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Fetch buckets from database if planId is available
    const fetchBuckets = async () => {
      if (planId && !initializedRef.current) {
        try {
          const buckets = await getExpenseBuckets(planId);
          setDbBuckets(buckets);
          
          // Map database buckets to state buckets
          const stateBuckets: SubCategoryBucket[] = buckets.map(bucket => ({
            id: bucket.id,
            categoryId: bucket.category_id,
            subCategoryId: bucket.subcategory_id,
            name: bucket.name,
            icon: CATEGORY_ICONS[bucket.category_id] || MoreHorizontal,
            targetAmount: bucket.target_amount.toString(),
            lockedAmount: '',
          }));
          setBucketStates(stateBuckets);
          initializedRef.current = true;
        } catch (error) {
          console.error('Error fetching buckets:', error);
          // Fallback to params if database fetch fails
          if (params.buckets) {
            try {
              const buckets: SubCategoryBucket[] = JSON.parse(params.buckets as string);
              if (buckets.length > 0) {
                const initialized = buckets.map(bucket => ({
                  ...bucket,
                  icon: CATEGORY_ICONS[bucket.categoryId] || MoreHorizontal,
                  lockedAmount: '',
                }));
                setBucketStates(initialized);
                initializedRef.current = true;
              }
            } catch (parseError) {
              console.error('Error parsing buckets:', parseError);
            }
          }
        }
      } else if (!initializedRef.current && params.buckets) {
        // Fallback: Initialize from params if no planId
        try {
          const buckets: SubCategoryBucket[] = JSON.parse(params.buckets as string);
          if (buckets.length > 0) {
            const initialized = buckets.map(bucket => ({
              ...bucket,
              icon: CATEGORY_ICONS[bucket.categoryId] || MoreHorizontal,
              lockedAmount: '',
            }));
            setBucketStates(initialized);
            initializedRef.current = true;
          }
        } catch (error) {
          console.error('Error parsing buckets:', error);
        }
      }
    };
    
    fetchBuckets();
  }, [planId, params.buckets, getExpenseBuckets]);

  const formatAmount = (value: string) => {
    let cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join('');
      cleanValue = integerPart + '.' + decimalPart;
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
    }
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return cleanValue;
  };

  const totalLocked = useMemo(() => {
    return bucketStates.reduce((sum, bucket) => {
      const amount = parseFloat(bucket.lockedAmount?.replace(/,/g, '') || '0');
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [bucketStates]);

  const handleAmountChange = (id: string, amount: string) => {
    const formatted = formatAmount(amount);
    setBucketStates(bucketStates.map(bucket => 
      bucket.id === id ? { ...bucket, lockedAmount: formatted } : bucket
    ));
  };

  const handleLockAll = () => {
    haptics.selection();
    setBucketStates(bucketStates.map(bucket => ({
      ...bucket,
      lockedAmount: formatAmount(bucket.targetAmount.replace(/,/g, '')),
    })));
  };

  const calculateUnlockDate = (startDateStr: string, endDateStr: string): string => {
    if (!startDateStr || !endDateStr) return endDateStr || startDateStr || '';
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // If start_date equals end_date, unlock on that date
    if (start.toDateString() === end.toDateString()) {
      return startDateStr;
    }
    
    // If date range, unlock on start_date (funds available from beginning)
    return startDateStr;
  };

  const handleContinue = async () => {
    const bucketsWithAmounts = bucketStates.filter(b => b.lockedAmount);
    
    if (bucketsWithAmounts.length === 0) {
      Alert.alert('No Funds Locked', 'Please lock funds for at least one expense bucket');
      haptics.notification();
      return;
    }

    if (totalLocked > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You're trying to lock ₦${totalLocked.toLocaleString()} but only have ₦${availableBalance.toLocaleString()} available. Please adjust your allocations.`
      );
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // If planId is missing, create draft plan first
      let activePlanId = planId;
      if (!activePlanId) {
        console.log('No planId found in fund-budget screen, creating draft plan...');
        const newDraftPlan = await saveDraftExpensePlan({
          total_budget: totalBudget,
          start_date: startDate,
          end_date: endDate,
        });
        
        if (!newDraftPlan || !newDraftPlan.id) {
          throw new Error('Failed to create draft plan: No plan ID returned');
        }
        
        activePlanId = newDraftPlan.id;
        console.log('Draft plan created in fund-budget screen:', activePlanId);
      }

      // Calculate unlock date
      const unlockDate = calculateUnlockDate(startDate, endDate);
      
      // Prepare bucket locks for database function
      const bucketLocks = bucketsWithAmounts.map(bucket => {
        // Use database bucket ID if available, otherwise use the state ID
        const dbBucket = dbBuckets.find(
          db => db.category_id === bucket.categoryId && db.subcategory_id === bucket.subCategoryId
        );
        const bucketId = dbBucket?.id || bucket.id;
        
        return {
          bucket_id: bucketId,
          locked_amount: parseFloat(bucket.lockedAmount?.replace(/,/g, '') || '0'),
          unlock_date: unlockDate,
        };
      });

      // Lock funds using the database function
      const result = await lockExpenseFunds(bucketLocks);
      
      if (!result || (result as any).success === false) {
        const errorMsg = (result as any)?.error || (result as any)?.message || 'Failed to lock funds. Please try again.';
        Alert.alert('Error', errorMsg);
        return;
      }

      router.push({
        pathname: '/expense-planner/create/name-expense',
        params: {
          totalBudget: totalBudget.toString(),
          budgetStructure,
          buckets: JSON.stringify(bucketStates.map(b => ({
            id: b.id,
            categoryId: b.categoryId,
            subCategoryId: b.subCategoryId,
            name: b.name,
            targetAmount: b.targetAmount.replace(/,/g, ''),
            lockedAmount: b.lockedAmount?.replace(/,/g, '') || '0',
          }))),
          planName: params.planName || '',
          startDate,
          endDate,
          totalLocked: totalLocked.toString(),
          planId: activePlanId,
        },
      });
    } catch (error: any) {
      console.error('Error locking funds:', error);
      Alert.alert('Error', error.message || 'Failed to lock funds. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Lock Funds</Text>
        <Pressable 
          onPress={async () => {
            haptics.selection();
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/fund-budget');
            }
            router.replace('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.wrapperContent}>
        <View style={styles.stickySection}>
          <Text style={styles.sectionTitle}>Lock funds for expenses</Text>
          <Text style={styles.sectionDescription}>
            Lock funds from your balance that will be accessible during your budget period
          </Text>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>₦{availableBalance.toLocaleString()}</Text>
          </View>

          <View style={styles.stickySummaryCard}>
            <BucketAllocationSummary
              totalAllocated={totalLocked}
              totalBudget={totalBudget}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {bucketStates.length > 0 && (
            <Pressable 
              style={styles.lockAllButton}
              onPress={handleLockAll}
            >
              <Text style={styles.lockAllText}>Lock All Target Amounts</Text>
            </Pressable>
          )}

          <View style={styles.bucketsContainer}>
            {bucketStates.map((bucket) => {
              const Icon = bucket.icon;
              const targetAmount = parseFloat(bucket.targetAmount.replace(/,/g, '') || '0');
              const lockedAmount = parseFloat(bucket.lockedAmount?.replace(/,/g, '') || '0');
              const percentage = targetAmount > 0 ? (lockedAmount / targetAmount) * 100 : 0;
              
              return (
                <View key={bucket.id} style={styles.bucketCard}>
                  <View style={styles.bucketHeader}>
                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryIconContainer}>
                        <Icon size={24} color={colors.text} strokeWidth={1.5} />
                      </View>
                      <View style={styles.bucketNameContainer}>
                        <Text style={styles.categoryName}>{bucket.name}</Text>
                        <Text style={styles.targetAmountText}>
                          Target: ₦{targetAmount.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    {bucket.lockedAmount && (
                      <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
                    )}
                  </View>
                  
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>₦</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      value={bucket.lockedAmount}
                      onChangeText={(amount) => handleAmountChange(bucket.id, amount)}
                      keyboardType="numeric"
                    />
                  </View>

                  {bucket.lockedAmount && (
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                            backgroundColor: percentage > 100 ? '#EF4444' : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={totalLocked === 0 || totalLocked > availableBalance || isSaving}
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
    wrapperContent: {
      flex: 1,
    },
    stickySection: {
      padding: 10,
      paddingBottom: 0,
      backgroundColor: colors.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      zIndex: 10,
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
    balanceCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stickySummaryCard: {
      marginBottom: 10,
    },
    balanceLabel: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 8,
    },
    balanceAmount: {
      fontSize: getScaledFontSize(28, textSizeMultiplier),
      fontWeight: '700',
      color: colors.primary,
    },
    lockAllButton: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lockAllText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    bucketsContainer: {
      marginTop: 8,
      gap: 16,
    },
    bucketCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bucketHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    categoryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    categoryIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bucketNameContainer: {
      flex: 1,
    },
    categoryName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    targetAmountText: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
    },
    percentageText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '600',
      color: colors.primary,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: 16,
      marginBottom: 12,
      minHeight: 56,
    },
    currencySymbol: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
  });

