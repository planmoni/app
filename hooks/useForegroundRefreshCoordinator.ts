import { useEffect, useRef, useCallback } from 'react';
import { useAppForeground } from '@/hooks/useAppForeground';
import { warmConnection } from '@/lib/supabase-fetch';

export type ForegroundRefreshTier = 1 | 2 | 3;

type RefetchEntry = {
  tier: ForegroundRefreshTier;
  fn: () => void | Promise<void>;
};

const TIER_DELAYS_MS: Record<ForegroundRefreshTier, number> = {
  1: 0,
  2: 500,
  3: 1000,
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

async function runStaggeredRefresh(): Promise<void> {
  await warmConnection();

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
 * Mount once at app root. On foreground resume, warm the Supabase connection
 * then run registered refetches in staggered tiers to avoid a thundering herd.
 */
export function useForegroundRefreshCoordinator(): void {
  const foregroundTick = useAppForeground();
  const runningRef = useRef(false);

  useEffect(() => {
    if (foregroundTick === 0) return;

    if (runningRef.current) return;
    runningRef.current = true;

    void runStaggeredRefresh().finally(() => {
      runningRef.current = false;
    });
  }, [foregroundTick]);
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
