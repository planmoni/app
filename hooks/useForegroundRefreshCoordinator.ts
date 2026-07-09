import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppForeground } from '@/hooks/useAppForeground';
import { ensureSupabaseConnection } from '@/lib/supabase-connection';
import { queryClient } from '@/contexts/QueryClientProvider';
import { isFinancialQueryKey } from '@/lib/queries/keys';
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

async function invalidateFinancialQueries(): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) => isFinancialQueryKey(query.queryKey),
  });
}

async function runStaggeredLegacyRefresh(): Promise<void> {
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

async function runForegroundRefresh(): Promise<void> {
  const startedAt = Date.now();

  if (__DEV__) {
    console.log('[resume] foreground → reconnect start');
  }

  const status = await ensureSupabaseConnection({ skipProbe: true });
  const reconnectMs = Date.now() - startedAt;

  if (!status.ok && status.reconnect?.isAuthExpired) {
    if (__DEV__) {
      console.warn(`[resume] reconnect(${reconnectMs}ms) → auth expired, skip refresh`);
    }
    return;
  }

  if (__DEV__) {
    console.log(`[resume] reconnect(${reconnectMs}ms) → invalidate financial queries`);
  }

  const invalidateStarted = Date.now();
  await invalidateFinancialQueries();

  if (__DEV__) {
    console.log(`[resume] invalidate(${Date.now() - invalidateStarted}ms) → legacy registry`);
  }

  await runStaggeredLegacyRefresh();

  if (__DEV__) {
    console.log(`[resume] foreground refresh complete (${Date.now() - startedAt}ms)`);
  }
}

/**
 * Mount once at app root. On foreground resume, ensure connection health
 * then invalidate shared financial queries and run legacy refetches.
 */
export function useForegroundRefreshCoordinator(): void {
  const { isAuthReady } = useAuth();
  const foregroundTick = useAppForeground();
  const runningRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const hasResumedOnceRef = useRef(false);
  const bootRefreshDoneRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady) return;

    const isColdStart = !bootRefreshDoneRef.current;
    const isResume = foregroundTick > 0;

    if (!isColdStart && !isResume) return;

    bootRefreshDoneRef.current = true;
    if (isResume) {
      hasResumedOnceRef.current = true;
    }

    if (runningRef.current) return;
    runningRef.current = true;

    void runForegroundRefresh().finally(() => {
      runningRef.current = false;
    });
  }, [foregroundTick, isAuthReady]);

  // Reconnect when network returns — only after auth is ready and at least one resume.
  useEffect(() => {
    if (!isAuthReady) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) {
        wasOfflineRef.current = true;
        return;
      }
      if (!hasResumedOnceRef.current) {
        return;
      }
      if (wasOfflineRef.current && online) {
        wasOfflineRef.current = false;
        if (runningRef.current) return;
        runningRef.current = true;
        void runForegroundRefresh().finally(() => {
          runningRef.current = false;
        });
      }
    });

    return () => unsubscribe();
  }, [isAuthReady]);
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
