import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useWallet() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchWallet();
    }
  }, [session?.user?.id]);

  const fetchWallet = async () => {
    try {
      setError(null);
      const { data, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session?.user?.id)
        .single();

      if (walletError) throw walletError;
      if (data) {
        setBalance(data.balance);
        setLockedBalance(data.locked_balance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const addFunds = async (amount: number) => {
    try {
      setError(null);
      const { error: walletError } = await supabase.rpc('add_funds', {
        p_amount: amount,
        p_user_id: session?.user?.id
      });

      if (walletError) throw walletError;
      await fetchWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add funds');
      throw err;
    }
  };

  const lockFunds = async (amount: number) => {
    try {
      setError(null);
      const { error: walletError } = await supabase.rpc('lock_funds', {
        p_amount: amount,
        p_user_id: session?.user?.id
      });

      if (walletError) throw walletError;
      await fetchWallet();
    } catch (err) {
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