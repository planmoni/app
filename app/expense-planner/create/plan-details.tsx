import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, X, Search, Plane, Utensils, ShoppingBag, Film, Receipt, Heart, 
  GraduationCap, Car, Home, Sparkles, Hotel, Bed, Zap, Droplet, Wrench, 
  CreditCard, Target, Fuel, Bus, Baby, Activity, Scissors, Wifi, Smartphone, 
  Music, Shirt, Gift, MoreHorizontal, DollarSign, PiggyBank, Settings, Users 
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const CARD_MARGIN = 12;
const CARD_WIDTH = (SCREEN_WIDTH - (PADDING * 2) - (CARD_MARGIN * 2)) / 3; // 3 cards visible at a time
const CARD_HEIGHT = 100;

interface SubCategory {
  id: string;
  name: string;
  note?: string;
}

interface Category {
  id: string;
  name: string;
  icon: any;
  subCategories: SubCategory[];
}

const CATEGORIES: Category[] = [
  { 
    id: 'air_travel', 
    name: 'Air & Travel', 
    icon: Plane,
    subCategories: [
      { id: 'flight_tickets', name: 'Flight Tickets' },
      { id: 'visa_fees', name: 'Visa Fees' },
      { id: 'local_hotel', name: 'Hotel Bookings' },
    ],
    note: 'Crucial for the holiday scenario you described.',
  },
  { 
    id: 'car_maintenance', 
    name: 'Car Maintenance', 
    icon: Settings,
    subCategories: [
      { id: 'car_repair', name: 'Car Repair' },
      { id: 'servicing', name: 'Servicing (Oil Change)' },
      { id: 'car_wash', name: 'Car Wash' },
      { id: 'insurance', name: 'Insurance' },
      { id: 'road_worthiness', name: 'Road Worthiness' },
    ],
    note: 'Periodic maintenance can be high.',
  },
  { 
    id: 'child_care', 
    name: 'Child/Dependent Care', 
    icon: Baby,
    subCategories: [
      { id: 'nanny_house_help', name: 'Nanny/House Help Salary' },
      { id: 'daycare_creche', name: 'Daycare/Crèche Fees' },
      { id: 'baby_supplies', name: 'Baby Supplies' },
    ],
    note: 'Includes wages for domestic staff, a common household expense.',
  },
  { 
    id: 'clothing_fashion', 
    name: 'Clothing & Fashion', 
    icon: Shirt,
    subCategories: [
      { id: 'new_clothes', name: 'New Clothes' },
      { id: 'shoes', name: 'Shoes' },
      { id: 'accessories', name: 'Accessories' },
      { id: 'tailoring_fees', name: 'Tailoring Fees' },
    ],
    note: 'Nigerians place a high value on appearance.',
  },
  { 
    id: 'commute', 
    name: 'Commute', 
    icon: Bus,
    subCategories: [
      { id: 'public_transport', name: 'Public Transport (Buses, Danfo, Molue)' },
      { id: 'ride_hailing', name: 'Ride-Hailing (Bolt, Uber, In-Driver)' },
      { id: 'okada_tricycle', name: 'Okada/Tricycle' },
    ],
    note: 'For users who rely on public transport for daily commute.',
  },
  { 
    id: 'data_communication', 
    name: 'Data & Communication', 
    icon: Wifi,
    subCategories: [
      { id: 'data_subscription', name: 'Data Subscription (MTN, Glo, Airtel)' },
      { id: 'airtime_recharge', name: 'Mobile Airtime Recharge' },
      { id: 'internet_provider', name: 'Internet Service Provider (e.g., Starlink)' },
    ],
    note: 'Data is often a distinct, high-priority monthly expense.',
  },
  { 
    id: 'debt_payments', 
    name: 'Debt Payments', 
    icon: CreditCard,
    subCategories: [
      { id: 'loan_repayment', name: 'Loan Repayment (Personal/Business)' },
      { id: 'credit_card', name: 'Credit Card Payments' },
      { id: 'high_interest_debts', name: 'High-Interest Debts' },
    ],
    note: 'Critical for the 20% savings/debt portion of a budget.',
  },
  { 
    id: 'education', 
    name: 'Education', 
    icon: GraduationCap,
    subCategories: [
      { id: 'tuition', name: 'Tuition' },
      { id: 'textbooks', name: 'Textbooks' },
      { id: 'uniforms', name: 'Uniforms' },
      { id: 'extracurricular', name: 'Extracurricular Activities' },
      { id: 'school_bus', name: 'School Bus/Drop-off' },
    ],
    note: 'School fees are a massive periodic lump sum expense (termly/yearly).',
  },
  { 
    id: 'entertainment_social', 
    name: 'Entertainment & Social', 
    icon: Music,
    subCategories: [
      { id: 'nightlife', name: 'Nightlife' },
      { id: 'concerts_events', name: 'Concerts/Events' },
      { id: 'cinema', name: 'Cinema Tickets' },
      { id: 'cable_tv', name: 'Cable TV (DSTV/GOtv)' },
      { id: 'streaming', name: 'Streaming Subscriptions' },
    ],
    note: 'Includes spending on social events and flexes (like dorime culture).',
  },
  { 
    id: 'financial_goals', 
    name: 'Financial Goals', 
    icon: Target,
    subCategories: [
      { id: 'fixed_deposits', name: 'Savings (Fixed Deposits, Target Savings)' },
      { id: 'investments', name: 'Investments (Stocks, Treasury Bills, Mutual Funds)' },
      { id: 'emergency_fund', name: 'Emergency Fund' },
    ],
    note: 'A necessary "expense" that represents money set aside for the future.',
  },
  { 
    id: 'food', 
    name: 'Food & Drinks', 
    icon: Utensils,
    subCategories: [
      { id: 'restaurants', name: 'Restaurants' },
      { id: 'takeout', name: 'Takeout' },
      { id: 'cooking', name: 'Cooking' },
      { id: 'drinks', name: 'Drinks' },
      { id: 'non_alcoholic_beverages', name: 'Non-Alcoholic Beverages' },
      { id: 'alcoholic_beverages', name: 'Alcoholic Beverages' },
    ],
  },
  { 
    id: 'fuel_gas', 
    name: 'Fuel & Gas', 
    icon: Fuel,
    subCategories: [
      { id: 'car_fuel', name: 'Petrol/Diesel for Car' },
      { id: 'cooking_gas', name: 'Cooking Gas Refill' },
    ],
    note: 'Fuel costs are highly variable and sensitive to policy changes.',
  },
  { 
    id: 'gifts_ceremonies', 
    name: 'Gifts & Ceremonies', 
    icon: Gift,
    subCategories: [
      { id: 'weddings_burials', name: 'Weddings/Burials/Birthdays Contributions' },
      { id: 'gifts_family', name: 'Gifts for Family/Friends' },
    ],
    note: 'The culture of Aso Ebi and large Owambe contributions can be a major expense.',
  },
  { 
    id: 'healthcare', 
    name: 'Healthcare & Wellness', 
    icon: Heart,
    subCategories: [
      { id: 'routine_checkups', name: 'Routine Check-ups' },
      { id: 'medication_pharmacy', name: 'Medication/Pharmacy' },
      { id: 'health_insurance', name: 'Health Insurance Premiums' },
      { id: 'gym_fitness', name: 'Gym/Fitness' },
    ],
    note: 'Can include private healthcare fees which are often paid out-of-pocket.',
  },
  { 
    id: 'housing_rent', 
    name: 'Housing & Rent', 
    icon: Home,
    subCategories: [
      { id: 'rent_lease', name: 'Rent/Lease' },
      { id: 'broker_fees', name: 'Broker Fees (Agent & Agreement Fees)' },
      { id: 'property_maintenance', name: 'Property Maintenance (Electricity, Water, Security)' },
      { id: 'new_property', name: 'New Property (Purchase, Renovation)' },
    ],
    note: 'Often paid 1-2 years in advance. Broker/Legal fees can be a significant lump sum.',
  },
  { 
    id: 'infrastructure_tax', 
    name: 'Infrastructure Tax', 
    icon: Wrench,
    subCategories: [
      { id: 'generator_fuel', name: 'Generator Fuel (Petrol/Diesel)' },
      { id: 'generator_maintenance', name: 'Generator Maintenance/Repair' },
      { id: 'inverter_solar', name: 'Inverter/Solar Charging' },
      { id: 'security_fees', name: 'Private Security Fees' },
    ],
    note: 'This is a crucial, high-cost category unique to the Nigerian context due to public service shortfalls.',
  },
  { 
    id: 'miscellaneous', 
    name: 'Miscellaneous', 
    icon: MoreHorizontal,
    subCategories: [
      { id: 'impulse_purchases', name: 'Impulse Purchases' },
      { id: 'atm_fees', name: 'ATM Withdrawal Fees' },
      { id: 'petty_cash', name: 'Petty Cash' },
    ],
    note: 'A necessary catch-all for small, non-categorisable expenses.',
  },
  { 
    id: 'personal_care', 
    name: 'Personal Care & Grooming', 
    icon: Scissors,
    subCategories: [
      { id: 'haircuts_salon', name: 'Haircuts/Salon Visits' },
      { id: 'cosmetics', name: 'Cosmetics' },
      { id: 'skin_care', name: 'Skin Care Products' },
    ],
    note: 'High priority for many Nigerians (Ego Boosters).',
  },
  { 
    id: 'shopping', 
    name: 'Shopping', 
    icon: ShoppingBag,
    subCategories: [
      { id: 'general_shopping', name: 'General Shopping' },
      { id: 'online_shopping', name: 'Online Shopping' },
      { id: 'jumia', name: 'Jumia' },
      { id: 'konga', name: 'Konga' },
      { id: 'amazon', name: 'Amazon' },
      { id: 'aliexpress', name: 'AliExpress Purchases' },
      { id: 'vendor_payments', name: 'Vendor Payments' },
      { id: 'phones', name: 'Phones' },
      { id: 'laptops', name: 'Laptops' },
      { id: 'electronics_accessories', name: 'Accessories' },
      { id: 'home_appliances', name: 'Home Appliances (TVs, Fridges)' },
      { id: 'furniture', name: 'Furniture' },
      { id: 'decor', name: 'Decor' },
      { id: 'kitchenware', name: 'Kitchenware' },
      { id: 'bedding', name: 'Bedding' },
      { id: 'tools', name: 'Tools' },
      { id: 'materials', name: 'Materials' },
      { id: 'sports_equipment', name: 'Sports Equipment' },
      { id: 'new_clothes', name: 'New Clothes' },
      { id: 'shoes', name: 'Shoes' },
      { id: 'fashion_accessories', name: 'Accessories' },
      { id: 'tailoring_fees', name: 'Tailoring Fees' },
      { id: 'aso_ebi', name: 'Aso Ebi' },
      { id: 'general_mall_purchases', name: 'General Mall Purchases' },
      { id: 'unexpected_retail_spending', name: 'Unexpected Retail Spending' },
    ],
  },
  { 
    id: 'utilities_bills', 
    name: 'Utilities & Bills', 
    icon: Zap,
    subCategories: [
      { id: 'electricity', name: 'Electricity (NEPA/PHCN)' },
      { id: 'water', name: 'Water' },
      { id: 'waste_disposal', name: 'Waste Disposal' },
      { id: 'recharge', name: 'Recharge (Prepaid Meter)' },
    ],
    note: 'Must include Recharge (Prepaid Meter) as a line item.',
  },
].sort((a, b) => a.name.localeCompare(b.name));

export default function PlanDetailsScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const totalBudget = params.totalBudget as string;
  const budgetStructure = params.budgetStructure as string;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = CATEGORIES.filter(category => {
    const categoryNameMatch = category.name.toLowerCase().includes(searchQuery.toLowerCase());
    const subCategoryMatch = category.subCategories.some(subCategory =>
      subCategory.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return categoryNameMatch || subCategoryMatch;
  });

  // Generate suggestions for dropdown
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: Array<{ categoryId: string; categoryName: string; subCategoryId: string; subCategoryName: string }> = [];
    
    CATEGORIES.forEach(category => {
      category.subCategories.forEach(subCategory => {
        if (subCategory.name.toLowerCase().includes(query)) {
          results.push({
            categoryId: category.id,
            categoryName: category.name,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
          });
        }
      });
    });
    
    return results.slice(0, 5); // Limit to 5 suggestions
  }, [searchQuery]);

  const selectedCategory = selectedCategoryId ? CATEGORIES.find(c => c.id === selectedCategoryId) : null;

  const handleCategoryClick = (categoryId: string) => {
    haptics.selection();
    setSelectedCategoryId(prev => prev === categoryId ? null : categoryId);
  };

  const handleSubCategoryToggle = (categoryId: string, subCategoryId: string) => {
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

  const handleSeeAll = () => {
    haptics.selection();
    setSearchQuery('');
  };

  const handleSuggestionClick = (categoryId: string, subCategoryId: string) => {
    haptics.selection();
    // Open the category if not already open
    if (selectedCategoryId !== categoryId) {
      setSelectedCategoryId(categoryId);
    }
    // Toggle the subcategory selection
    handleSubCategoryToggle(categoryId, subCategoryId);
    setSearchQuery('');
  };

  const handleContinue = () => {
    const allSelectedSubCategories = Object.values(selectedSubCategories).flat();
    
    if (allSelectedSubCategories.length === 0) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/buckets',
      params: {
        totalBudget,
        budgetStructure,
        subCategories: JSON.stringify(selectedSubCategories),
      },
    });
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
        <Text style={styles.headerTitle}>Plan Details</Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.replace('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>What's the budget for?</Text>

          <View style={styles.searchWrapper}>
            <View style={styles.searchContainer}>
              <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            
            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <Pressable
                    key={`${suggestion.categoryId}-${suggestion.subCategoryId}-${index}`}
                    style={[
                      styles.suggestionItem,
                      index === suggestions.length - 1 && styles.suggestionItemLast,
                    ]}
                    onPress={() => handleSuggestionClick(suggestion.categoryId, suggestion.subCategoryId)}
                  >
                    <Text style={styles.suggestionText}>
                      <Text style={styles.suggestionSubCategory}>{suggestion.subCategoryName}</Text>
                      <Text style={styles.suggestionIn}> in </Text>
                      <Text style={styles.suggestionCategory}>{suggestion.categoryName}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select one or more categories</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
            style={styles.carousel}
          >
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => handleCategoryClick(category.id)}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                >
                  <Icon
                    size={32}
                    color={colors.text}
                    strokeWidth={1.5}
                  />
                  <Text style={styles.categoryName} numberOfLines={2} adjustsFontSizeToFit={false}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedCategory && (
            <View style={styles.subCategoriesSection}>
              <View style={styles.subCategoryHeader}>
                <View style={styles.subCategoryHeaderLeft}>
                  <View style={styles.subCategoryIconContainer}>
                    {React.createElement(selectedCategory.icon, { 
                      size: 24, 
                      color: colors.text, 
                      strokeWidth: 1.5 
                    })}
                  </View>
                  <Text style={styles.subCategoryTitle}>{selectedCategory.name}</Text>
                </View>
              </View>

              <View style={styles.subCategoriesList}>
                {selectedCategory.subCategories.map((subCategory) => {
                  const isSubSelected = (selectedSubCategories[selectedCategory.id] || []).includes(subCategory.id);
                  return (
                    <Pressable
                      key={subCategory.id}
                      onPress={() => handleSubCategoryToggle(selectedCategory.id, subCategory.id)}
                      style={styles.subCategoryItem}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSubSelected && styles.checkboxSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.checkboxInner,
                            isSubSelected && styles.checkboxInnerSelected,
                          ]}
                        >
                          {isSubSelected && (
                            <View style={styles.checkboxCheckmark} />
                          )}
                        </View>
                      </View>
                      <View style={styles.subCategoryTextContainer}>
                        <Text style={styles.subCategoryName}>{subCategory.name}</Text>
                        {subCategory.note && (
                          <Text style={styles.subCategoryNote}>{subCategory.note}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={Object.values(selectedSubCategories).flat().length === 0}
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
      textAlign: 'center',
      marginBottom: 20,
    },
    searchWrapper: {
      marginBottom: 24,
      position: 'relative',
      zIndex: 10,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      color: colors.text,
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    suggestionItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
    },
    suggestionSubCategory: {
      fontWeight: '600',
      color: colors.text,
    },
    suggestionIn: {
      fontWeight: '400',
      color: colors.textSecondary,
    },
    suggestionCategory: {
      fontWeight: '500',
      color: colors.textSecondary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
    },
    seeAllText: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.primary,
    },
    carousel: {
      marginHorizontal: -20,
    },
    carouselContainer: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    categoryCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: isDark ? colors.card : '#F9FAFB',
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: CARD_MARGIN,
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    categoryCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? colors.primary + '20' : '#F0F9FF',
    },
    categoryName: {
      fontSize: getScaledFontSize(11, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      marginTop: 8,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 4,
    },
    subCategoriesSection: {
      marginTop: 24,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subCategoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    subCategoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    subCategoryIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subCategoryTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    subCategoriesList: {
      gap: 12,
    },
    subCategoryItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    checkbox: {
      marginRight: 12,
      marginTop: 2,
    },
    checkboxSelected: {},
    checkboxInner: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    checkboxInnerSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxCheckmark: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    subCategoryTextContainer: {
      flex: 1,
    },
    subCategoryName: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    subCategoryNote: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 16,
    },
  });
