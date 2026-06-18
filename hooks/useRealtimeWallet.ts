import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

export function useRealtimeWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
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

      const { data, error: fetchError } = await fetchWithRetry(
        () =>
          supabase
            .from('wallets')
            .select('balance, locked_balance, available_balance')
            .eq('user_id', session.user.id)
            .single(),
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
        void writeCache(CACHE_KEYS.wallet(session.user.id), data);
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

      const { data, error: fetchError } = await fetchWithRetry(
        () =>
          supabase
            .from('wallets')
            .select('balance, locked_balance, available_balance')
            .eq('user_id', session.user.id)
            .single(),
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
        void writeCache(CACHE_KEYS.wallet(session.user.id), data);

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
        const cached = await readCache<{ balance: number; locked_balance: number; available_balance: number }>(
          CACHE_KEYS.wallet(session.user.id)
        );
        if (cached && isMounted) {
          const d = cached;
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

  useRegisterForegroundRefetch(
    'wallet',
    1,
    () => {
      void fetchWalletData();
      setupRealtimeSubscription();
    },
    !!session?.user?.id
  );

  return {
    balance,
    lockedBalance,
    availableBalance,
    isLoading,
    error,
    refreshWallet,
  };
}
