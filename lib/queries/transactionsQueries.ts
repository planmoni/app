import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import { PAGE_SIZE } from '@/lib/queries/keys';
import type { Transaction } from '@/hooks/useRealtimeTransactions';

export async function readTransactionsCache(userId: string): Promise<Transaction[] | null> {
  const cached = await readCache<Transaction[]>(CACHE_KEYS.transactions(userId));
  return Array.isArray(cached) ? cached : null;
}

const select = `
  *,
  payout_plans (
    name
  ),
  bank_accounts (
    bank_name,
    account_number
  )
`;

/** First-page / home summary fetch — capped. */
export async function fetchTransactions(
  userId: string,
  limit: number = PAGE_SIZE.transactions
): Promise<Transaction[]> {
  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('transactions')
        .select(select)
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

/** Paginated fetch for the full transactions screen. */
export async function fetchTransactionsPage(
  userId: string,
  pageParam = 0,
  pageSize = PAGE_SIZE.transactions
): Promise<{ items: Transaction[]; nextPage: number | undefined }> {
  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('transactions')
        .select(select)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to),
    'Transactions page'
  )) as { data: Transaction[] | null; error: any };

  if (error) throw error;

  const items = (data || []) as Transaction[];
  if (pageParam === 0) {
    void writeCache(CACHE_KEYS.transactions(userId), items);
  }

  return {
    items,
    nextPage: items.length === pageSize ? pageParam + 1 : undefined,
  };
}
