import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withRetryOnTimeout } from '@/lib/with-timeout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FETCH_TIMEOUT_MS = 15000;
const WALLET_CACHE_KEY_PREFIX = 'cache_wallet_';

export function useRealtimeWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const foregroundTick = useAppForeground();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasCachedDataRef = useRef(false);

  const fetchWalletData = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await withRetryOnTimeout(
        () =>
          supabase
            .from('wallets')
            .select('balance, locked_balance, available_balance')
            .eq('user_id', session.user.id)
            .single(),
        FETCH_TIMEOUT_MS,
        'Wallet fetch'
      ) as { data: { balance: number; locked_balance: number; available_balance: number } | null; error: any };

      if (fetchError) {
        console.warn('Failed to fetch wallet data:', fetchError);
        setError('Failed to load wallet data');
        return;
      }

      if (data) {
        setBalance(data.balance || 0);
        setLockedBalance(data.locked_balance || 0);
        setAvailableBalance(data.available_balance || 0);
        AsyncStorage.setItem(
          `${WALLET_CACHE_KEY_PREFIX}${session.user.id}`,
          JSON.stringify(data)
        ).catch(() => {});
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

      const { data, error: fetchError } = await withRetryOnTimeout(
        () =>
          supabase
            .from('wallets')
            .select('balance, locked_balance, available_balance')
            .eq('user_id', session.user.id)
            .single(),
        FETCH_TIMEOUT_MS,
        'Wallet refresh'
      ) as { data: { balance: number; locked_balance: number; available_balance: number } | null; error: any };

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
        AsyncStorage.setItem(
          `${WALLET_CACHE_KEY_PREFIX}${session.user.id}`,
          JSON.stringify(data)
        ).catch(() => {});

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
      hasCachedDataRef.current = false;
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let subscriptionTimer: ReturnType<typeof setTimeout>;

    const init = async () => {
      // Show cached data instantly while we fetch fresh
      try {
        const cached = await AsyncStorage.getItem(`${WALLET_CACHE_KEY_PREFIX}${session.user.id}`);
        if (cached && isMounted) {
          const d = JSON.parse(cached);
          setBalance(d.balance || 0);
          setLockedBalance(d.locked_balance || 0);
          setAvailableBalance(d.available_balance || 0);
          setIsLoading(false);
          hasCachedDataRef.current = true;
        }
      } catch (_) {}

      if (!isMounted) return;

      void fetchWalletData();

      subscriptionTimer = setTimeout(() => {
        if (isMounted) setupRealtimeSubscription();
      }, 500);
    };

    init();

    return () => {
      isMounted = false;
      clearTimeout(subscriptionTimer!);
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
