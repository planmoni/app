import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type AutomatedPayout = {
  id: string;
  payout_plan_id: string;
  user_id: string;
  scheduled_date: string;
  execution_date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  transfer_reference: string | null;
  paystack_transfer_id: string | null;
  amount: number;
  error_message: string | null;
  retry_count: number;
  retry_after: string | null;
  completed_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  payout_account_id: string | null;
  transfer_code: string | null;
  transferred_at: string | null;
  payout_plans?: {
    name: string;
    payout_amount: number;
  };
};

export function useAutomatedPayouts(planId?: string) {
  const [automatedPayouts, setAutomatedPayouts] = useState<AutomatedPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchAutomatedPayouts();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('automated-payouts-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'automated_payouts',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            console.log('Automated payout change received:', payload);
            
            if (payload.eventType === 'INSERT' && payload.new) {
              setAutomatedPayouts(prev => [payload.new as AutomatedPayout, ...prev]);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setAutomatedPayouts(prev => 
                prev.map(payout => 
                  payout.id === payload.new.id ? payload.new as AutomatedPayout : payout
                )
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setAutomatedPayouts(prev => 
                prev.filter(payout => payout.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe((status) => {
          console.log('Automated payouts subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user?.id, planId]);

  const fetchAutomatedPayouts = async () => {
    try {
      setError(null);
      
      let query = supabase
        .from('automated_payouts')
        .select(`
          *,
          payout_plans (
            name,
            payout_amount
          )
        `)
        .eq('user_id', session?.user?.id)
        .order('scheduled_date', { ascending: false });
      
      if (planId) {
        query = query.eq('payout_plan_id', planId);
      }
      
      const { data, error: fetchError } = await query.limit(50);

      if (fetchError) throw fetchError;
      setAutomatedPayouts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch automated payouts');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerPayoutProcessing = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/process-payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger payout processing');
      }
      
      // Refresh the data after processing
      await fetchAutomatedPayouts();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger payout processing';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const schedulePayouts = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/process-payouts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule payouts');
      }
      
      // Refresh the data after scheduling
      await fetchAutomatedPayouts();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule payouts';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    automatedPayouts,
    isLoading,
    error,
    fetchAutomatedPayouts,
    triggerPayoutProcessing,
    schedulePayouts,
  };
}