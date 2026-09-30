import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { financialQueryKeys } from '@/lib/queries/keys';
import { noteNextWalletFetchReason } from '@/lib/queries/walletQueries';

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
      () => {
        noteNextWalletFetchReason('balance_change');
        void queryClient.invalidateQueries({
          queryKey: financialQueryKeys.wallet(userId),
          refetchType: 'active',
        });
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
      () => {
        void queryClient.invalidateQueries({ queryKey: ['payoutPlans', userId] });
        void queryClient.invalidateQueries({
          queryKey: financialQueryKeys.payoutPlansInfinite(userId),
        });
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
        void queryClient.invalidateQueries({ queryKey: ['payoutPlans', userId] });
        void queryClient.invalidateQueries({
          queryKey: financialQueryKeys.payoutPlansInfinite(userId),
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
      () => {
        void queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
        void queryClient.invalidateQueries({
          queryKey: financialQueryKeys.transactionsInfinite(userId),
        });
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
