import { supabase } from '@/lib/supabase';
import { reconnectSupabase, type ReconnectResult } from '@/lib/supabase-reconnect';
import { getSessionSerialized, peekCachedSession } from '@/lib/supabase-session';
import { withTimeout } from '@/lib/with-timeout';
import { timedOperation } from '@/lib/supabase-timing';

export const ENSURE_CONNECTION_MAX_MS = 6000;
export const GET_SESSION_TIMEOUT_MS = 5000;
export const PROBE_TIMEOUT_MS = 5000;
/** Return to callers after this so UI is not blocked forever. */
export const ENSURE_WALL_CLOCK_MAX_MS = 8000;
/** Skip a full ensure if one just succeeded (resume stampede). */
const ENSURE_SUCCESS_COOLDOWN_MS = 20_000;
/** After a timed-out ensure, avoid immediately stacking another full reconnect. */
const ENSURE_FAILURE_COOLDOWN_MS = 8_000;

export type ConnectionStatus = {
  ok: boolean;
  lastError?: string;
  lastSuccessAt: number | null;
  /** When the last ensure attempt finished (success or failure). */
  lastAttemptAt: number | null;
  reconnect: ReconnectResult | null;
  /** True when we returned early due to wall-clock while work may still run. */
  timedOut?: boolean;
};

let lastStatus: ConnectionStatus = {
  ok: true,
  lastSuccessAt: null,
  lastAttemptAt: null,
  reconnect: null,
};

/** Full ensure work — cleared only when runEnsure settles (not on wall-clock). */
let ensureInFlight: Promise<ConnectionStatus> | null = null;

export function getSupabaseConnectionStatus(): ConnectionStatus {
  return lastStatus;
}

/** Test / recovery helper — clears cooldown so the next ensure runs fully. */
export function resetSupabaseConnectionEnsureState(): void {
  lastStatus = {
    ok: true,
    lastSuccessAt: null,
    lastAttemptAt: null,
    reconnect: null,
  };
}

async function getSessionWithTimeout(): Promise<{
  session: { user?: { id?: string }; expires_at?: number } | null;
}> {
  return timedOperation('auth.getSession', async () => {
    const { data } = await getSessionSerialized({
      timeoutMs: GET_SESSION_TIMEOUT_MS,
    });
    return { session: data.session };
  });
}

async function runHealthProbe(): Promise<void> {
  const { session } = await getSessionWithTimeout();
  if (!session?.user?.id) {
    return;
  }

  await timedOperation(
    'db.probe.getUser',
    () => withTimeout(supabase.auth.getUser(), PROBE_TIMEOUT_MS, 'Connection probe'),
    { userId: session.user.id, hasSession: true, sessionExpiresAt: session.expires_at ?? null }
  );
}

export type EnsureConnectionOptions = {
  skipProbe?: boolean;
  /** Skip channel teardown + auth refresh (e.g. before a single retry). */
  lightweight?: boolean;
  /** Ignore recent success cooldown. */
  force?: boolean;
};

/**
 * Reconnect Supabase (channels + conditional auth refresh) then optionally probe.
 * Dedupes concurrent callers and short-circuits shortly after a successful ensure.
 *
 * Wall-clock: returns { ok: false, timedOut: true } so callers do NOT treat a
 * hung ensure as "connection ready" and stampede more requests.
 */
export async function ensureSupabaseConnection(
  options: EnsureConnectionOptions = {}
): Promise<ConnectionStatus> {
  const now = Date.now();
  if (
    !options.force &&
    lastStatus.ok &&
    lastStatus.lastSuccessAt != null &&
    now - lastStatus.lastSuccessAt < ENSURE_SUCCESS_COOLDOWN_MS
  ) {
    return lastStatus;
  }

  if (
    !options.force &&
    !lastStatus.ok &&
    lastStatus.timedOut &&
    lastStatus.lastAttemptAt != null &&
    now - lastStatus.lastAttemptAt < ENSURE_FAILURE_COOLDOWN_MS
  ) {
    return lastStatus;
  }

  if (ensureInFlight) {
    // Soft-wait: don't block forever, but do not report ok:true on timeout.
    return Promise.race([
      ensureInFlight,
      new Promise<ConnectionStatus>((resolve) =>
        setTimeout(() => {
          resolve({
            ok: false,
            lastError: 'Connection ensure still in progress',
            lastSuccessAt: lastStatus.lastSuccessAt,
            lastAttemptAt: Date.now(),
            reconnect: lastStatus.reconnect,
            timedOut: true,
          });
        }, ENSURE_WALL_CLOCK_MAX_MS)
      ),
    ]);
  }

  const runEnsure = async (): Promise<ConnectionStatus> => {
    let reconnect: ReconnectResult | null = null;

    if (!options.lightweight) {
      reconnect = await Promise.race([
        reconnectSupabase(),
        new Promise<ReconnectResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                channelsCleared: false,
                sessionRefreshed: false,
                authError: 'Reconnect timed out',
                isAuthExpired: false,
              }),
            ENSURE_CONNECTION_MAX_MS
          )
        ),
      ]);
    }

    if (reconnect?.isAuthExpired) {
      lastStatus = {
        ok: false,
        lastError: reconnect.authError ?? 'Session expired',
        lastSuccessAt: lastStatus.lastSuccessAt,
        lastAttemptAt: Date.now(),
        reconnect,
        timedOut: false,
      };
      return lastStatus;
    }

    let session: { user?: { id?: string }; expires_at?: number } | null = null;
    try {
      ({ session } = await getSessionWithTimeout());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (__DEV__) {
        console.warn('[supabase] getSession timed out during ensure:', message);
      }
      // Cached session may exist, but we did not freshly confirm readiness.
      lastStatus = {
        ok: false,
        lastError: message,
        lastSuccessAt: lastStatus.lastSuccessAt,
        lastAttemptAt: Date.now(),
        reconnect,
        timedOut: true,
      };
      return lastStatus;
    }

    const hasSession = !!session?.user?.id;

    if (!options.skipProbe && hasSession) {
      try {
        await runHealthProbe();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (__DEV__) {
          console.warn('[supabase] Health probe failed (non-fatal):', message);
        }
      }
    }

    lastStatus = {
      ok: hasSession,
      lastError: reconnect?.authError ?? undefined,
      lastSuccessAt: hasSession ? Date.now() : lastStatus.lastSuccessAt,
      lastAttemptAt: Date.now(),
      reconnect,
      timedOut: false,
    };

    if (__DEV__ && lastStatus.ok) {
      console.warn('[supabase] Connection ensured');
    }

    return lastStatus;
  };

  const work = runEnsure().finally(() => {
    ensureInFlight = null;
  });
  ensureInFlight = work;

  return Promise.race([
    work,
    new Promise<ConnectionStatus>((resolve) =>
      setTimeout(() => {
        // Do NOT mark ok:true — callers must not stampede while ensure is hung.
        lastStatus = {
          ok: false,
          lastError: 'Connection ensure timed out',
          lastSuccessAt: lastStatus.lastSuccessAt,
          lastAttemptAt: Date.now(),
          reconnect: lastStatus.reconnect,
          timedOut: true,
        };
        if (__DEV__) {
          console.warn(
            '[supabase] ensureSupabaseConnection wall-clock cap reached (ok=false; work may still finish)'
          );
        }
        resolve(lastStatus);
      }, ENSURE_WALL_CLOCK_MAX_MS)
    ),
  ]);
}

/** @deprecated Use ensureSupabaseConnection({ skipProbe: true, lightweight: true }) */
export async function warmConnection(): Promise<ConnectionStatus> {
  return ensureSupabaseConnection({ skipProbe: true, lightweight: true });
}
