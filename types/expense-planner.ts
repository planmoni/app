export type ExpensePlanStatus = 'active' | 'completed' | 'archived';

export interface ExpensePlan {
  id: string;
  user_id: string;
  name: string;
  total_budget: number;
  total_spent: number;
  remaining_budget: number;
  status: ExpensePlanStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpenseBucket {
  id: string;
  expense_plan_id: string;
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

