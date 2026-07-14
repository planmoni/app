import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

export type WalletData = {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
};

function toWalletData(row: {
  balance?: number | null;
  locked_balance?: number | null;
  available_balance?: number | null;
} | null): WalletData {
  const balance = Number(row?.balance) || 0;
  const lockedBalance = Number(row?.locked_balance) || 0;
  // Always derive available from balance - locked so UI never sticks on a stale column.
  const availableBalance = Math.max(0, balance - lockedBalance);

  return { balance, lockedBalance, availableBalance };
}

export async function readWalletCache(userId: string): Promise<WalletData | null> {
  const cached = await readCache<{
    balance: number;
    locked_balance: number;
    available_balance?: number;
  }>(CACHE_KEYS.wallet(userId));

  if (!cached) return null;
  return toWalletData(cached);
}

export async function writeWalletCache(userId: string, wallet: WalletData): Promise<void> {
  await writeCache(CACHE_KEYS.wallet(userId), {
    balance: wallet.balance,
    locked_balance: wallet.lockedBalance,
    available_balance: wallet.availableBalance,
  });
}

/** Network fetch — no stale reads. Used by query + forced refresh. */
export async function fetchWallet(userId: string): Promise<WalletData> {
  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('wallets')
        .select('balance, locked_balance, available_balance')
        .eq('user_id', userId)
        .single(),
    'Wallet fetch',
    { timeoutMs: 8000, retryDelayMs: 800 }
  )) as {
    data: { balance: number; locked_balance: number; available_balance: number } | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw error;
  }

  const wallet = toWalletData(data);
  void writeWalletCache(userId, wallet);
  return wallet;
}
