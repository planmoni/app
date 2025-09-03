import { useState, useEffect } from 'react';
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

  // Calculate available balance whenever balance or locked balance changes
  useEffect(() => {
    setAvailableBalance(balance - lockedBalance);
  }, [balance, lockedBalance]);

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: any;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchWallet();

        // Set up real-time subscription
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
            (payload: any) => {
              
              if (payload.eventType === 'UPDATE' && payload.new) {
                setBalance(payload.new.balance || 0);
                setLockedBalance(payload.new.locked_balance || 0);
                // availableBalance will be calculated automatically via useEffect
              }
            }
          );
        // Only subscribe if not already subscribed
        if (channel.state === 'closed' || channel.state === 'leaving') {
          channel.subscribe((status: any) => {
          });
        }
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
      
      const { data, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session?.user?.id)
        .single();

      if (walletError) {
        throw walletError;
      }
      
      if (data) {
        
        const newBalance = data.balance || 0;
        const newLockedBalance = data.locked_balance || 0;
        
        setBalance(newBalance);
        setLockedBalance(newLockedBalance);
        // availableBalance will be calculated automatically via useEffect
        
        // Return the fetched values for immediate use
        return {
          balance: newBalance,
          lockedBalance: newLockedBalance,
          availableBalance: newBalance - newLockedBalance
        };
      } else {
        // Initialize with zeros if no wallet found
        setBalance(0);
        setLockedBalance(0);
        // availableBalance will be calculated automatically via useEffect
        
        return {
          balance: 0,
          lockedBalance: 0,
          availableBalance: 0
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const addFunds = async (amount: number) => {
    try {
      setError(null);
      
      // Optimistically update the balance immediately for better UX
      setBalance(prevBalance => prevBalance + amount);
      // availableBalance will be recalculated automatically
      
      // First, create a transaction record
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: session?.user?.id,
          type: 'deposit',
          amount: amount,
          status: 'completed',
          source: 'wallet_deposit',
          destination: 'user_wallet',
          reference: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          description: 'Wallet deposit'
        })
        .select()
        .single();
      
      if (transactionError) {
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        throw transactionError;
      }
      
      
      // Then update the wallet balance
      
      const { data: result, error: walletError } = await supabase.rpc('add_funds', {
        arg_user_id: session?.user?.id,
        arg_amount: amount
      });


      if (walletError) {
        
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        
        // Update the transaction status to failed
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transactionData?.id);
          
        throw walletError;
      }
      
      // Check if the operation was successful
      if (result && !result.success) {
        
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        
        // Update the transaction status to failed
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transactionData?.id);
          
        throw new Error(result.error || 'Failed to add funds');
      }
      
      
      // Fetch the latest wallet data to ensure consistency
      const updatedWallet = await fetchWallet();
      
      return updatedWallet;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds');
      throw err;
    }
  };

  const lockFunds = async (amount: number) => {
    try {
      setError(null);
      
      // Optimistically update the locked balance for better UX
      setLockedBalance(prevLocked => prevLocked + amount);
      // availableBalance will be recalculated automatically
      
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds', {
        arg_user_id: session?.user?.id,
        arg_amount: amount
      });

      if (lockError) {
        // Revert the optimistic update if there's an error
        setLockedBalance(prevLocked => prevLocked - amount);
        throw lockError;
      }
      
      // Check if the lock operation was successful
      if (lockResult && !lockResult.success) {
        // Revert the optimistic update if there's an error
        setLockedBalance(prevLocked => prevLocked - amount);
        throw new Error(lockResult.error || 'Failed to lock funds');
      }
      
      
      // Fetch the latest wallet data to ensure consistency
      await fetchWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock funds');
      throw err;
    }
  };

  return {
    balance,
    lockedBalance,
    availableBalance,
    isLoading,
    error,
    addFunds,
    lockFunds,
    refreshWallet: fetchWallet
  };
}