import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Options = {
  enabled?: boolean;
  /** Poll wallet while active (fallback if realtime is delayed) */
  pollIntervalMs?: number;
  onDepositReceived?: (amount: number) => void;
};

/**
 * Refreshes the wallet when a deposit event is recorded.
 * Does not poll. The wallet query and wallet realtime already keep the balance current.
 */
export function useSafehavenDepositWatcher(options: Options = {}) {
  const { enabled = true, onDepositReceived } = options;
  const { session } = useAuth();
  const { refreshWallet, balance } = useBalance();
  const userId = session?.user?.id;

  const lastBalanceRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onDepositRef = useRef(onDepositReceived);
  onDepositRef.current = onDepositReceived;

  const handlePossibleDeposit = useCallback(
    async (hintAmount?: number) => {
      const prev = lastBalanceRef.current ?? balance;
      const wallet = await refreshWallet();
      const newBalance = wallet?.balance ?? balance;

      if (wallet && prev !== null && newBalance > prev) {
        onDepositRef.current?.(newBalance - prev);
      } else if (hintAmount && hintAmount > 0) {
        onDepositRef.current?.(hintAmount);
      }

      lastBalanceRef.current = newBalance;
    },
    [refreshWallet, balance]
  );

  useEffect(() => {
    lastBalanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    if (!enabled || !userId) return;

    // Wallet realtime already refreshes the balance. This channel only reacts to a recorded deposit.
    const channel = supabase
      .channel(`safehaven-deposits-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new?: { type?: string; metadata?: { amount?: number } } }) => {
          const row = payload.new;
          if (row?.type === 'deposit_successful') {
            const amount = Number(row.metadata?.amount) || 0;
            void handlePossibleDeposit(amount);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, handlePossibleDeposit]);

  const checkNow = useCallback(() => handlePossibleDeposit(), [handlePossibleDeposit]);

  return { checkNow };
}
