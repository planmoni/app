import { useEffect, useRef, useCallback } from 'react';
import { useAppForeground } from '@/hooks/useAppForeground';
import { ensureSupabaseConnection } from '@/lib/supabase-connection';
import NetInfo from '@react-native-community/netinfo';

export type ForegroundRefreshTier = 1 | 2 | 3;

type RefetchEntry = {
  tier: ForegroundRefreshTier;
  fn: () => void | Promise<void>;
};

const TIER_DELAYS_MS: Record<ForegroundRefreshTier, number> = {
  1: 0,
  2: 750,
  3: 1500,
};

const registry = new Map<string, RefetchEntry>();

export function registerForegroundRefetch(
  id: string,
  tier: ForegroundRefreshTier,
  fn: () => void | Promise<void>
): () => void {
  registry.set(id, { tier, fn });
  return () => {
    registry.delete(id);
  };
}

export function getForegroundRefetchRegistrySize(): number {
  return registry.size;
}

async function runStaggeredRefresh(): Promise<void> {
  const status = await ensureSupabaseConnection();
  if (!status.ok) {
    if (__DEV__) {
      console.warn(
        '[foreground] Skipping refetch — connection unhealthy:',
        status.lastError
      );
    }
    return;
  }

  const tiers: ForegroundRefreshTier[] = [1, 2, 3];
  for (const tier of tiers) {
    const entries = [...registry.entries()].filter(([, e]) => e.tier === tier);
    if (entries.length === 0) continue;

    if (TIER_DELAYS_MS[tier] > 0) {
      await new Promise((r) => setTimeout(r, TIER_DELAYS_MS[tier]));
    }

    await Promise.allSettled(entries.map(([, e]) => Promise.resolve(e.fn())));
  }
}

/**
 * Mount once at app root. On foreground resume, ensure connection health
 * then run registered refetches in staggered tiers.
 */
export function useForegroundRefreshCoordinator(): void {
  const foregroundTick = useAppForeground();
  const runningRef = useRef(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (foregroundTick === 0) return;

    if (runningRef.current) return;
    runningRef.current = true;

    void runStaggeredRefresh().finally(() => {
      runningRef.current = false;
    });
  }, [foregroundTick]);

  // Reconnect when network returns after being offline.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) {
        wasOfflineRef.current = true;
        return;
      }
      if (wasOfflineRef.current && online) {
        wasOfflineRef.current = false;
        if (runningRef.current) return;
        runningRef.current = true;
        void runStaggeredRefresh().finally(() => {
          runningRef.current = false;
        });
      }
    });

    return () => unsubscribe();
  }, []);
}

/**
 * Register a refetch callback for coordinated foreground refresh.
 */
export function useRegisterForegroundRefetch(
  id: string,
  tier: ForegroundRefreshTier,
  fn: () => void | Promise<void>,
  enabled = true
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const stableFn = useCallback(() => fnRef.current(), []);

  useEffect(() => {
    if (!enabled) return;
    return registerForegroundRefetch(id, tier, stableFn);
  }, [id, tier, stableFn, enabled]);
}
