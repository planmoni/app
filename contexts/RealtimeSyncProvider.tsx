import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { queryClient } from '@/contexts/QueryClientProvider';
import {
  subscribeFinancialRealtime,
  teardownFinancialRealtime,
} from '@/lib/realtime/subscriptionManager';

/**
 * Single realtime subscription for wallet, payout plans, and transactions.
 * Updates React Query cache instead of per-screen hook subscriptions.
 */
export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      teardownFinancialRealtime();
      return;
    }

    const teardown = subscribeFinancialRealtime(userId, queryClient);
    return () => {
      teardown();
    };
  }, [userId]);

  return <>{children}</>;
}
