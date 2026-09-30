import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAppForeground,
  getLastBackgroundDurationMs,
} from '@/hooks/useAppForeground';
import { shouldRunConnectionGateOnColdStart } from '@/lib/wallet-refresh-policy.mjs';
import { ensureSupabaseConnection } from '@/lib/supabase-connection';
import { queryClient } from '@/contexts/QueryClientProvider';
import { isFinancialQueryKey } from '@/lib/queries/keys';
import NetInfo from '@react-native-community/netinfo';

export type ForegroundRefreshTier = 1 | 2 | 3;

type RefetchEntry = {
  tier: ForegroundRefreshTier;
  fn: () => void | Promise<void>;
};

/** Wider stagger reduces auth/storage lock contention on weak networks. */
const TIER_DELAYS_MS: Record<ForegroundRefreshTier, number> = {
  1: 0,
  2: 1200,
  3: 2400,
};

const TIER_CONCURRENCY = 1;
/** Hard cap so a jammed resume cannot block the coordinator forever. */
const FOREGROUND_REFRESH_MAX_MS = 15_000;
/** Ignore Control Center / notification shade blips. */
const MIN_BACKGROUND_MS_FOR_FULL_REFRESH = 2_500;
/** Don't stack full resume refreshes more often than this. */
const RESUME_REFRESH_COOLDOWN_MS = 20_000;

const registry = new Map<string, RefetchEntry>();

let lastForegroundRefreshAt = 0;

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
  // Don't cancel in-flight fetches (create payout / wallet).
  await queryClient.invalidateQueries({
    predicate: (query) => isFinancialQueryKey(query.queryKey),
    cancelRefetch: false,
  });
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let next = 0;

  async function runOne(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.allSettled(runners);
}

async function runStaggeredLegacyRefresh(): Promise<void> {
  const tiers: ForegroundRefreshTier[] = [1, 2, 3];
  for (const tier of tiers) {
    const entries = [...registry.entries()].filter(([, e]) => e.tier === tier);
    if (entries.length === 0) continue;

    if (TIER_DELAYS_MS[tier] > 0) {
      await new Promise((r) => setTimeout(r, TIER_DELAYS_MS[tier]));
    }

    await mapPool(entries, TIER_CONCURRENCY, async ([, e]) => {
      await Promise.resolve(e.fn());
    });
  }
}

type RefreshMode = 'full' | 'light' | 'skip';

function resolveRefreshMode(isColdStart: boolean): RefreshMode {
  if (isColdStart) return 'light';

  const awayMs = getLastBackgroundDurationMs();
  if (awayMs > 0 && awayMs < MIN_BACKGROUND_MS_FOR_FULL_REFRESH) {
    return 'skip';
  }

  const sinceLast = Date.now() - lastForegroundRefreshAt;
  if (lastForegroundRefreshAt > 0 && sinceLast < RESUME_REFRESH_COOLDOWN_MS) {
    return 'skip';
  }

  // Long absence → full reconnect + invalidate + legacy. Short → invalidate only.
  if (awayMs >= 30_000) return 'full';
  return 'light';
}

async function runForegroundRefresh(isColdStart: boolean): Promise<void> {
  const startedAt = Date.now();
  const mode = resolveRefreshMode(isColdStart);

  if (mode === 'skip') {
    if (__DEV__) {
      console.log(
        `[resume] skip refresh (away=${getLastBackgroundDurationMs()}ms, sinceLast=${Date.now() - lastForegroundRefreshAt}ms)`
      );
    }
    return;
  }

  if (__DEV__) {
    console.log(`[resume] foreground → ${mode} refresh start (cold=${isColdStart})`);
  }

  const refreshWork = (async () => {
    // Cold start: only lightweight session warm — do NOT invalidate all financial
    // queries (mount/refetchOnMount already loads; invalidating causes a stampede).
    if (isColdStart && !shouldRunConnectionGateOnColdStart()) {
      if (__DEV__) {
        console.log(
          `[resume] cold-start skip connection gate (${Date.now() - startedAt}ms)`
        );
      }
      return;
    }

    if (mode === 'full') {
      const status = await ensureSupabaseConnection({ skipProbe: true, lightweight: true });
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
    } else {
      // Light resume: session cache / cooldown handle auth; just refresh money queries.
      await ensureSupabaseConnection({
        skipProbe: true,
        lightweight: true,
      });
    }

    const invalidateStarted = Date.now();
    await invalidateFinancialQueries();

    if (__DEV__) {
      console.log(`[resume] invalidate(${Date.now() - invalidateStarted}ms)`);
    }

    if (mode === 'full') {
      if (__DEV__) {
        console.log('[resume] → legacy registry');
      }
      await runStaggeredLegacyRefresh();
    }
  })();

  await Promise.race([
    refreshWork,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        if (__DEV__) {
          console.warn(
            `[resume] foreground refresh hit ${FOREGROUND_REFRESH_MAX_MS}ms cap — continuing with cache`
          );
        }
        resolve();
      }, FOREGROUND_REFRESH_MAX_MS)
    ),
  ]);

  lastForegroundRefreshAt = Date.now();

  if (__DEV__) {
    console.log(`[resume] foreground refresh complete (${Date.now() - startedAt}ms, mode=${mode})`);
  }
}

/**
 * Mount once at app root. On foreground resume, ensure connection health
 * then invalidate shared financial queries (and legacy refetches only after long absence).
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

    void runForegroundRefresh(isColdStart).finally(() => {
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
        // Treat reconnect-from-offline as a full refresh.
        lastForegroundRefreshAt = 0;
        void runForegroundRefresh(false).finally(() => {
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
