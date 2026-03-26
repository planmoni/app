import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBalance } from '@/contexts/BalanceContext';
import { useExpensePlans } from '@/hooks/useExpensePlans';

type CreateVaultScheduleArgs = {
  budgetPlanId: string;
  payoutAccountId: string;
  totalAmount: number;
  frequency: string;
  duration: number;
  startDate: string;
  nextPayoutDate: string;
  dayOfWeek: number | null;
  payoutHour: number;
  payoutMinute: number;
  metadata?: Record<string, unknown>;
};

export function useCreateVaultPayoutSchedule() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshWallet } = useBalance();
  const { fetchExpensePlans } = useExpensePlans();

  const createVaultPayoutSchedule = useCallback(
    async (args: CreateVaultScheduleArgs) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('create_vault_payout_schedule', {
          p_budget_plan_id: args.budgetPlanId,
          p_payout_account_id: args.payoutAccountId,
          p_total_amount: args.totalAmount,
          p_frequency: args.frequency,
          p_duration: args.duration,
          p_start_date: args.startDate,
          p_next_payout_date: args.nextPayoutDate,
          p_day_of_week: args.dayOfWeek,
          p_payout_hour: args.payoutHour,
          p_payout_minute: args.payoutMinute,
          p_metadata: args.metadata || {},
        });

        if (rpcError) throw rpcError;

        const result = data as {
          success?: boolean;
          error?: string;
          schedule_id?: string;
          plan_transaction_id?: string;
        };

        if (!result?.success) {
          throw new Error(result?.error || 'Could not create vault payout schedule');
        }

        await refreshWallet();
        await fetchExpensePlans();

        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create schedule';
        setError(message);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshWallet, fetchExpensePlans]
  );

  return { createVaultPayoutSchedule, isLoading, error };
}
