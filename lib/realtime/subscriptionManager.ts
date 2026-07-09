import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { financialQueryKeys } from '@/lib/queries/keys';
import type { WalletData } from '@/lib/queries/walletQueries';
import type { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';
import type { Transaction } from '@/hooks/useRealtimeTransactions';
import { fetchPayoutPlans } from '@/lib/queries/payoutPlansQueries';

type ActiveSubscription = {
  userId: string;
  channels: RealtimeChannel[];
};

let active: ActiveSubscription | null = null;

function removeChannels(channels: RealtimeChannel[]) {
  for (const channel of channels) {
    try {
      supabase.removeChannel(channel);
    } catch (_) {
      // ignore teardown errors
    }
  }
}

export function teardownFinancialRealtime(): void {
  if (active) {
    removeChannels(active.channels);
    active = null;
  }
}

export function subscribeFinancialRealtime(userId: string, queryClient: QueryClient): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  teardownFinancialRealtime();

  const channels: RealtimeChannel[] = [];

  const walletChannel = supabase
    .channel(`financial-wallet-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${userId}`,
      },
      (payload: {
        eventType: string;
        new?: { balance: number; locked_balance: number; available_balance: number };
      }) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const wallet: WalletData = {
            balance: payload.new.balance || 0,
            lockedBalance: payload.new.locked_balance || 0,
            availableBalance: payload.new.available_balance || 0,
          };
          queryClient.setQueryData(financialQueryKeys.wallet(userId), wallet);
        } else {
          void queryClient.invalidateQueries({ queryKey: financialQueryKeys.wallet(userId) });
        }
      }
    )
    .subscribe();
  channels.push(walletChannel);

  const payoutPlansChannel = supabase
    .channel(`financial-payout-plans-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payout_plans',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { eventType?: string; event?: string; new?: PayoutPlan; old?: PayoutPlan }) => {
        const event = payload.eventType ?? payload.event;
        const key = financialQueryKeys.payoutPlans(userId);
        const current = queryClient.getQueryData<PayoutPlan[]>(key) ?? [];

        if (event === 'INSERT' && payload.new) {
          queryClient.setQueryData(key, [{ ...payload.new, is_paired: false }, ...current]);
          return;
        }
        if (event === 'UPDATE' && payload.new) {
          queryClient.setQueryData(
            key,
            current.map((plan) =>
              plan.id === payload.new!.id
                ? { ...payload.new!, is_paired: plan.is_paired }
                : plan
            )
          );
          return;
        }
        if (event === 'DELETE' && payload.old) {
          queryClient.setQueryData(
            key,
            current.filter((plan) => plan.id !== payload.old!.id)
          );
          return;
        }
        void queryClient.invalidateQueries({ queryKey: key });
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payout_plan_pairings',
        filter: `paired_user_id=eq.${userId}`,
      },
      () => {
        void fetchPayoutPlans(userId).then((plans) => {
          queryClient.setQueryData(financialQueryKeys.payoutPlans(userId), plans);
        });
      }
    )
    .subscribe();
  channels.push(payoutPlansChannel);

  const transactionsChannel = supabase
    .channel(`financial-transactions-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { eventType?: string; new?: Transaction }) => {
        const key = financialQueryKeys.transactions(userId, 50);
        const current = queryClient.getQueryData<Transaction[]>(key) ?? [];

        if (payload.eventType === 'INSERT' && payload.new) {
          queryClient.setQueryData(key, [payload.new, ...current]);
          return;
        }
        if (payload.eventType === 'UPDATE' && payload.new) {
          queryClient.setQueryData(
            key,
            current.map((tx) => (tx.id === payload.new!.id ? payload.new! : tx))
          );
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
      }
    )
    .subscribe();
  channels.push(transactionsChannel);

  active = { userId, channels };

  return () => {
    if (active?.userId === userId) {
      removeChannels(active.channels);
      active = null;
    }
  };
}
