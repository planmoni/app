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
                setBalance(payload.new.balance || 0);
                setLockedBalance(payload.new.locked_balance || 0);
                // availableBalance will be calculated automatically via useEffect
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
        .maybeSingle(); // Use maybeSingle() instead of single() to handle cases where no wallet exists

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
        throw walletError;
      }
      
      if (data) {
        console.log('Wallet data fetched successfully:');
        console.log('- Balance:', data.balance || 0);
        console.log('- Locked Balance:', data.locked_balance || 0);
        
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
        console.log('No wallet data found - wallet may not exist yet');
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
      console.error('Error in fetchWallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet');
      throw err;
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
      // availableBalance will be recalculated automatically
      
      const { data: result, error: walletError } = await supabase.rpc('add_funds', {
        arg_user_id: session?.user?.id,
        arg_amount: amount
      });

      if (walletError) {
        console.error('Error adding funds:', walletError);
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        throw walletError;
      }
      
      // Check if the operation was successful
      if (result && !result.success) {
        console.error('Add funds failed:', result.error);
        // Revert the optimistic update if there's an error
        setBalance(prevBalance => prevBalance - amount);
        throw new Error(result.error || 'Failed to add funds');
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
      console.log('- Available balance:', availableBalance);
      
      // Optimistically update the locked balance for better UX
      setLockedBalance(prevLocked => prevLocked + amount);
      // availableBalance will be recalculated automatically
      
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds', {
        arg_user_id: session?.user?.id,
        arg_amount: amount
      });

      if (lockError) {
        console.error('Error locking funds:', lockError);
        // Revert the optimistic update if there's an error
        setLockedBalance(prevLocked => prevLocked - amount);
        throw lockError;
      }
      
      // Check if the lock operation was successful
      if (lockResult && !lockResult.success) {
        console.error('Lock funds failed:', lockResult.error);
        // Revert the optimistic update if there's an error
        setLockedBalance(prevLocked => prevLocked - amount);
        throw new Error(lockResult.error || 'Failed to lock funds');
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
    availableBalance,
    isLoading,
    error,
    addFunds,
    lockFunds,
    refreshWallet: fetchWallet
  };
}