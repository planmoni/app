import { useState, useEffect } from 'react';
import { ExpenseTransaction } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';

export function useExpenseTransactions(bucketId: string | null) {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = async () => {
    if (!session?.user?.id || !bucketId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('expense_transactions')
      //   .select('*')
      //   .eq('expense_bucket_id', bucketId)
      //   .order('created_at', { ascending: false });
      
      // For now, return empty array
      setTransactions([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch expense transactions'));
      console.error('Error fetching expense transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createTransaction = async (transactionData: {
    expense_bucket_id: string;
    amount: number;
    description: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // TODO: Replace with real Supabase insert
      // This should also update the bucket's amount_spent and the plan's total_spent
      const newTransaction: ExpenseTransaction = {
        id: `temp-${Date.now()}`,
        expense_bucket_id: transactionData.expense_bucket_id,
        amount: transactionData.amount,
        description: transactionData.description,
        created_at: new Date().toISOString(),
      };

      setTransactions(prev => [newTransaction, ...prev]);
      return newTransaction;
    } catch (err) {
      console.error('Error creating expense transaction:', err);
      throw err;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      // TODO: Replace with real Supabase delete
      // This should also update the bucket's amount_spent and the plan's total_spent
      setTransactions(prev => prev.filter(transaction => transaction.id !== id));
    } catch (err) {
      console.error('Error deleting expense transaction:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (bucketId) {
      fetchTransactions();
    }
  }, [bucketId, session?.user?.id]);

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
    createTransaction,
    deleteTransaction,
  };
}

