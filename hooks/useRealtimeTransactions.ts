import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type Transaction = {
  id: string;
  user_id: string;
  type: 'deposit' | 'payout' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  source: string;
  destination: string;
  payout_plan_id?: string;
  bank_account_id?: string;
  reference?: string;
  description?: string;
  created_at: string;
};

export function useRealtimeTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchTransactions();

        // Set up real-time subscription
        const channelName = `transactions-changes-${session.user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'transactions',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload: any) => {
              console.log('Transaction change received:', payload);
              
              if (payload.eventType === 'INSERT' && payload.new) {
                setTransactions(prev => [payload.new as Transaction, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setTransactions(prev => 
                  prev.map(transaction => 
                    transaction.id === payload.new.id ? payload.new as Transaction : transaction
                  )
                );
              }
            }
          );
        // Only subscribe if not already subscribed
        if (channel.state === 'closed' || channel.state === 'leaving') {
          channel.subscribe((status: any) => {
            console.log('Transactions subscription status:', status);
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup transactions subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchTransactions = async (limit = 50) => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select(`
          *,
          payout_plans (
            name
          ),
          bank_accounts (
            bank_name,
            account_number
          )
        `)
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTransactions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
  };
}