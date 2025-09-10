import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchWalletData = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, locked_balance, available_balance')
        .eq('user_id', session.user.id)
        .single();

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

      const { data, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, locked_balance, available_balance')
        .eq('user_id', session.user.id)
        .single();

      if (fetchError) {
        console.warn('Failed to fetch wallet data:', fetchError);
        setError('Failed to load wallet data');
        return null;
      }

      if (data) {
        const walletData = {
          balance: data.balance || 0,
          lockedBalance: data.locked_balance || 0,
          availableBalance: data.available_balance || 0
        };
        
        // Update state
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

  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const setupRealtimeSubscription = () => {
      try {
        // Set up real-time subscription with improved error handling
        const channelName = `wallet-changes-${session.user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'wallets',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              if (payload.eventType === 'UPDATE' && payload.new) {
                setBalance(payload.new.balance || 0);
                setLockedBalance(payload.new.locked_balance || 0);
                setAvailableBalance(payload.new.available_balance || 0);
              }
            }
          )
          .subscribe((status) => {
            switch (status) {
              case 'SUBSCRIBED':
                console.log('Wallet subscription successful');
                setError(null);
                break;
              case 'CHANNEL_ERROR':
                console.warn('Wallet subscription error - continuing without realtime updates');
                // Don't set error state, just log warning
                break;
              case 'TIMED_OUT':
                console.warn('Wallet subscription timed out - continuing without realtime updates');
                // Don't set error state, just log warning
                break;
              case 'CLOSED':
                console.log('Wallet subscription closed');
                break;
            }
          });
      } catch (err) {
        console.warn('Failed to setup wallet subscription:', err);
        // Don't set error state, just log warning
      }
    };

    // Fetch initial data
    fetchWalletData();

    // Set up realtime subscription with a small delay to avoid race conditions
    const subscriptionTimer = setTimeout(() => {
      setupRealtimeSubscription();
    }, 1000);

    return () => {
      clearTimeout(subscriptionTimer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id, fetchWalletData]);

  return {
    balance,
    lockedBalance,
    availableBalance,
    isLoading,
    error,
    refreshWallet,
  };
}