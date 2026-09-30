import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAppForeground,
  getLastBackgroundDurationMs,
} from '@/hooks/useAppForeground';
import {
  isExternalAppFlowActive,
  shouldRefreshWalletOnResume,
  shouldRunConnectionGateOnColdStart,
} from '@/lib/wallet-refresh-policy.mjs';
import { queryClient } from '@/contexts/QueryClientProvider';
import { financialQueryKeys } from '@/lib/queries/keys';
import { noteNextWalletFetchReason } from '@/lib/queries/walletQueries';
import NetInfo from '@react-native-community/netinfo';

export type ForegroundRefreshTier = 1 | 2 | 3;

type RefetchEntry = {
  tier: ForegroundRefreshTier;
  fn: () => void | Promise<void>;
};

const FOREGROUND_REFRESH_MAX_MS = 15_000;
/** Don't stack resume wallet refreshes more often than this. */
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

type RefreshMode = 'resume' | 'skip';

function resolveRefreshMode(isColdStart: boolean): RefreshMode {
  if (isColdStart) return 'skip';
  if (isExternalAppFlowActive()) return 'skip';
  if (!shouldRefreshWalletOnResume(getLastBackgroundDurationMs())) return 'skip';

  const sinceLast = Date.now() - lastForegroundRefreshAt;
  if (lastForegroundRefreshAt > 0 && sinceLast < RESUME_REFRESH_COOLDOWN_MS) {
    return 'skip';
  }
  return 'resume';
}

async function refreshWalletOnce(userId: string | undefined, reason: string): Promise<void> {
  if (!userId) return;
  noteNextWalletFetchReason(reason);
  await queryClient.invalidateQueries({
    queryKey: financialQueryKeys.wallet(userId),
    refetchType: 'active',
  });
}

async function runForegroundRefresh(
  isColdStart: boolean,
  userId: string | undefined
): Promise<void> {
  const startedAt = Date.now();
  const mode = resolveRefreshMode(isColdStart);

  if (isColdStart && !shouldRunConnectionGateOnColdStart()) {
    if (__DEV__) {
      console.log(`[resume] cold-start skip connection gate (${Date.now() - startedAt}ms)`);
    }
    return;
  }

  if (mode === 'skip') {
    if (__DEV__) {
      const reason = isExternalAppFlowActive() ? 'external flow' : 'not a meaningful resume';
      console.log(
        `[resume] skip refresh (${reason}, away=${getLastBackgroundDurationMs()}ms)`
      );
    }
    return;
  }

  if (__DEV__) {
    console.log(`[resume] wallet refresh once (away=${getLastBackgroundDurationMs()}ms)`);
  }

  let capTimer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    capTimer = setTimeout(() => {
      if (__DEV__) {
        console.warn(
          `[resume] foreground refresh hit ${FOREGROUND_REFRESH_MAX_MS}ms cap — continuing with cache`
        );
      }
      resolve();
    }, FOREGROUND_REFRESH_MAX_MS);
  });

  try {
    await Promise.race([refreshWalletOnce(userId, 'foreground_resume'), cap]);
  } finally {
    if (capTimer) clearTimeout(capTimer);
  }

  lastForegroundRefreshAt = Date.now();

  if (__DEV__) {
    console.log(`[resume] foreground refresh complete (${Date.now() - startedAt}ms)`);
  }
}

/**
 * Mount once at app root. A meaningful return refreshes the wallet once.
 * It does not run a connection check first.
 */
export function useForegroundRefreshCoordinator(): void {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
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

    void runForegroundRefresh(isColdStart, userId).finally(() => {
      runningRef.current = false;
    });
  }, [foregroundTick, isAuthReady, userId]);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) {
        wasOfflineRef.current = true;
        return;
      }
      if (!hasResumedOnceRef.current || !wasOfflineRef.current) return;
      wasOfflineRef.current = false;
      if (isExternalAppFlowActive() || runningRef.current) return;
      runningRef.current = true;
      void refreshWalletOnce(userId, 'network_online').finally(() => {
        runningRef.current = false;
      });
    });

    return () => unsubscribe();
  }, [isAuthReady, userId]);
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
