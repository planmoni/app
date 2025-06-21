import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchWallet();

        // Set up real-time subscription
        channel = supabase
          .channel('wallet-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'wallets',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              console.log('Wallet change received:', payload);
              
              if (payload.eventType === 'UPDATE' && payload.new) {
                setBalance(payload.new.balance);
                setLockedBalance(payload.new.locked_balance);
              }
            }
          )
          .subscribe((status) => {
            console.log('Wallet subscription status:', status);
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup wallet subscription');
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const fetchWallet = async () => {
    try {
      setError(null);
      console.log('Fetching wallet data...');
      
      const { data, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session?.user?.id)
        .single();

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
        throw walletError;
      }
      
      if (data) {
        console.log('Wallet data fetched successfully:');
        console.log('- Balance:', data.balance);
        console.log('- Locked Balance:', data.locked_balance);
        console.log('- Available Balance:', data.balance - data.locked_balance);
        
        setBalance(data.balance);
        setLockedBalance(data.locked_balance);
      } else {
        console.log('No wallet data found');
      }
    } catch (err) {
      console.error('Error in fetchWallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const addFunds = async (amount: number) => {
    try {
      setError(null);
      console.log('Adding funds to wallet:', amount);
      
      // Optimistically update the balance immediately for better UX
      setBalance(prevBalance => prevBalance + amount);
      
      const { error: walletError } = await supabase.rpc('add_funds', {
        p_amount: amount,
        p_user_id: session?.user?.id
      });

      if (walletError) {
        console.error('Error adding funds:', walletError);
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        throw walletError;
      }
      
      console.log('Funds added successfully');
      
      // Fetch the latest wallet data to ensure consistency
      await fetchWallet();
    } catch (err) {
      console.error('Error in addFunds:', err);
      setError(err instanceof Error ? err.message : 'Failed to add funds');
      throw err;
    }
  };

  const lockFunds = async (amount: number) => {
    try {
      setError(null);
      console.log('Locking funds in wallet:');
      console.log('- Amount to lock:', amount);
      console.log('- Current balance:', balance);
      console.log('- Current locked balance:', lockedBalance);
      console.log('- Available balance:', balance - lockedBalance);
      
      const { error: walletError } = await supabase.rpc('lock_funds', {
        p_amount: amount,
        p_user_id: session?.user?.id
      });

      if (walletError) {
        console.error('Error locking funds:', walletError);
        throw walletError;
      }
      
      console.log('Funds locked successfully');
      
      // Fetch the latest wallet data to ensure consistency
      await fetchWallet();
    } catch (err) {
      console.error('Error in lockFunds:', err);
      setError(err instanceof Error ? err.message : 'Failed to lock funds');
      throw err;
    }
  };

  return {
    balance,
    lockedBalance,
    isLoading,
    error,
    addFunds,
    lockFunds,
    refreshWallet: fetchWallet
  };
}