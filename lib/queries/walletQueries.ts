import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import { timedOperation } from '@/lib/supabase-timing';

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

let inFlight: Promise<WalletData> | null = null;
let inFlightUserId: string | null = null;

export function isWalletFetchInFlight(): boolean {
  return inFlight != null;
}

/**
 * Network fetch — single-flight + abortable timeout (no stacked retries).
 * Concurrent callers share one in-flight request.
 */
export async function fetchWallet(userId: string): Promise<WalletData> {
  const { isFinancialMutationActive } = await import('@/lib/financial-mutation-gate');
  if (isFinancialMutationActive()) {
    const cached = await readWalletCache(userId);
    if (cached) return cached;
    throw new Error('Wallet fetch skipped during financial mutation');
  }

  if (inFlight && inFlightUserId === userId) {
    return inFlight;
  }

  const run = timedOperation(
    'db.wallets',
    async () => {
      const { data, error } = (await fetchWithRetry(
        () =>
          supabase
            .from('wallets')
            .select('balance, locked_balance, available_balance')
            .eq('user_id', userId)
            .single(),
        'Wallet fetch',
        { timeoutMs: 8000, retryDelayMs: 400, maxRetries: 0 }
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
    },
    { userId, hasSession: true }
  );

  inFlight = run;
  inFlightUserId = userId;
  try {
    return await run;
  } finally {
    if (inFlight === run) {
      inFlight = null;
      inFlightUserId = null;
    }
  }
}

/** @deprecated Prefer fetchWallet — same single-flight path. */
export const refreshWalletOnce = fetchWallet;
