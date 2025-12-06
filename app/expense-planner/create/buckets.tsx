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
import BucketAllocationSummary from '@/components/expense-planner/BucketAllocationSummary';
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
}

// Import category data structure (in a real app, this would be shared)
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

// Sub-category names mapping (simplified - in production, this would come from the same source)
const SUB_CATEGORY_NAMES: Record<string, Record<string, string>> = {
  housing_rent: {
    rent_lease: 'Rent/Lease',
    broker_fees: 'Broker Fees (Agent & Agreement Fees)',
    property_maintenance: 'Property Maintenance (Electricity, Water, Security)',
    new_property: 'New Property (Purchase, Renovation)',
  },
  utilities_bills: {
    electricity: 'Electricity',
    water: 'Water',
    waste_disposal: 'Waste Disposal',
    recharge: 'Recharge',
  },
  infrastructure_tax: {
    generator_fuel: 'Generator Fuel',
    generator_maintenance: 'Generator Maintenance',
    inverter_solar: 'Inverter/Solar',
    security_fees: 'Security Fees',
  },
  fuel_gas: {
    car_fuel: 'Car Fuel',
    cooking_gas: 'Cooking Gas',
  },
  car_maintenance: {
    car_repair: 'Car Repair',
    servicing: 'Servicing',
    car_wash: 'Car Wash',
    insurance: 'Insurance',
    road_worthiness: 'Road Worthiness',
  },
  commute: {
    public_transport: 'Public Transport (Buses, Danfo, Molue)',
    ride_hailing: 'Ride-Hailing (Bolt, Uber, In-Drive)',
    okada_tricycle: 'Okada/Tricycle',
  },
  air_travel: {
    flight_tickets: 'Flight Tickets',
    visa_fees: 'Visa Fees',
    local_hotel: 'Hotel Bookings',
  },
  food: {
    groceries: 'Groceries',
    restaurants: 'Restaurants',
    takeout: 'Takeout',
  },
  shopping: {
    general_shopping: 'General Shopping',
    online_shopping: 'Online Shopping',
  },
  clothing_fashion: {
    new_clothes: 'New Clothes',
    shoes: 'Shoes',
    accessories: 'Accessories',
    tailoring_fees: 'Tailoring Fees',
  },
  debt_payments: {
    loan_repayment: 'Loan Repayment',
    credit_card: 'Credit Card',
    high_interest_debts: 'High-Interest Debts',
  },
  financial_goals: {
    fixed_deposits: 'Savings',
    investments: 'Investments',
    emergency_fund: 'Emergency Fund',
  },
  education: {
    tuition: 'Tuition',
    textbooks: 'Textbooks',
    uniforms: 'Uniforms',
    extracurricular: 'Extracurricular',
    school_bus: 'School Bus',
  },
  child_care: {
    nanny_house_help: 'Nanny/House Help',
    daycare_creche: 'Daycare/Crèche',
    baby_supplies: 'Baby Supplies',
  },
  healthcare: {
    routine_checkups: 'Routine Check-ups',
    medication_pharmacy: 'Medication/Pharmacy',
    health_insurance: 'Health Insurance',
    gym_fitness: 'Gym/Fitness',
  },
  personal_care: {
    haircuts_salon: 'Haircuts/Salon',
    cosmetics: 'Cosmetics',
    skin_care: 'Skin Care',
  },
  data_communication: {
    data_subscription: 'Data Subscription',
    airtime_recharge: 'Airtime Recharge',
    internet_provider: 'Internet Provider',
  },
  entertainment_social: {
    nightlife: 'Nightlife',
    concerts_events: 'Concerts/Events',
    cinema: 'Cinema',
    cable_tv: 'Cable TV',
    streaming: 'Streaming',
  },
  gifts_ceremonies: {
    weddings_burials: 'Weddings/Burials',
    gifts_family: 'Gifts for Family',
  },
  miscellaneous: {
    impulse_purchases: 'Impulse Purchases',
    atm_fees: 'ATM Fees',
    petty_cash: 'Petty Cash',
  },
};

export default function BucketsScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const totalBudget = parseFloat((params.totalBudget as string) || '0');
  const budgetStructure = params.budgetStructure as string;
  
  const selectedSubCategories = useMemo(() => {
    if (!params.subCategories) return {};
    try {
      return JSON.parse(params.subCategories as string);
    } catch {
      return {};
    }
  }, [params.subCategories]);

  const [buckets, setBuckets] = useState<SubCategoryBucket[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Initialize buckets from selected sub-categories only once
    if (!initializedRef.current && Object.keys(selectedSubCategories).length > 0) {
      const initialBuckets: SubCategoryBucket[] = [];
      
      Object.entries(selectedSubCategories).forEach(([categoryId, subCategoryIds]) => {
        if (Array.isArray(subCategoryIds)) {
          subCategoryIds.forEach((subCategoryId: string) => {
            initialBuckets.push({
              id: `${categoryId}_${subCategoryId}`,
              categoryId,
              subCategoryId,
              name: SUB_CATEGORY_NAMES[categoryId]?.[subCategoryId] || subCategoryId,
              icon: CATEGORY_ICONS[categoryId] || MoreHorizontal,
              targetAmount: '',
            });
          });
        }
      });
      
      setBuckets(initialBuckets);
      initializedRef.current = true;
    }
  }, [selectedSubCategories]);

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

  const totalAllocated = buckets.reduce((sum, bucket) => {
    const amount = parseFloat(bucket.targetAmount.replace(/,/g, '') || '0');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const handleAmountChange = (id: string, amount: string) => {
    const formatted = formatAmount(amount);
    setBuckets(buckets.map(bucket => (bucket.id === id ? { ...bucket, targetAmount: formatted } : bucket)));
  };

  const handleContinue = () => {
    const bucketsWithAmounts = buckets.filter(b => b.targetAmount);
    
    if (bucketsWithAmounts.length === 0) {
      Alert.alert('Invalid Input', 'Please allocate amounts to at least one sub-category');
      haptics.notification();
      return;
    }

    if (totalAllocated > totalBudget) {
      Alert.alert(
        'Budget Exceeded',
        `Total allocated (₦${totalAllocated.toLocaleString()}) exceeds your budget (₦${totalBudget.toLocaleString()}). Please adjust your allocations.`
      );
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/review',
      params: {
        totalBudget: totalBudget.toString(),
        budgetStructure,
        buckets: JSON.stringify(bucketsWithAmounts.map(b => ({
          id: b.id,
          categoryId: b.categoryId,
          subCategoryId: b.subCategoryId,
          name: b.name,
          targetAmount: b.targetAmount.replace(/,/g, ''),
        }))),
      },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Allocate Budget</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.replace('/expense-planner');
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
          <Text style={styles.sectionTitle}>Allocate funds</Text>
          <Text style={styles.sectionDescription}>
            Distribute your budget across the selected categories
          </Text>

          <BucketAllocationSummary
            totalAllocated={totalAllocated}
            totalBudget={totalBudget}
          />

          <View style={styles.bucketsContainer}>
            {buckets.map((bucket) => {
              const Icon = bucket.icon;
              const amountValue = parseFloat(bucket.targetAmount.replace(/,/g, '') || '0');
              const percentage = totalBudget > 0 ? (amountValue / totalBudget) * 100 : 0;
              
              return (
                <View key={bucket.id} style={styles.bucketCard}>
                  <View style={styles.bucketHeader}>
                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryIconContainer}>
                        <Icon size={24} color={colors.text} strokeWidth={1.5} />
                      </View>
                      <Text style={styles.categoryName}>{bucket.name}</Text>
                    </View>
                    {bucket.targetAmount && (
                      <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
                    )}
                  </View>
                  
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>₦</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      value={bucket.targetAmount}
                      onChangeText={(amount) => handleAmountChange(bucket.id, amount)}
                      keyboardType="numeric"
                    />
                  </View>

                  {bucket.targetAmount && (
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
        disabled={totalAllocated > totalBudget || totalAllocated === 0}
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
    bucketsContainer: {
      marginTop: 24,
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
    categoryName: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
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
