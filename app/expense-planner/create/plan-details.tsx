import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, X, Search, Plane, Utensils, ShoppingBag, Film, Receipt, Heart, 
  GraduationCap, Car, Home, Sparkles, Hotel, Bed, Zap, Droplet, Wrench, 
  CreditCard, Target, Fuel, Bus, Baby, Activity, Scissors, Wifi, Smartphone, 
  Music, Shirt, Gift, MoreHorizontal, DollarSign, PiggyBank, Settings, Users,
  Gamepad2, Palette, Shield, Laptop, Hammer, Flower2, Train, Scale, Briefcase,
  Megaphone, Building2, FileText, Package, Server, FlaskConical, Truck
} from 'lucide-react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { getPlanTypeForCategory, PlanType } from '@/lib/planTypeMapping';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const CARD_MARGIN = 12;
const CARD_WIDTH = (SCREEN_WIDTH - (PADDING * 2) - (CARD_MARGIN * 2)) / 3; // 3 cards visible at a time
const CARD_HEIGHT = 100;

// Icon wrapper components for @expo/vector-icons to match lucide API
// Using outline versions only - Ionicons are outline by default, FontAwesome5 needs solid={false}
const createIconWrapper = (IconComponent: any, name: string, solid?: boolean) => {
  return ({ size, color, strokeWidth }: { size?: number; color?: string; strokeWidth?: number }) => {
    if (IconComponent === FontAwesome5) {
      return <IconComponent name={name} size={size || 24} color={color || '#000'} solid={solid || false} />;
    }
    return <IconComponent name={name} size={size || 24} color={color || '#000'} />;
  };
};

// @expo/vector-icons wrappers - all using outline versions
// Using Ionicons for icons not available in lucide (Ionicons are outline by default)
const PawIcon = createIconWrapper(Ionicons, 'paw-outline');
const MotorcycleIcon = createIconWrapper(Ionicons, 'bicycle-outline');
const BoatIcon = createIconWrapper(Ionicons, 'boat-outline');
const HandHeartIcon = createIconWrapper(Ionicons, 'heart-outline');
// Using lucide icons for business-related icons (all lucide icons are outline)
const BusinessIcon = Briefcase;
const AdvertIcon = Megaphone;
const OfficeIcon = Building2;
const InventoryIcon = Package;
const ITIcon = Server;
const ShippingIcon = Truck;

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
  note?: string;
}

export const CATEGORIES: Category[] = [
  { 
    id: 'air_travel', 
    name: 'Air & Travel', 
    icon: Plane,
    subCategories: [
      { id: 'flight_tickets', name: 'Flight Tickets' },
      { id: 'visa_fees', name: 'Visa Fees' },
      { id: 'local_hotel', name: 'Hotel Bookings' },
      { id: 'cruise', name: 'Cruise' },
      { id: 'travel_insurance', name: 'Travel Insurance' },
      { id: 'travel_gear', name: 'Travel Gear & Luggage' },
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
      { id: 'online_courses', name: 'Online Courses' },
      { id: 'certifications', name: 'Certifications' },
      { id: 'tutoring', name: 'Tutoring Services' },
      { id: 'school_supplies', name: 'School Supplies' },
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
      { id: 'catering', name: 'Catering Services' },
      { id: 'meal_prep', name: 'Meal Prep Services' },
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
      { id: 'dental', name: 'Dental Care' },
      { id: 'vision', name: 'Vision Care & Eyeglasses' },
      { id: 'mental_health', name: 'Mental Health Services' },
      { id: 'alternative_medicine', name: 'Alternative Medicine' },
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
    name: 'Other Repairs', 
    icon: Wrench,
    subCategories: [
      { id: 'generator_fuel', name: 'Generator Fuel (Petrol/Diesel)' },
      { id: 'generator_maintenance', name: 'Generator Maintenance/Repair' },
      { id: 'inverter_solar', name: 'Inverter/Solar Repair' },
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
  // New Personal Categories
  { 
    id: 'vehicles', 
    name: 'Vehicles', 
    icon: Car,
    subCategories: [
      { id: 'new_car_purchase', name: 'New Car Purchase' },
      { id: 'motorcycle', name: 'Motorcycle' },
      { id: 'boat_yacht', name: 'Boat/Yacht' },
      { id: 'vehicle_registration', name: 'Vehicle Registration' },
      { id: 'vehicle_taxes', name: 'Vehicle Taxes' },
      { id: 'vehicle_loans', name: 'Vehicle Loans' },
    ],
    note: 'Major vehicle purchases and related expenses.',
  },
  { 
    id: 'pets_pet_care', 
    name: 'Pets & Pet Care', 
    icon: PawIcon,
    subCategories: [
      { id: 'pet_food', name: 'Pet Food' },
      { id: 'veterinary_care', name: 'Veterinary Care' },
      { id: 'pet_grooming', name: 'Pet Grooming' },
      { id: 'pet_insurance', name: 'Pet Insurance' },
      { id: 'pet_supplies', name: 'Pet Supplies' },
      { id: 'pet_boarding', name: 'Pet Boarding' },
    ],
  },
  { 
    id: 'hobbies_recreation', 
    name: 'Hobbies & Recreation', 
    icon: Gamepad2,
    subCategories: [
      { id: 'gaming', name: 'Gaming' },
      { id: 'photography', name: 'Photography' },
      { id: 'art_supplies', name: 'Art Supplies' },
      { id: 'music_instruments', name: 'Music Instruments' },
      { id: 'books', name: 'Books' },
      { id: 'collectibles', name: 'Collectibles' },
    ],
  },
  { 
    id: 'charitable_donations', 
    name: 'Charitable Donations', 
    icon: HandHeartIcon,
    subCategories: [
      { id: 'religious_donations', name: 'Religious Donations' },
      { id: 'charity_organizations', name: 'Charity Organizations' },
      { id: 'community_support', name: 'Community Support' },
      { id: 'fundraising_events', name: 'Fundraising Events' },
    ],
  },
  { 
    id: 'insurance', 
    name: 'Insurance', 
    icon: Shield,
    subCategories: [
      { id: 'life_insurance', name: 'Life Insurance' },
      { id: 'auto_insurance', name: 'Auto Insurance' },
      { id: 'home_insurance', name: 'Home Insurance' },
      { id: 'health_insurance_personal', name: 'Health Insurance' },
      { id: 'travel_insurance_personal', name: 'Travel Insurance' },
    ],
  },
  { 
    id: 'taxes', 
    name: 'Taxes', 
    icon: Receipt,
    subCategories: [
      { id: 'personal_income_tax', name: 'Personal Income Tax' },
      { id: 'property_tax', name: 'Property Tax' },
      { id: 'capital_gains_tax', name: 'Capital Gains Tax' },
      { id: 'tax_preparation_fees', name: 'Tax Preparation Fees' },
    ],
  },
  { 
    id: 'subscriptions', 
    name: 'Subscriptions', 
    icon: CreditCard,
    subCategories: [
      { id: 'streaming_services', name: 'Streaming Services' },
      { id: 'software_subscriptions', name: 'Software Subscriptions' },
      { id: 'magazine_subscriptions', name: 'Magazine Subscriptions' },
      { id: 'gym_memberships', name: 'Gym Memberships' },
      { id: 'cloud_storage', name: 'Cloud Storage' },
    ],
  },
  { 
    id: 'technology_software', 
    name: 'Technology & Software', 
    icon: Laptop,
    subCategories: [
      { id: 'software_licenses', name: 'Software Licenses' },
      { id: 'cloud_services', name: 'Cloud Services' },
      { id: 'tech_support', name: 'Tech Support' },
      { id: 'device_insurance', name: 'Device Insurance' },
    ],
  },
  { 
    id: 'home_improvement', 
    name: 'Home Improvement', 
    icon: Hammer,
    subCategories: [
      { id: 'renovations', name: 'Renovations' },
      { id: 'repairs', name: 'Repairs' },
      { id: 'painting', name: 'Painting' },
      { id: 'flooring', name: 'Flooring' },
      { id: 'roofing', name: 'Roofing' },
      { id: 'plumbing', name: 'Plumbing' },
      { id: 'electrical_work', name: 'Electrical Work' },
    ],
  },
  { 
    id: 'gardening_landscaping', 
    name: 'Gardening & Landscaping', 
    icon: Flower2,
    subCategories: [
      { id: 'garden_supplies', name: 'Garden Supplies' },
      { id: 'landscaping_services', name: 'Landscaping Services' },
      { id: 'lawn_care', name: 'Lawn Care' },
      { id: 'plant_purchases', name: 'Plant Purchases' },
    ],
  },
  { 
    id: 'sports_fitness', 
    name: 'Sports & Fitness', 
    icon: Activity,
    subCategories: [
      { id: 'sports_equipment', name: 'Sports Equipment' },
      { id: 'gym_membership', name: 'Gym Membership' },
      { id: 'personal_training', name: 'Personal Training' },
      { id: 'sports_club_fees', name: 'Sports Club Fees' },
      { id: 'event_tickets', name: 'Event Tickets' },
    ],
  },
  { 
    id: 'ground_travel', 
    name: 'Ground Travel', 
    icon: Train,
    subCategories: [
      { id: 'bus_tickets', name: 'Bus Tickets' },
      { id: 'train_tickets', name: 'Train Tickets' },
      { id: 'car_rental', name: 'Car Rental' },
      { id: 'taxi_services', name: 'Taxi Services' },
      { id: 'parking_fees', name: 'Parking Fees' },
    ],
  },
  { 
    id: 'legal_services', 
    name: 'Legal Services', 
    icon: Scale,
    subCategories: [
      { id: 'legal_consultation', name: 'Legal Consultation' },
      { id: 'document_preparation', name: 'Document Preparation' },
      { id: 'court_fees', name: 'Court Fees' },
      { id: 'notary_services', name: 'Notary Services' },
    ],
  },
  { 
    id: 'financial_services', 
    name: 'Financial Services', 
    icon: DollarSign,
    subCategories: [
      { id: 'banking_fees', name: 'Banking Fees' },
      { id: 'investment_fees', name: 'Investment Fees' },
      { id: 'financial_advisor_fees', name: 'Financial Advisor Fees' },
      { id: 'account_maintenance', name: 'Account Maintenance' },
    ],
  },
  // New Business Categories
  { 
    id: 'employee_expenses', 
    name: 'Employee Expenses', 
    icon: Users,
    subCategories: [
      { id: 'employee_salaries', name: 'Employee Salaries' },
      { id: 'payroll_processing', name: 'Payroll Processing' },
      { id: 'employee_benefits', name: 'Employee Benefits' },
      { id: 'contractors', name: 'Contractors' },
      { id: 'freelancers', name: 'Freelancers' },
      { id: 'bonuses', name: 'Bonuses' },
      { id: 'commissions', name: 'Commissions' },
    ],
  },
  { 
    id: 'business_services', 
    name: 'Business Services', 
    icon: BusinessIcon,
    subCategories: [
      { id: 'legal_services_business', name: 'Legal Services' },
      { id: 'accounting_services', name: 'Accounting Services' },
      { id: 'consulting', name: 'Consulting' },
      { id: 'it_services', name: 'IT Services' },
      { id: 'hr_services', name: 'HR Services' },
      { id: 'marketing_agencies', name: 'Marketing Agencies' },
    ],
  },
  { 
    id: 'marketing_advertising', 
    name: 'Marketing & Advertising', 
    icon: AdvertIcon,
    subCategories: [
      { id: 'digital_advertising', name: 'Digital Advertising' },
      { id: 'print_advertising', name: 'Print Advertising' },
      { id: 'social_media_marketing', name: 'Social Media Marketing' },
      { id: 'seo_services', name: 'SEO Services' },
      { id: 'content_creation', name: 'Content Creation' },
      { id: 'pr_services', name: 'PR Services' },
    ],
  },
  { 
    id: 'office_workspace', 
    name: 'Office & Workspace', 
    icon: OfficeIcon,
    subCategories: [
      { id: 'office_rent', name: 'Office Rent' },
      { id: 'office_utilities', name: 'Office Utilities' },
      { id: 'office_supplies', name: 'Office Supplies' },
      { id: 'office_furniture', name: 'Office Furniture' },
      { id: 'office_equipment', name: 'Office Equipment' },
      { id: 'cleaning_services', name: 'Cleaning Services' },
    ],
  },
  { 
    id: 'business_travel', 
    name: 'Business Travel', 
    icon: Plane,
    subCategories: [
      { id: 'business_flights', name: 'Business Flights' },
      { id: 'hotel_bookings_business', name: 'Hotel Bookings' },
      { id: 'business_meals', name: 'Business Meals' },
      { id: 'conference_fees', name: 'Conference Fees' },
      { id: 'travel_insurance_business', name: 'Travel Insurance' },
    ],
  },
  { 
    id: 'professional_development', 
    name: 'Professional Development', 
    icon: GraduationCap,
    subCategories: [
      { id: 'training_courses', name: 'Training Courses' },
      { id: 'certifications_business', name: 'Certifications' },
      { id: 'conferences', name: 'Conferences' },
      { id: 'workshops', name: 'Workshops' },
      { id: 'professional_memberships', name: 'Professional Memberships' },
    ],
  },
  { 
    id: 'business_insurance', 
    name: 'Business Insurance', 
    icon: Shield,
    subCategories: [
      { id: 'liability_insurance', name: 'Liability Insurance' },
      { id: 'business_property_insurance', name: 'Business Property Insurance' },
      { id: 'workers_compensation', name: 'Workers Compensation' },
      { id: 'professional_indemnity', name: 'Professional Indemnity' },
    ],
  },
  { 
    id: 'business_taxes_licenses', 
    name: 'Business Taxes & Licenses', 
    icon: FileText,
    subCategories: [
      { id: 'business_tax', name: 'Business Tax' },
      { id: 'license_fees', name: 'License Fees' },
      { id: 'permit_fees', name: 'Permit Fees' },
      { id: 'regulatory_compliance', name: 'Regulatory Compliance' },
    ],
  },
  { 
    id: 'equipment_machinery', 
    name: 'Equipment & Machinery', 
    icon: Wrench,
    subCategories: [
      { id: 'manufacturing_equipment', name: 'Manufacturing Equipment' },
      { id: 'office_equipment_business', name: 'Office Equipment' },
      { id: 'vehicles_business', name: 'Vehicles' },
      { id: 'tools_business', name: 'Tools' },
      { id: 'maintenance_equipment', name: 'Maintenance' },
    ],
  },
  { 
    id: 'inventory_supplies', 
    name: 'Inventory & Supplies', 
    icon: InventoryIcon,
    subCategories: [
      { id: 'raw_materials', name: 'Raw Materials' },
      { id: 'finished_goods', name: 'Finished Goods' },
      { id: 'office_supplies_business', name: 'Office Supplies' },
      { id: 'manufacturing_supplies', name: 'Manufacturing Supplies' },
    ],
  },
  { 
    id: 'it_technology', 
    name: 'IT & Technology', 
    icon: ITIcon,
    subCategories: [
      { id: 'software_licenses_business', name: 'Software Licenses' },
      { id: 'cloud_infrastructure', name: 'Cloud Infrastructure' },
      { id: 'it_support', name: 'IT Support' },
      { id: 'hardware', name: 'Hardware' },
      { id: 'cybersecurity', name: 'Cybersecurity' },
    ],
  },
  { 
    id: 'business_subscriptions', 
    name: 'Business Subscriptions', 
    icon: CreditCard,
    subCategories: [
      { id: 'saas_subscriptions', name: 'SaaS Subscriptions' },
      { id: 'software_licenses_subscriptions', name: 'Software Licenses' },
      { id: 'service_subscriptions', name: 'Service Subscriptions' },
      { id: 'platform_fees', name: 'Platform Fees' },
    ],
  },
  { 
    id: 'client_entertainment', 
    name: 'Client Entertainment', 
    icon: Utensils,
    subCategories: [
      { id: 'client_meals', name: 'Client Meals' },
      { id: 'client_events', name: 'Client Events' },
      { id: 'corporate_gifts', name: 'Corporate Gifts' },
      { id: 'hospitality', name: 'Hospitality' },
    ],
  },
  { 
    id: 'research_development', 
    name: 'Research & Development', 
    icon: FlaskConical,
    subCategories: [
      { id: 'rd_expenses', name: 'R&D Expenses' },
      { id: 'product_development', name: 'Product Development' },
      { id: 'testing', name: 'Testing' },
      { id: 'prototyping', name: 'Prototyping' },
    ],
  },
  { 
    id: 'shipping_logistics', 
    name: 'Shipping & Logistics', 
    icon: ShippingIcon,
    subCategories: [
      { id: 'shipping_costs', name: 'Shipping Costs' },
      { id: 'freight', name: 'Freight' },
      { id: 'delivery_services', name: 'Delivery Services' },
      { id: 'warehouse_costs', name: 'Warehouse Costs' },
      { id: 'customs_fees', name: 'Customs Fees' },
    ],
  },
  { 
    id: 'business_utilities', 
    name: 'Business Utilities', 
    icon: Zap,
    subCategories: [
      { id: 'business_electricity', name: 'Business Electricity' },
      { id: 'business_water', name: 'Business Water' },
      { id: 'business_internet', name: 'Business Internet' },
      { id: 'business_phone', name: 'Business Phone' },
    ],
  },
  { 
    id: 'professional_memberships', 
    name: 'Professional Memberships', 
    icon: Users,
    subCategories: [
      { id: 'industry_associations', name: 'Industry Associations' },
      { id: 'professional_bodies', name: 'Professional Bodies' },
      { id: 'trade_organizations', name: 'Trade Organizations' },
    ],
  },
].sort((a, b) => a.name.localeCompare(b.name));

export default function PlanDetailsScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveDraftExpensePlan, saveLastStep } = useExpensePlans();
  const totalBudget = params.totalBudget as string | undefined;
  const budgetStructure = params.budgetStructure as string | undefined;
  const planId = params.planId as string | undefined;
  const subCategories = params.subCategories as string | undefined;
  const preselectedCategoryId = params.preselectedCategoryId as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(planId);
  const initializedRef = useRef(false);

  // Preselect category if provided from Quick Plans
  useEffect(() => {
    if (preselectedCategoryId && !selectedCategoryId) {
      // Verify the category exists in CATEGORIES
      const categoryExists = CATEGORIES.some(c => c.id === preselectedCategoryId);
      if (categoryExists) {
        setSelectedCategoryId(preselectedCategoryId);
      }
    }
  }, [preselectedCategoryId]);

  // Load selected subcategories from params if coming from amount page
  useEffect(() => {
    if (subCategories) {
      try {
        const parsed = JSON.parse(subCategories);
        setSelectedSubCategories(parsed);
      } catch (error) {
        console.error('Error parsing subCategories:', error);
      }
    }
  }, [subCategories]);

  // Create draft plan on mount if it doesn't exist (fallback) - only if we have budget info
  useEffect(() => {
    const initializeDraftPlan = async () => {
      if (!currentPlanId && !initializedRef.current && totalBudget && budgetStructure) {
        initializedRef.current = true;
        try {
          console.log('Creating draft plan on mount...', { totalBudget, budgetStructure });
          const draftPlan = await saveDraftExpensePlan({
            total_budget: parseFloat(totalBudget),
            budget_structure: budgetStructure as 'fixed' | 'estimated',
          });
          if (draftPlan?.id) {
            console.log('Draft plan created successfully:', draftPlan.id);
            setCurrentPlanId(draftPlan.id);
          } else {
            console.error('Draft plan created but no ID returned:', draftPlan);
          }
        } catch (error) {
          console.error('Error initializing draft plan:', error);
          Alert.alert(
            'Error',
            'Failed to initialize plan. Please go back and try again.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      }
    };

    initializeDraftPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlanId, totalBudget, budgetStructure]);

  // Parse selected plan types from params
  const selectedPlanTypes = useMemo<PlanType[]>(() => {
    if (!planTypesParam) return [];
    try {
      return JSON.parse(planTypesParam);
    } catch {
      return [];
    }
  }, [planTypesParam]);

  const filteredCategories = useMemo(() => {
    let categories = CATEGORIES;

    // Filter by search query only (no longer filter by plan type)
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

  // Generate suggestions for dropdown
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: Array<{ categoryId: string; categoryName: string; subCategoryId: string; subCategoryName: string }> = [];
    
    filteredCategories.forEach(category => {
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
  }, [searchQuery, filteredCategories]);

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

  const handleContinue = async () => {
    const allSelectedSubCategories = Object.values(selectedSubCategories).flat();
    
    if (allSelectedSubCategories.length === 0) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    setIsSaving(true);

    try {
      // Use currentPlanId if available, otherwise use planId from params
      let activePlanId = currentPlanId || planId;
      
      // If we have budget info, save/update draft plan with it
      if (totalBudget && budgetStructure) {
        // If still no planId, create one now
        if (!activePlanId) {
          console.log('No planId found, creating draft plan...');
          const newDraftPlan = await saveDraftExpensePlan({
            total_budget: parseFloat(totalBudget),
            budget_structure: budgetStructure as 'fixed' | 'estimated',
          });
          
          if (!newDraftPlan || !newDraftPlan.id) {
            throw new Error('Failed to create draft plan: No plan ID returned');
          }
          
          activePlanId = newDraftPlan.id;
          setCurrentPlanId(newDraftPlan.id);
        }
        
      // Save or update draft plan
      const draftPlan = await saveDraftExpensePlan({
          planId: activePlanId,
        total_budget: parseFloat(totalBudget),
        budget_structure: budgetStructure as 'fixed' | 'estimated',
      });

        // Ensure we have a valid plan ID
        if (!draftPlan || !draftPlan.id) {
          throw new Error('Failed to save draft plan: No plan ID returned');
        }

        console.log('Draft plan saved successfully:', draftPlan.id);

        // Update currentPlanId if it changed
        if (draftPlan.id !== activePlanId) {
          setCurrentPlanId(draftPlan.id);
        }

        // Navigate to plan-name
      router.push({
          pathname: '/expense-planner/create/plan-name',
        params: {
          subCategories: JSON.stringify(selectedSubCategories),
          planId: draftPlan.id,
          ...(planTypesParam && { planTypes: planTypesParam }),
        },
      });
      } else {
        // No budget info yet - navigate to plan-name
        router.push({
          pathname: '/expense-planner/create/plan-name',
          params: {
            subCategories: JSON.stringify(selectedSubCategories),
            planId: activePlanId,
            ...(planTypesParam && { planTypes: planTypesParam }),
          },
        });
      }
    } catch (error: any) {
      console.error('Error saving draft plan:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save draft plan. Please try again.',
        [{ text: 'OK' }]
      );
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
        <Text style={styles.headerTitle}>Budget Plan</Text>
        <Pressable
          onPress={async () => {
            haptics.selection();
            // Save last step before closing
            if (currentPlanId || planId) {
              await saveLastStep(currentPlanId || planId!, '/expense-planner/create/plan-details');
            }
            router.replace('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>What are you budgeting for?</Text>

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
        disabled={Object.values(selectedSubCategories).flat().length === 0 || isSaving}
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
