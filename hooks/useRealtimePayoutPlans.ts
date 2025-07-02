import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

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

export function useRealtimePayoutPlans() {
  const [payoutPlans, setPayoutPlans] = useState<PayoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchPayoutPlans();

        // Set up real-time subscription
        const channelName = `payout-plans-changes-${session.user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payout_plans',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload: any) => {
              console.log('Payout plan change received:', payload);
              
              if (payload.eventType === 'INSERT' && payload.new) {
                setPayoutPlans(prev => [payload.new as PayoutPlan, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setPayoutPlans(prev => 
                  prev.map(plan => 
                    plan.id === payload.new.id ? payload.new as PayoutPlan : plan
                  )
                );
              } else if (payload.eventType === 'DELETE' && payload.old) {
                setPayoutPlans(prev => 
                  prev.filter(plan => plan.id !== payload.old.id)
                );
              }
            }
          );
        // Only subscribe if not already subscribed
        if (channel.state === 'closed' || channel.state === 'leaving') {
          channel.subscribe((status: any) => {
            console.log('Payout plans subscription status:', status);
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup payout plans subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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
      // Real-time subscription will handle the update
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
      // Real-time subscription will handle the update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume plan');
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
  };
}