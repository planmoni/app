/**
 * Plan purpose taxonomy for create-payout flow.
 * Stable values are stored in payout_plans.purpose; labels/descriptions are for UI.
 */

export type PurposeOption = {
  value: string;
  label: string;
  description: string;
};

export const PURPOSE_OPTIONS: PurposeOption[] = [
  {
    value: 'personal_salary_allowance',
    label: 'Personal Salary / Allowance',
    description: 'Daily, weekly, or monthly pocket money for discretionary spending.',
  },
  {
    value: 'transportation',
    label: 'Transportation Expenses',
    description: 'Daily or weekly payouts specifically for transportation expenses.',
  },
  {
    value: 'groceries_food',
    label: 'Groceries/Food',
    description: 'A payout to ensure there is always food in the house.',
  },
  {
    value: 'family_support',
    label: 'Family Support',
    description: 'A scheduled stipend to parents, children, spouse, siblings, or other family members or dependents.',
  },
  {
    value: 'mini_salary_payroll',
    label: 'Mini Salary/Payroll',
    description: 'A scheduled payout to staff or employees.',
  },
  {
    value: 'commitments',
    label: 'Commitments',
    description: 'Recurring spiritual or social commitments (tithes, offerings, zakat, donations, charity, etc.).',
  },
  {
    value: 'personal_care',
    label: 'Personal Care',
    description: 'Monthly "Maintenance" (hair, skin, gym).',
  },
  {
    value: 'rent_service_charge',
    label: 'Rent/Service Charge',
    description: 'A recurring payout to landlord, caretaker, etc.',
  },
  {
    value: 'utility_bills',
    label: 'Utility Bills',
    description: 'Electricity (IKEDC/EKEDC), Water, Waste, etc.',
  },
  {
    value: 'internet_data',
    label: 'Internet & Data',
    description: 'Monthly internet or mobile data bundles.',
  },
  {
    value: 'online_subscriptions',
    label: 'Subscription Services',
    description: 'DSTV/GOTV, Netflix, or online subscription services.',
  },
  {
    value: 'loan_repayments',
    label: 'Loan Repayments',
    description: 'Car loans, personal bank loans, or other loan repayments.',
  },
  {
    value: 'contributions',
    label: 'Contributions / Installments',
    description: 'Daily, weekly, or monthly contribution plans or installments.',
  },
  {
    value: 'others',
    label: 'Others',
    description: 'Anything not covered by the other options.',
  },
];

/**
 * Returns display label for a purpose value. When purpose is "others" and otherText is set, returns "Others: {otherText}".
 */
export function getPurposeLabel(value: string | null | undefined, otherText?: string | null): string {
  if (!value) return '';
  if (value === 'others' && otherText && otherText.trim()) {
    return `Others: ${otherText.trim()}`;
  }
  const option = PURPOSE_OPTIONS.find((o) => o.value === value);
  return option ? option.label : value;
}
