import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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

const DEFAULT_POLL_MS = 10_000;

/**
 * Keeps wallet balance fresh after SafeHaven bank transfers.
 * Uses existing Supabase realtime (events + wallets when enabled) and periodic refresh.
 */
export function useSafehavenDepositWatcher(options: Options = {}) {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_MS, onDepositReceived } = options;
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

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let appState: AppStateStatus = AppState.currentState;

    const refreshIfActive = () => {
      if (appState === 'active') {
        void handlePossibleDeposit();
      }
    };

    refreshIfActive();
    pollTimer = setInterval(refreshIfActive, pollIntervalMs);

    // events is already on supabase_realtime — deposit_successful fires when tx is recorded
    const channel = supabase
      .channel(`safehaven-deposits-${userId}-${Date.now()}`)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void handlePossibleDeposit();
        }
      )
      .subscribe();

    channelRef.current = channel;

    const appSub = AppState.addEventListener('change', (nextState) => {
      appState = nextState;
      if (nextState === 'active') refreshIfActive();
    });

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      appSub.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, pollIntervalMs, handlePossibleDeposit]);

  const checkNow = useCallback(() => handlePossibleDeposit(), [handlePossibleDeposit]);

  return { checkNow };
}
