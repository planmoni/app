import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PayoutPlan = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  total_amount: number;
  payout_amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  duration: number;
  start_date: string;
  bank_account_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  completed_payouts: number;
  next_payout_date?: string;
  created_at: string;
  updated_at: string;
};

export function usePayoutPlans() {
  const [payoutPlans, setPayoutPlans] = useState<PayoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchPayoutPlans();
    }
  }, [session?.user?.id]);

  const fetchPayoutPlans = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('payout_plans')
        .select(`
          *,
          bank_accounts (
            bank_name,
            account_number,
            account_name
          )
        `)
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPayoutPlans(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payout plans');
    } finally {
      setIsLoading(false);
    }
  };

  const pausePlan = async (planId: string) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('payout_plans')
        .update({ status: 'paused' })
        .eq('id', planId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      await fetchPayoutPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause plan');
      throw err;
    }
  };

  const resumePlan = async (planId: string) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('payout_plans')
        .update({ status: 'active' })
        .eq('id', planId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      await fetchPayoutPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume plan');
      throw err;
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('payout_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', session?.user?.id);

      if (deleteError) throw deleteError;
      await fetchPayoutPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
      throw err;
    }
  };

  return {
    payoutPlans,
    isLoading,
    error,
    fetchPayoutPlans,
    pausePlan,
    resumePlan,
    deletePlan,
  };
}