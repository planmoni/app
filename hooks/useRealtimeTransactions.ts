import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache, toUserFacingError } from '@/lib/supabase-fetch';

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
      const { data, error: fetchError } = await fetchWithRetry(
        () =>
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
        'Transactions fetch'
      ) as { data: any[] | null; error: any };

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setTransactions(data as Transaction[]);
        void writeCache(CACHE_KEYS.transactions(userId), data);
      }
    } catch (err: any) {
      console.warn('Error fetching transactions:', err);
      if (!hasCachedDataRef.current) {
        setError(toUserFacingError(err, false));
      }
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
        const cached = await readCache<Transaction[]>(CACHE_KEYS.transactions(session.user.id));
        if (cached && isMounted) {
          setTransactions(cached);
          setIsLoading(false);
          hasCachedDataRef.current = true;
        }

        await fetchTransactions();

        if (!isMounted) return;

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
                setTransactions((prev) => [payload.new as Transaction, ...prev]);
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                setTransactions((prev) =>
                  prev.map((transaction) =>
                    transaction.id === payload.new.id ? (payload.new as Transaction) : transaction
                  )
                );
              }
            }
          );
        if (channel && (channel.state === 'closed' || channel.state === 'leaving')) {
          channel.subscribe(() => {});
        }
      } catch (err) {
        if (isMounted && !hasCachedDataRef.current) {
          setError(toUserFacingError(err, false));
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

  useRegisterForegroundRefetch(
    'transactions',
    2,
    () => fetchTransactions(),
    !!session?.user?.id
  );

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
  };
}
