import { useState, useEffect, useCallback } from 'react';
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
  /** True if the current user is following this plan (shared with them), not the owner */
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

export function useRealtimePayoutPlans() {
  const [payoutPlans, setPayoutPlans] = useState<PayoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchPayoutPlans = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setError(null);
      const select = `
        *,
        bank_accounts (
          bank_name,
          account_number,
          account_name
        ),
        payout_accounts (
          bank_name,
          account_number,
          account_name
        )
      `;
      const { data: ownedData, error: ownedError } = await supabase
        .from('payout_plans')
        .select(select)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;
      const owned: PayoutPlan[] = (ownedData || []).map((p: any) => ({ ...p, is_paired: false }));

      const { data: pairingRows, error: pairingError } = await supabase
        .from('payout_plan_pairings')
        .select('payout_plan_id')
        .eq('paired_user_id', session.user.id);

      if (pairingError) {
        setPayoutPlans(owned);
        return;
      }
      const pairedIds = (pairingRows || []).map((r: { payout_plan_id: string }) => r.payout_plan_id).filter(Boolean);
      if (pairedIds.length === 0) {
        setPayoutPlans(owned);
        return;
      }

      const { data: pairedData, error: pairedError } = await supabase
        .from('payout_plans')
        .select(select)
        .in('id', pairedIds)
        .order('created_at', { ascending: false });

      if (pairedError) {
        setPayoutPlans(owned);
        return;
      }
      const paired: PayoutPlan[] = (pairedData || []).map((p: any) => ({ ...p, is_paired: true }));
      const merged = [...owned];
      for (const p of paired) {
        if (!merged.some((m) => m.id === p.id)) merged.push(p);
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPayoutPlans(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payout plans');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      setPayoutPlans([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchPayoutPlans();

        if (!isMounted) return;

        // Set up real-time subscription with improved error handling
        const channelName = `payout-plans-changes-${session.user.id}`;
        console.log('🔗 Setting up real-time subscription for channel:', channelName);
        
        // Clean up existing channel if any
        if (channel) {
          try {
            supabase.removeChannel(channel);
          } catch (err) {
            // Ignore errors when removing
          }
        }
        
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
              if (!isMounted) return;
              console.log('📡 Payout plan change received:', {
                event: payload.event,
                table: payload.table,
                schema: payload.schema,
                new: payload.new,
                old: payload.old
              });
              
              if (payload.event === 'INSERT' && payload.new) {
                console.log('➕ INSERT event - adding new plan:', payload.new.name);
                setPayoutPlans(prev => [{ ...payload.new, is_paired: false } as PayoutPlan, ...prev]);
              } else if (payload.event === 'UPDATE' && payload.new) {
                console.log('✏️ UPDATE event - updating plan:', payload.new.name);
                setPayoutPlans(prev => {
                  const updated = prev.map(plan => 
                    plan.id === payload.new.id ? { ...payload.new, is_paired: plan.is_paired } as PayoutPlan : plan
                  );
                  console.log('🔄 Updated plans count:', updated.length);
                  return updated;
                });
              } else if (payload.event === 'DELETE' && payload.old) {
                console.log('🗑️ DELETE event - removing plan:', payload.old.name);
                setPayoutPlans(prev => 
                  prev.filter(plan => plan.id !== payload.old.id)
                );
              } else {
                console.log('❓ Unknown event type or missing data:', payload);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payout_plan_pairings',
              filter: `paired_user_id=eq.${session.user.id}`,
            },
            () => {
              if (!isMounted) return;
              fetchPayoutPlans();
            }
          );
        
        // Subscribe without retry logic - server-side push notifications handle delivery
        // Real-time subscription is only for UI updates when app is open
        if (channel) {
          channel.subscribe((status: any) => {
            console.log('📡 Payout plans subscription status:', status);
            switch (status) {
              case 'SUBSCRIBED':
                console.log('✅ Successfully subscribed to payout plans changes');
                break;
              case 'CHANNEL_ERROR':
                console.log('ℹ️ Channel subscription error - server-side push notifications will handle delivery');
                break;
              case 'TIMED_OUT':
                console.log('ℹ️ Channel subscription timed out - server-side push notifications will handle delivery');
                break;
              case 'CLOSED':
                console.log('🔒 Channel subscription closed');
                break;
              default:
                console.log(`ℹ️ Payout plans channel status: ${status}`);
            }
          });
        }
      } catch (err) {
        console.warn('Failed to setup payout plans subscription:', err);
        // Don't set error state for subscription failures, just log warning
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Error removing payout plans channel:', err);
        }
        channel = null;
      }
    };
  }, [session?.user?.id, fetchPayoutPlans]);

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

  const updatePlan = async (planId: string, updates: { name?: string; description?: string }) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('payout_plans')
        .update(updates)
        .eq('id', planId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      // Real-time subscription will handle the update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
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
    updatePlan,
  };
}