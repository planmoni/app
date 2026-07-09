import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

export type WalletData = {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
};

export async function readWalletCache(userId: string): Promise<WalletData | null> {
  const cached = await readCache<{
    balance: number;
    locked_balance: number;
    available_balance: number;
  }>(CACHE_KEYS.wallet(userId));

  if (!cached) return null;

  return {
    balance: cached.balance || 0,
    lockedBalance: cached.locked_balance || 0,
    availableBalance: cached.available_balance || 0,
  };
}

export async function fetchWallet(userId: string): Promise<WalletData> {
  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('wallets')
        .select('balance, locked_balance, available_balance')
        .eq('user_id', userId)
        .single(),
    'Wallet fetch'
  )) as {
    data: { balance: number; locked_balance: number; available_balance: number } | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw error;
  }

  const wallet: WalletData = {
    balance: data?.balance || 0,
    lockedBalance: data?.locked_balance || 0,
    availableBalance: data?.available_balance || 0,
  };

  void writeCache(CACHE_KEYS.wallet(userId), {
    balance: wallet.balance,
    locked_balance: wallet.lockedBalance,
    available_balance: wallet.availableBalance,
  });

  return wallet;
}
