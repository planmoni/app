/**
 * Type definitions for payout fees
 */

/** Plan creation fee: 1.5% of total amount, capped at this amount in Naira. */
export const PLAN_CREATION_FEE_PERCENT = 1.5;
/** Maximum plan creation fee in Naira; fees are capped at this amount. */
export const PLAN_CREATION_FEE_CAP_NAIRA = 500;

/** Transaction fee per payout in Naira. */
export const TRANSACTION_FEE_NAIRA = 10.75;
/** Stamp duty per payout (when payout amount > threshold) in Naira. */
export const STAMP_DUTY_NAIRA = 50;
/** Payout amount above this (i.e. >= 10000) incurs stamp duty. */
export const STAMP_DUTY_THRESHOLD_NAIRA = 9999;

export type PayoutFeeFrequency = 
  | 'daily' 
  | 'weekly' 
  | 'biweekly' 
  | 'monthly' 
  | 'end_of_month' 
  | 'quarterly' 
  | 'biannual' 
  | 'annually' 
  | 'custom' 
  | 'weekly_specific';

export interface PayoutFee {
  id: string;
  frequency: PayoutFeeFrequency;
  fee_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
