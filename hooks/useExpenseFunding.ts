import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ExpenseBucketLockedFunds } from '@/types/expense-planner';

export function useExpenseFunding() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lockFundsForBucket = async (params: {
    bucketId: string;
    amount: number;
    unlockDate: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with real Supabase RPC call
      // const { data, error } = await supabase.rpc('lock_expense_funds', {
      //   arg_user_id: session.user.id,
      //   arg_bucket_id: params.bucketId,
      //   arg_amount: params.amount,
      //   arg_unlock_date: params.unlockDate,
      // });

      // For now, return mock data
      const mockLockedFunds: ExpenseBucketLockedFunds = {
        id: `temp-${Date.now()}`,
        expense_bucket_id: params.bucketId,
        locked_amount: params.amount,
        unlock_date: params.unlockDate,
        status: 'locked',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return mockLockedFunds;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to lock funds');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const unlockFundsForBucket = async (bucketId: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with real Supabase RPC call
      // const { data, error } = await supabase.rpc('unlock_expense_funds', {
      //   arg_bucket_id: bucketId,
      // });

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unlock funds');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getLockedFundsForBucket = async (bucketId: string) => {
    if (!session?.user?.id) {
      return null;
    }

    try {
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('expense_bucket_locked_funds')
      //   .select('*')
      //   .eq('expense_bucket_id', bucketId)
      //   .eq('status', 'locked')
      //   .single();

      return null; // Mock: return null for now
    } catch (err) {
      console.error('Error fetching locked funds:', err);
      return null;
    }
  };

  return {
    lockFundsForBucket,
    unlockFundsForBucket,
    getLockedFundsForBucket,
    isLoading,
    error,
  };
}

