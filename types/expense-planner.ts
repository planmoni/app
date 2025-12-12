export type ExpensePlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type BudgetStructure = 'fixed' | 'estimated';

export interface ExpensePlan {
  id: string;
  user_id: string;
  name: string;
  total_budget: number;
  budget_structure: BudgetStructure;
  start_date?: string;
  end_date?: string;
  status: ExpensePlanStatus;
  total_spent: number;
  remaining_budget: number;
  created_at: string;
  updated_at: string;
  // Enhanced fields for card display
  buckets?: ExpenseBucket[];
  total_locked?: number;
  funding_status?: 'draft' | 'unfunded' | 'partially_funded' | 'funded';
  metadata?: any; // Store last_step and other metadata
  // Additional fields from database
  plan_type?: 'recurring' | 'one_time' | 'long_term';
  funding_method?: 'auto' | 'manual' | 'hybrid';
  current_balance?: number;
  required_per_cycle?: number;
  required_per_day?: number;
  payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  health_status?: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  is_paused?: boolean;
  // Metadata fields
  start_action?: 'wallet' | 'auto_payout';
  payout_account_id?: string;
  payout_account_label?: string;
  payout_account_bank_name?: string;
}

export interface ExpenseBucket {
  id: string;
  expense_plan_id: string;
  category_id: string;
  subcategory_id: string;
  name: string;
  target_amount: number;
  amount_spent: number;
  remaining_amount: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseTransaction {
  id: string;
  expense_bucket_id: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface BucketProgressStatus {
  percentage: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
  status: 'under' | 'warning' | 'over';
}

export interface ExpenseBucketLockedFunds {
  id: string;
  expense_bucket_id: string;
  locked_amount: number;
  unlock_date: string;
  status: 'locked' | 'unlocked' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface ExpenseBucketWithdrawal {
  id: string;
  expense_bucket_id: string;
  amount: number;
  payout_account_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduled_date?: string;
  transfer_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseBucketScheduledWithdrawal {
  id: string;
  expense_plan_id: string;
  payout_account_id: string;
  frequency: 'once' | 'daily' | 'weekly' | 'custom';
  start_date: string;
  end_date: string;
  amount_per_withdrawal: number;
  selected_bucket_ids: string[];
  metadata?: Record<string, any>;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

