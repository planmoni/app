import { supabase } from '@/lib/supabase';
import { reconnectSupabase, type ReconnectResult } from '@/lib/supabase-reconnect';
import { getSessionSerialized, peekCachedSession } from '@/lib/supabase-session';
import { withTimeout } from '@/lib/with-timeout';

export const ENSURE_CONNECTION_MAX_MS = 6000;
export const GET_SESSION_TIMEOUT_MS = 5000;
export const PROBE_TIMEOUT_MS = 5000;
/** Soft return to callers after this; underlying work may still finish. */
export const ENSURE_WALL_CLOCK_MAX_MS = 8000;
/** Skip a full ensure if one just succeeded (resume stampede). */
const ENSURE_SUCCESS_COOLDOWN_MS = 20_000;

export type ConnectionStatus = {
  ok: boolean;
  lastError?: string;
  lastSuccessAt: number | null;
  reconnect: ReconnectResult | null;
};

let lastStatus: ConnectionStatus = {
  ok: true,
  lastSuccessAt: null,
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
    reconnect: null,
  };
}

async function getSessionWithTimeout(): Promise<{
  session: { user?: { id?: string } } | null;
}> {
  const { data } = await getSessionSerialized({
    timeoutMs: GET_SESSION_TIMEOUT_MS,
  });
  return { session: data.session };
}

async function runHealthProbe(): Promise<void> {
  const { session } = await getSessionWithTimeout();
  if (!session?.user?.id) {
    return;
  }

  await withTimeout(supabase.auth.getUser(), PROBE_TIMEOUT_MS, 'Connection probe');
}

export type EnsureConnectionOptions = {
  skipProbe?: boolean;
  /** Skip channel teardown + auth refresh (e.g. before a single retry). */
  lightweight?: boolean;
  /** Ignore recent success cooldown. */
  force?: boolean;
};

/**
 * Reconnect Supabase (channels + conditional auth refresh) then optionally probe REST API.
 * Dedupes concurrent callers and short-circuits shortly after a successful ensure.
 *
 * Wall-clock: callers get a soft status after ENSURE_WALL_CLOCK_MAX_MS so UI is not
 * blocked, but ensureInFlight stays until the real work finishes — preventing a
 * stampede of overlapping reconnects.
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

  if (ensureInFlight) {
    // Soft-wait: don't block callers on a stuck ensure for more than the wall clock.
    return Promise.race([
      ensureInFlight,
      new Promise<ConnectionStatus>((resolve) =>
        setTimeout(() => resolve(lastStatus), ENSURE_WALL_CLOCK_MAX_MS)
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
        reconnect,
      };
      return lastStatus;
    }

    let session: { user?: { id?: string } } | null = null;
    try {
      ({ session } = await getSessionWithTimeout());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (__DEV__) {
        console.warn('[supabase] getSession timed out during ensure:', message);
      }
      const cached = peekCachedSession();
      lastStatus = {
        ok: !!cached?.user?.id || lastStatus.ok,
        lastError: message,
        // Start cooldown even on soft failure so we do not stampede.
        lastSuccessAt: Date.now(),
        reconnect,
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
      ok: hasSession || lastStatus.ok,
      lastError: reconnect?.authError ?? undefined,
      lastSuccessAt: Date.now(),
      reconnect,
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
        const cached = peekCachedSession();
        const softOk = !!cached?.user?.id || lastStatus.ok;
        // Arm cooldown so the next ensure caller short-circuits instead of stacking.
        lastStatus = {
          ok: softOk,
          lastError: 'Connection ensure timed out',
          lastSuccessAt: Date.now(),
          reconnect: lastStatus.reconnect,
        };
        if (__DEV__) {
          console.warn(
            '[supabase] ensureSupabaseConnection wall-clock cap reached (soft return; work may still finish)'
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
