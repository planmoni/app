import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import type { Transaction } from '@/hooks/useRealtimeTransactions';

export async function readTransactionsCache(userId: string): Promise<Transaction[] | null> {
  const cached = await readCache<Transaction[]>(CACHE_KEYS.transactions(userId));
  return Array.isArray(cached) ? cached : null;
}

export async function fetchTransactions(userId: string, limit = 50): Promise<Transaction[]> {
  const { data, error } = (await fetchWithRetry(
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
  )) as { data: Transaction[] | null; error: any };

  if (error) throw error;

  const rows = (data || []) as Transaction[];
  void writeCache(CACHE_KEYS.transactions(userId), rows);
  return rows;
}
