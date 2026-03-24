/**
 * Plan Type Mapping
 * Maps expense categories to plan types: recurring, one_time, or long_term
 */

export type PlanType = 'recurring' | 'one_time' | 'long_term';

/**
 * Maps category IDs to their default plan type
 */
export const CATEGORY_TO_PLAN_TYPE: Record<string, PlanType> = {
  // Recurring plans - regular, ongoing expenses
  food: 'recurring',
  commute: 'recurring',
  fuel_gas: 'recurring',
  utilities_bills: 'recurring',
  data_communication: 'recurring',
  subscriptions: 'recurring',
  personal_care: 'recurring',
  child_care: 'recurring',
  car_maintenance: 'recurring',
  infrastructure_tax: 'recurring',
  business_utilities: 'recurring',
  business_subscriptions: 'recurring',
  employee_expenses: 'recurring',
  office_workspace: 'recurring',
  inventory_supplies: 'recurring',
  it_technology: 'recurring',
  
  // One-time plans - single purchases or events
  air_travel: 'one_time',
  gifts_ceremonies: 'one_time',
  shopping: 'one_time', // Can be one-time purchases like phones
  entertainment_social: 'one_time', // Events, concerts
  healthcare: 'one_time', // Can be one-time medical expenses
  education: 'one_time', // Can be one-time course purchases
  business_travel: 'one_time',
  client_entertainment: 'one_time',
  professional_development: 'one_time',
  research_development: 'one_time',
  shipping_logistics: 'one_time',
  
  // Long-term plans - major projects or large purchases
  housing_rent: 'long_term', // Especially new_property subcategory
  vehicles: 'long_term', // Especially new_car_purchase
  financial_goals: 'long_term',
  debt_payments: 'long_term',
  home_improvement: 'long_term',
  equipment_machinery: 'long_term',
  business_services: 'long_term',
  marketing_advertising: 'long_term',
  business_insurance: 'long_term',
  business_taxes_licenses: 'long_term',
  
  // Default to one_time for categories not explicitly mapped
  clothing_fashion: 'one_time',
  miscellaneous: 'one_time',
  pets_pet_care: 'recurring',
  hobbies_recreation: 'one_time',
  charitable_donations: 'one_time',
  insurance: 'recurring',
  taxes: 'recurring',
  technology_software: 'one_time',
  gardening_landscaping: 'one_time',
  sports_fitness: 'recurring',
  ground_travel: 'one_time',
  legal_services: 'one_time',
  financial_services: 'one_time',
  professional_memberships: 'recurring',
};

/**
 * Get plan type for a category
 */
export function getPlanTypeForCategory(categoryId: string): PlanType {
  return CATEGORY_TO_PLAN_TYPE[categoryId] || 'one_time';
}

/**
 * Get all categories for a specific plan type
 */
export function getCategoriesForPlanType(
  planType: PlanType,
  allCategories: Array<{ id: string; name: string; icon: any; subCategories: Array<{ id: string; name: string }> }>
): Array<{ id: string; name: string; icon: any; subCategories: Array<{ id: string; name: string }> }> {
  return allCategories.filter(category => 
    getPlanTypeForCategory(category.id) === planType
  );
}

/**
 * Plan type display information
 */
export const PLAN_TYPE_INFO: Record<PlanType, { label: string; description: string; examples: string[] }> = {
  recurring: {
    label: 'Recurring',
    description: 'Weekly/monthly budget guardrails for everyday categories',
    examples: ['Groceries', 'Transport', 'Eating out'],
  },
  one_time: {
    label: 'One-Time',
    description: 'Single purchases or events you want to budget for upfront',
    examples: ['Travel', 'New phone', 'Events'],
  },
  long_term: {
    label: 'Long-Term',
    description: 'Large or phased spending that needs a longer runway',
    examples: ['Major project', 'New car', 'Home upgrade'],
  },
};
