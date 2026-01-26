/**
 * Policy Engine Types
 * 
 * Type definitions for the policy evaluation engine that controls
 * money access in the Platform-as-a-Service model.
 */

export type RestrictionType =
  | 'max_balance'
  | 'min_balance'
  | 'daily_limit'
  | 'transaction_limit'
  | 'withdrawal_limit'
  | 'approval_required'
  | 'time_restriction'
  | 'purpose_restriction';

export type TransactionType = 'disbursement' | 'withdrawal' | 'deposit' | 'transfer';

export type PolicyDecision = 'allow' | 'deny' | 'require_approval';

export interface PolicyRule {
  id: string;
  name: string;
  condition: PolicyCondition;
  action: PolicyDecision;
  priority: number;
}

export interface PolicyCondition {
  type: 'balance' | 'amount' | 'time' | 'frequency' | 'purpose' | 'combined';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'not_in' | 'between';
  value: number | string | string[] | { min: number; max: number };
  field?: string;
  conditions?: PolicyCondition[]; // For combined conditions
  logic?: 'AND' | 'OR';
}

export interface RestrictionValue {
  // For max_balance, min_balance, transaction_limit, withdrawal_limit
  amount?: number;
  currency?: string;
  
  // For daily_limit
  daily_amount?: number;
  reset_time?: string; // HH:MM format
  
  // For approval_required
  threshold?: number;
  approvers?: string[];
  workflow_id?: string;
  
  // For time_restriction
  allowed_hours?: { start: string; end: string }[];
  allowed_days?: number[]; // 0-6, Sunday-Saturday
  
  // For purpose_restriction
  allowed_purposes?: string[];
  blocked_purposes?: string[];
  
  // Generic metadata
  metadata?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  policy_id?: string;
  policy_name?: string;
  matched_rules: PolicyRule[];
  restrictions_checked: RestrictionCheck[];
  requires_approval: boolean;
  approval_workflow_id?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RestrictionCheck {
  restriction_id: string;
  restriction_type: RestrictionType;
  passed: boolean;
  message?: string;
  violation_value?: any;
}

export interface WalletPolicy {
  id: string;
  partner_id?: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyEvaluationContext {
  wallet_id: string;
  partner_id?: string;
  user_id: string;
  transaction_type: TransactionType;
  amount: number;
  purpose?: string;
  recipient_id?: string;
  metadata?: Record<string, any>;
}
