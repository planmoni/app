import { useTransactionsQuery } from '@/hooks/queries/useTransactionsQuery';

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

/**
 * @deprecated Prefer useTransactionsQuery — kept for backward compatibility.
 * Realtime updates are handled by RealtimeSyncProvider.
 */
export function useRealtimeTransactions() {
  const query = useTransactionsQuery();

  return {
    transactions: query.transactions,
    isLoading: query.isLoading,
    isTimedOut: query.isTimedOut,
    error: query.error,
    fetchTransactions: query.fetchTransactions,
  };
}
