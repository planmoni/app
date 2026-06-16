import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withTimeout } from '@/lib/with-timeout';

const FETCH_TIMEOUT_MS = 12000;

export function useRealtimeWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const foregroundTick = useAppForeground();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchWalletData = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('wallets')
          .select('balance, locked_balance, available_balance')
          .eq('user_id', session.user.id)
          .single(),
        FETCH_TIMEOUT_MS,
        'Wallet fetch'
      );

      if (fetchError) {
        console.warn('Failed to fetch wallet data:', fetchError);
        setError('Failed to load wallet data');
        return;
      }

      if (data) {
        setBalance(data.balance || 0);
        setLockedBalance(data.locked_balance || 0);
        setAvailableBalance(data.available_balance || 0);
      }
    } catch (err) {
      console.warn('Error fetching wallet data:', err);
      setError('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const refreshWallet = useCallback(async () => {
    if (!session?.user?.id) {
      return null;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('wallets')
          .select('balance, locked_balance, available_balance')
          .eq('user_id', session.user.id)
          .single(),
        FETCH_TIMEOUT_MS,
        'Wallet refresh'
      );

      if (fetchError) {
        console.warn('Failed to fetch wallet data:', fetchError);
        setError('Failed to load wallet data');
        return null;
      }

      if (data) {
        const walletData = {
          balance: data.balance || 0,
          lockedBalance: data.locked_balance || 0,
          availableBalance: data.available_balance || 0,
        };

        setBalance(walletData.balance);
        setLockedBalance(walletData.lockedBalance);
        setAvailableBalance(walletData.availableBalance);

        return walletData;
      }

      return null;
    } catch (err) {
      console.warn('Error fetching wallet data:', err);
      setError('Failed to load wallet data');
      return null;
    }
  }, [session?.user?.id]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!session?.user?.id || !isSupabaseConfigured()) {
      return;
    }

    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (_) {
        // ignore
      }
      channelRef.current = null;
    }

    const channelName = `wallet-changes-${session.user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: {
          eventType: string;
          new?: {
            balance: number;
            locked_balance: number;
            available_balance: number;
          };
        }) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setBalance(payload.new.balance || 0);
            setLockedBalance(payload.new.locked_balance || 0);
            setAvailableBalance(payload.new.available_balance || 0);
            setError(null);
          }
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
        if (status === 'SUBSCRIBED') {
          setError(null);
        }
      });

    channelRef.current = channel;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    void fetchWalletData();

    const subscriptionTimer = setTimeout(() => {
      setupRealtimeSubscription();
    }, 500);

    return () => {
      clearTimeout(subscriptionTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.user?.id, fetchWalletData, setupRealtimeSubscription]);

  // Refetch wallet + reconnect realtime when app returns to foreground.
  useEffect(() => {
    if (!session?.user?.id || foregroundTick === 0) {
      return;
    }

    void fetchWalletData();
    setupRealtimeSubscription();
  }, [foregroundTick, session?.user?.id, fetchWalletData, setupRealtimeSubscription]);

  return {
    balance,
    lockedBalance,
    availableBalance,
    isLoading,
    error,
    refreshWallet,
  };
}
