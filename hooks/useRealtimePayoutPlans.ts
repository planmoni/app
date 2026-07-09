import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePayoutPlansQuery } from '@/hooks/queries/usePayoutPlansQuery';

export type PayoutPlan = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  total_amount: number;
  payout_amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  duration: number;
  start_date: string;
  bank_account_id: string;
  payout_account_id?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  completed_payouts: number;
  next_payout_date?: string;
  emergency_withdrawal_enabled: boolean;
  fee_percentage?: number | null;
  fee_amount?: number | null;
  net_payout_amount?: number | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
  is_paired?: boolean;
  bank_accounts?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  payout_accounts?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
};

/**
 * @deprecated Prefer usePayoutPlansQuery — kept for backward compatibility.
 * Realtime updates are handled by RealtimeSyncProvider.
 */
export function useRealtimePayoutPlans() {
  const { session } = useAuth();
  const query = usePayoutPlansQuery();

  const pausePlan = async (planId: string) => {
    const { error: updateError } = await supabase
      .from('payout_plans')
      .update({ status: 'paused' })
      .eq('id', planId)
      .eq('user_id', session?.user?.id);

    if (updateError) throw updateError;
  };

  const resumePlan = async (planId: string) => {
    const { error: updateError } = await supabase
      .from('payout_plans')
      .update({ status: 'active' })
      .eq('id', planId)
      .eq('user_id', session?.user?.id);

    if (updateError) throw updateError;
  };

  const updatePlan = async (planId: string, updates: { name?: string; description?: string }) => {
    const { error: updateError } = await supabase
      .from('payout_plans')
      .update(updates)
      .eq('id', planId)
      .eq('user_id', session?.user?.id);

    if (updateError) throw updateError;
  };

  return {
    payoutPlans: query.payoutPlans,
    isLoading: query.isLoading,
    isTimedOut: query.isTimedOut,
    error: query.error,
    fetchPayoutPlans: async () => {
      await query.fetchPayoutPlans();
    },
    pausePlan,
    resumePlan,
    updatePlan,
  };
}
