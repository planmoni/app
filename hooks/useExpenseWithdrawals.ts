import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ExpenseBucketWithdrawal, ExpenseBucketScheduledWithdrawal } from '@/types/expense-planner';

export function useExpenseWithdrawals() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withdrawFunds = async (params: {
    bucketIds: string[];
    payoutAccountId: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with real Supabase RPC call
      // const { data, error } = await supabase.rpc('withdraw_expense_funds', {
      //   arg_user_id: session.user.id,
      //   arg_bucket_ids: params.bucketIds,
      //   arg_payout_account_id: params.payoutAccountId,
      // });

      // For now, return mock data
      const mockWithdrawals: ExpenseBucketWithdrawal[] = params.bucketIds.map(bucketId => ({
        id: `temp-${Date.now()}-${bucketId}`,
        expense_bucket_id: bucketId,
        amount: 0, // TODO: Get actual amount
        payout_account_id: params.payoutAccountId,
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      return mockWithdrawals;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to withdraw funds');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const scheduleWithdrawal = async (params: {
    expensePlanId: string;
    bucketIds: string[];
    payoutAccountId: string;
    frequency: 'once' | 'daily' | 'weekly' | 'custom';
    startDate: string;
    endDate: string;
    amountPerWithdrawal?: number;
    metadata?: Record<string, any>;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with real Supabase insert
      // const { data, error } = await supabase
      //   .from('expense_bucket_scheduled_withdrawals')
      //   .insert({
      //     expense_plan_id: params.expensePlanId,
      //     payout_account_id: params.payoutAccountId,
      //     frequency: params.frequency,
      //     start_date: params.startDate,
      //     end_date: params.endDate,
      //     amount_per_withdrawal: params.amountPerWithdrawal,
      //     selected_bucket_ids: params.bucketIds,
      //     metadata: params.metadata,
      //     status: 'active',
      //   })
      //   .select()
      //   .single();

      // For now, return mock data
      const mockScheduled: ExpenseBucketScheduledWithdrawal = {
        id: `temp-${Date.now()}`,
        expense_plan_id: params.expensePlanId,
        payout_account_id: params.payoutAccountId,
        frequency: params.frequency,
        start_date: params.startDate,
        end_date: params.endDate,
        amount_per_withdrawal: params.amountPerWithdrawal || 0,
        selected_bucket_ids: params.bucketIds,
        metadata: params.metadata,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return mockScheduled;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to schedule withdrawal');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getScheduledWithdrawals = async (expensePlanId: string) => {
    if (!session?.user?.id) {
      return [];
    }

    try {
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('expense_bucket_scheduled_withdrawals')
      //   .select('*')
      //   .eq('expense_plan_id', expensePlanId)
      //   .eq('status', 'active');

      return []; // Mock: return empty array for now
    } catch (err) {
      console.error('Error fetching scheduled withdrawals:', err);
      return [];
    }
  };

  return {
    withdrawFunds,
    scheduleWithdrawal,
    getScheduledWithdrawals,
    isLoading,
    error,
  };
}

