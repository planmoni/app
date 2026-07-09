import { useWalletQuery } from '@/hooks/queries/useWalletQuery';

/**
 * @deprecated Prefer useWalletQuery — kept for backward compatibility.
 * Realtime updates are handled by RealtimeSyncProvider.
 */
export function useRealtimeWallet() {
  const query = useWalletQuery();

  return {
    balance: query.balance,
    lockedBalance: query.lockedBalance,
    availableBalance: query.availableBalance,
    isLoading: query.isLoading,
    isTimedOut: query.isTimedOut,
    error: query.error,
    refreshWallet: query.refreshWallet,
  };
}
