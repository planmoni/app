import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '@/lib/with-timeout';

const TRANSACTIONS_CACHE_KEY_PREFIX = 'cache_transactions_';
const FETCH_TIMEOUT_MS = 15000;

export type Transaction = {
  id: string;
  user_id: string;
  type: 'deposit' | 'payout' | 'withdrawal' | 'expense_plan_topup' | 'referral_bonus';
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
  const hasCachedDataRef = useRef(false);

  const fetchTransactions = useCallback(async (limit = 50) => {
    const userId = session?.user?.id;
    if (!userId) {
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);
      const { data, error: fetchError } = await withTimeout(
        supabase
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
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
        FETCH_TIMEOUT_MS,
        'Transactions fetch'
      ) as { data: any[] | null; error: any };

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setTransactions(data as Transaction[]);
        AsyncStorage.setItem(
          `${TRANSACTIONS_CACHE_KEY_PREFIX}${userId}`,
          JSON.stringify(data)
        ).catch(() => {});
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        // Show cached data instantly while we fetch fresh
        try {
          const cached = await AsyncStorage.getItem(`${TRANSACTIONS_CACHE_KEY_PREFIX}${session.user.id}`);
          if (cached && isMounted) {
            setTransactions(JSON.parse(cached));
            setIsLoading(false);
            hasCachedDataRef.current = true;
          }
        } catch (_) {}

        // Initial fresh fetch
        await fetchTransactions();

        if (!isMounted) return;

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
              if (!isMounted) return;
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
        if (channel && (channel.state === 'closed' || channel.state === 'leaving')) {
          channel.subscribe((status: any) => {
            // Silence realtime subscription noise (CHANNEL_ERROR/TIMED_OUT)
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to setup transactions subscription');
        }
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Error removing transactions channel:', err);
        }
      }
    };
  }, [session?.user?.id, fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
  };
}