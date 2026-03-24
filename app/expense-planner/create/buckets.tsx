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
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { 
  Plane, Utensils, ShoppingBag, Film, Receipt, Heart, GraduationCap, Car, Home, 
  Sparkles, Bed, Zap, Droplet, Wrench, CreditCard, Target, Fuel, Bus, Baby, 
  Activity, Scissors, Wifi, Smartphone, Music, Shirt, Gift, MoreHorizontal, 
  DollarSign, PiggyBank, Settings, Users, Gamepad2, Palette, Shield, Laptop, 
  Hammer, Flower2, Train, Scale, Briefcase, Megaphone, Building2, FileText, 
  Package, Server, FlaskConical, Truck
} from 'lucide-react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

interface SubCategoryBucket {
  id: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  icon: any;
  targetAmount: string;
}

// Icon wrapper for @expo/vector-icons - using outline versions only
// Ionicons are outline by default, FontAwesome5 needs solid={false}
const createIconWrapper = (IconComponent: any, name: string, solid?: boolean) => {
  return ({ size, color }: { size?: number; color?: string }) => {
    if (IconComponent === FontAwesome5) {
      return <IconComponent name={name} size={size || 24} color={color || '#000'} solid={solid || false} />;
    }
    return <IconComponent name={name} size={size || 24} color={color || '#000'} />;
  };
};

// Using Ionicons for icons not available in lucide (Ionicons are outline by default)
const PawIcon = createIconWrapper(Ionicons, 'paw-outline');
const HandHeartIcon = createIconWrapper(Ionicons, 'heart-outline');
// Using lucide icons for business-related icons (all lucide icons are outline)
const BusinessIcon = Briefcase;
const AdvertIcon = Megaphone;
const OfficeIcon = Building2;
const InventoryIcon = Package;
const ITIcon = Server;
const ShippingIcon = Truck;

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
  // New Personal Categories
  vehicles: Car,
  pets_pet_care: PawIcon,
  hobbies_recreation: Gamepad2,
  charitable_donations: HandHeartIcon,
  insurance: Shield,
  taxes: Receipt,
  subscriptions: CreditCard,
  technology_software: Laptop,
  home_improvement: Hammer,
  gardening_landscaping: Flower2,
  sports_fitness: Activity,
  ground_travel: Train,
  legal_services: Scale,
  financial_services: DollarSign,
  // New Business Categories
  employee_expenses: Users,
  business_services: BusinessIcon,
  marketing_advertising: AdvertIcon,
  office_workspace: OfficeIcon,
  business_travel: Plane,
  professional_development: GraduationCap,
  business_insurance: Shield,
  business_taxes_licenses: FileText,
  equipment_machinery: Wrench,
  inventory_supplies: InventoryIcon,
  it_technology: ITIcon,
  business_subscriptions: CreditCard,
  client_entertainment: Utensils,
  research_development: FlaskConical,
  shipping_logistics: ShippingIcon,
  business_utilities: Zap,
  professional_memberships: Users,
};

// Sub-category names mapping (simplified - in production, this would come from the same source)
const SUB_CATEGORY_NAMES: Record<string, Record<string, string>> = {
  housing_rent: {
    rent_lease: 'House Rent',
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
    cruise: 'Cruise',
    travel_insurance: 'Travel Insurance',
    travel_gear: 'Travel Gear & Luggage',
  },
  food: {
    restaurants: 'Restaurants',
    takeout: 'Takeout',
    cooking: 'Cooking',
    drinks: 'Drinks',
    non_alcoholic_beverages: 'Non-Alcoholic Beverages',
    alcoholic_beverages: 'Alcoholic Beverages',
    catering: 'Catering Services',
    meal_prep: 'Meal Prep Services',
  },
  shopping: {
    general_shopping: 'General Shopping',
    online_shopping: 'Online Shopping',
    jumia: 'Jumia',
    konga: 'Konga',
    amazon: 'Amazon',
    aliexpress: 'AliExpress Purchases',
    vendor_payments: 'Vendor Payments',
    phones: 'Phones',
    laptops: 'Laptops',
    electronics_accessories: 'Accessories',
    home_appliances: 'Home Appliances (TVs, Fridges)',
    furniture: 'Furniture',
    decor: 'Decor',
    kitchenware: 'Kitchenware',
    bedding: 'Bedding',
    tools: 'Tools',
    materials: 'Materials',
    sports_equipment: 'Sports Equipment',
    new_clothes: 'New Clothes',
    shoes: 'Shoes',
    fashion_accessories: 'Accessories',
    tailoring_fees: 'Tailoring Fees',
    aso_ebi: 'Aso Ebi',
    general_mall_purchases: 'General Mall Purchases',
    unexpected_retail_spending: 'Unexpected Retail Spending',
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
    online_courses: 'Online Courses',
    certifications: 'Certifications',
    tutoring: 'Tutoring Services',
    school_supplies: 'School Supplies',
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
    dental: 'Dental Care',
    vision: 'Vision Care & Eyeglasses',
    mental_health: 'Mental Health Services',
    alternative_medicine: 'Alternative Medicine',
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
  // New Personal Categories
  vehicles: {
    new_car_purchase: 'New Car Purchase',
    motorcycle: 'Motorcycle',
    boat_yacht: 'Boat/Yacht',
    vehicle_registration: 'Vehicle Registration',
    vehicle_taxes: 'Vehicle Taxes',
    vehicle_loans: 'Vehicle Loans',
  },
  pets_pet_care: {
    pet_food: 'Pet Food',
    veterinary_care: 'Veterinary Care',
    pet_grooming: 'Pet Grooming',
    pet_insurance: 'Pet Insurance',
    pet_supplies: 'Pet Supplies',
    pet_boarding: 'Pet Boarding',
  },
  hobbies_recreation: {
    gaming: 'Gaming',
    photography: 'Photography',
    art_supplies: 'Art Supplies',
    music_instruments: 'Music Instruments',
    books: 'Books',
    collectibles: 'Collectibles',
  },
  charitable_donations: {
    religious_donations: 'Religious Donations',
    charity_organizations: 'Charity Organizations',
    community_support: 'Community Support',
    fundraising_events: 'Fundraising Events',
  },
  insurance: {
    life_insurance: 'Life Insurance',
    auto_insurance: 'Auto Insurance',
    home_insurance: 'Home Insurance',
    health_insurance_personal: 'Health Insurance',
    travel_insurance_personal: 'Travel Insurance',
  },
  taxes: {
    personal_income_tax: 'Personal Income Tax',
    property_tax: 'Property Tax',
    capital_gains_tax: 'Capital Gains Tax',
    tax_preparation_fees: 'Tax Preparation Fees',
  },
  subscriptions: {
    streaming_services: 'Streaming Services',
    software_subscriptions: 'Software Subscriptions',
    magazine_subscriptions: 'Magazine Subscriptions',
    gym_memberships: 'Gym Memberships',
    cloud_storage: 'Cloud Storage',
  },
  technology_software: {
    software_licenses: 'Software Licenses',
    cloud_services: 'Cloud Services',
    tech_support: 'Tech Support',
    device_insurance: 'Device Insurance',
  },
  home_improvement: {
    renovations: 'Renovations',
    repairs: 'Repairs',
    painting: 'Painting',
    flooring: 'Flooring',
    roofing: 'Roofing',
    plumbing: 'Plumbing',
    electrical_work: 'Electrical Work',
  },
  gardening_landscaping: {
    garden_supplies: 'Garden Supplies',
    landscaping_services: 'Landscaping Services',
    lawn_care: 'Lawn Care',
    plant_purchases: 'Plant Purchases',
  },
  sports_fitness: {
    sports_equipment: 'Sports Equipment',
    gym_membership: 'Gym Membership',
    personal_training: 'Personal Training',
    sports_club_fees: 'Sports Club Fees',
    event_tickets: 'Event Tickets',
  },
  ground_travel: {
    bus_tickets: 'Bus Tickets',
    train_tickets: 'Train Tickets',
    car_rental: 'Car Rental',
    taxi_services: 'Taxi Services',
    parking_fees: 'Parking Fees',
  },
  legal_services: {
    legal_consultation: 'Legal Consultation',
    document_preparation: 'Document Preparation',
    court_fees: 'Court Fees',
    notary_services: 'Notary Services',
  },
  financial_services: {
    banking_fees: 'Banking Fees',
    investment_fees: 'Investment Fees',
    financial_advisor_fees: 'Financial Advisor Fees',
    account_maintenance: 'Account Maintenance',
  },
  // New Business Categories
  employee_expenses: {
    employee_salaries: 'Employee Salaries',
    payroll_processing: 'Payroll Processing',
    employee_benefits: 'Employee Benefits',
    contractors: 'Contractors',
    freelancers: 'Freelancers',
    bonuses: 'Bonuses',
    commissions: 'Commissions',
  },
  business_services: {
    legal_services_business: 'Legal Services',
    accounting_services: 'Accounting Services',
    consulting: 'Consulting',
    it_services: 'IT Services',
    hr_services: 'HR Services',
    marketing_agencies: 'Marketing Agencies',
  },
  marketing_advertising: {
    digital_advertising: 'Digital Advertising',
    print_advertising: 'Print Advertising',
    social_media_marketing: 'Social Media Marketing',
    seo_services: 'SEO Services',
    content_creation: 'Content Creation',
    pr_services: 'PR Services',
  },
  office_workspace: {
    office_rent: 'Office Rent',
    office_utilities: 'Office Utilities',
    office_supplies: 'Office Supplies',
    office_furniture: 'Office Furniture',
    office_equipment: 'Office Equipment',
    cleaning_services: 'Cleaning Services',
  },
  business_travel: {
    business_flights: 'Business Flights',
    hotel_bookings_business: 'Hotel Bookings',
    business_meals: 'Business Meals',
    conference_fees: 'Conference Fees',
    travel_insurance_business: 'Travel Insurance',
  },
  professional_development: {
    training_courses: 'Training Courses',
    certifications_business: 'Certifications',
    conferences: 'Conferences',
    workshops: 'Workshops',
    professional_memberships: 'Professional Memberships',
  },
  business_insurance: {
    liability_insurance: 'Liability Insurance',
    business_property_insurance: 'Business Property Insurance',
    workers_compensation: 'Workers Compensation',
    professional_indemnity: 'Professional Indemnity',
  },
  business_taxes_licenses: {
    business_tax: 'Business Tax',
    license_fees: 'License Fees',
    permit_fees: 'Permit Fees',
    regulatory_compliance: 'Regulatory Compliance',
  },
  equipment_machinery: {
    manufacturing_equipment: 'Manufacturing Equipment',
    office_equipment_business: 'Office Equipment',
    vehicles_business: 'Vehicles',
    tools_business: 'Tools',
    maintenance_equipment: 'Maintenance',
  },
  inventory_supplies: {
    raw_materials: 'Raw Materials',
    finished_goods: 'Finished Goods',
    office_supplies_business: 'Office Supplies',
    manufacturing_supplies: 'Manufacturing Supplies',
  },
  it_technology: {
    software_licenses_business: 'Software Licenses',
    cloud_infrastructure: 'Cloud Infrastructure',
    it_support: 'IT Support',
    hardware: 'Hardware',
    cybersecurity: 'Cybersecurity',
  },
  business_subscriptions: {
    saas_subscriptions: 'SaaS Subscriptions',
    software_licenses_subscriptions: 'Software Licenses',
    service_subscriptions: 'Service Subscriptions',
    platform_fees: 'Platform Fees',
  },
  client_entertainment: {
    client_meals: 'Client Meals',
    client_events: 'Client Events',
    corporate_gifts: 'Corporate Gifts',
    hospitality: 'Hospitality',
  },
  research_development: {
    rd_expenses: 'R&D Expenses',
    product_development: 'Product Development',
    testing: 'Testing',
    prototyping: 'Prototyping',
  },
  shipping_logistics: {
    shipping_costs: 'Shipping Costs',
    freight: 'Freight',
    delivery_services: 'Delivery Services',
    warehouse_costs: 'Warehouse Costs',
    customs_fees: 'Customs Fees',
  },
  business_utilities: {
    business_electricity: 'Business Electricity',
    business_water: 'Business Water',
    business_internet: 'Business Internet',
    business_phone: 'Business Phone',
  },
  professional_memberships: {
    industry_associations: 'Industry Associations',
    professional_bodies: 'Professional Bodies',
    trade_organizations: 'Trade Organizations',
  },
};

export default function BucketsScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveExpenseBuckets, saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  const totalBudget = parseFloat((params.totalBudget as string) || '0');
  const planId = params.planId as string | undefined;
  const budgetStructure: 'fixed' = 'fixed';
  const [isSaving, setIsSaving] = useState(false);
  
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
    const numericAmount = parseFloat(formatted.replace(/,/g, '') || '0');
    
    // For fixed budgets, prevent exceeding the total budget
    if (budgetStructure === 'fixed') {
      // Calculate total of all other buckets (excluding the one being edited)
      const otherBucketsTotal = buckets
        .filter(b => b.id !== id)
        .reduce((sum, bucket) => {
          const amount = parseFloat(bucket.targetAmount.replace(/,/g, '') || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
      
      // Calculate maximum allowed for this bucket
      const maxAllowed = totalBudget - otherBucketsTotal;
      
      // If the new amount exceeds the maximum, cap it at the maximum
      if (numericAmount > maxAllowed) {
        const cappedAmount = formatAmount(maxAllowed.toString());
        setBuckets(buckets.map(bucket => (bucket.id === id ? { ...bucket, targetAmount: cappedAmount } : bucket)));
        return;
      }
    }
    
    setBuckets(buckets.map(bucket => (bucket.id === id ? { ...bucket, targetAmount: formatted } : bucket)));
  };

  const handleContinue = async () => {
    const bucketsWithAmounts = buckets.filter(b => b.targetAmount);
    
    if (bucketsWithAmounts.length === 0) {
      Alert.alert('Invalid Input', 'Please allocate amounts to at least one sub-category');
      haptics.notification();
      return;
    }

    // Only enforce budget limit for fixed budgets
    if (budgetStructure === 'fixed' && totalAllocated > totalBudget) {
      Alert.alert(
        'Budget Exceeded',
        `Total allocated (₦${totalAllocated.toLocaleString()}) exceeds your budget (₦${totalBudget.toLocaleString()}). Please adjust your allocations.`
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
        console.log('No planId found in buckets screen, creating draft plan...');
        const newDraftPlan = await saveDraftExpensePlan({
          total_budget: totalBudget,
        });
        
        if (!newDraftPlan || !newDraftPlan.id) {
          throw new Error('Failed to create draft plan: No plan ID returned');
        }
        
        activePlanId = newDraftPlan.id;
        console.log('Draft plan created in buckets screen:', activePlanId);
      }

      if (!activePlanId) {
        throw new Error('Plan ID is required to save buckets');
      }

      // Save buckets to database
      const bucketsToSave = bucketsWithAmounts.map((b, index) => ({
        category_id: b.categoryId,
        subcategory_id: b.subCategoryId,
        name: b.name,
        target_amount: parseFloat(b.targetAmount.replace(/,/g, '') || '0'),
        order_index: index,
      }));

      await saveExpenseBuckets(activePlanId, bucketsToSave);

      // Get dates from params if they exist (from dates screen)
      const startDate = params.startDate as string | undefined;
      const endDate = params.endDate as string | undefined;

      router.push({
        pathname: '/expense-planner/create/funding-choice',
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
          startDate: startDate || '',
          endDate: endDate || '',
          planId: activePlanId,
        },
      });
    } catch (error) {
      console.error('Error saving buckets:', error);
      Alert.alert('Error', 'Failed to save buckets. Please try again.');
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
        <Text style={styles.headerTitle}>Allocate Budget</Text>
        <Pressable 
          onPress={async () => {
            haptics.selection();
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/buckets');
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
          <Text style={styles.sectionTitle}>Allocate funds</Text>
          <Text style={styles.sectionDescription}>
            Distribute your budget across the selected categories
          </Text>

          <BucketAllocationSummary
            totalAllocated={totalAllocated}
            totalBudget={totalBudget}
          />

          <Text style={styles.budgetQuestion}>How much will you be spending on the following?</Text>

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
        disabled={(budgetStructure === 'fixed' && totalAllocated > totalBudget) || totalAllocated === 0 || isSaving}
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
    budgetQuestion: {
      fontSize: getScaledFontSize(12, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      marginTop: 15,
    },
    bucketsContainer: {
      marginTop: 10,
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
