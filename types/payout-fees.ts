/**
 * Type definitions for payout fees
 */

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
