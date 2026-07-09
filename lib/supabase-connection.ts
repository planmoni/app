import { supabase } from '@/lib/supabase';
import { reconnectSupabase, type ReconnectResult } from '@/lib/supabase-reconnect';
import { withTimeout } from '@/lib/with-timeout';

export const ENSURE_CONNECTION_MAX_MS = 6000;
export const GET_SESSION_TIMEOUT_MS = 5000;
export const PROBE_TIMEOUT_MS = 5000;
export const ENSURE_WALL_CLOCK_MAX_MS = 8000;

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

let ensureInFlight: Promise<ConnectionStatus> | null = null;

export function getSupabaseConnectionStatus(): ConnectionStatus {
  return lastStatus;
}

async function getSessionWithTimeout(): Promise<{
  session: { user?: { id?: string } } | null;
}> {
  const { data } = await withTimeout(
    supabase.auth.getSession(),
    GET_SESSION_TIMEOUT_MS,
    'getSession'
  );
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
};

/**
 * Reconnect Supabase (channels + conditional auth refresh) then optionally probe REST API.
 * Returns ok when a local session exists — refresh timeouts do not block data fetches.
 */
export async function ensureSupabaseConnection(
  options: EnsureConnectionOptions = {}
): Promise<ConnectionStatus> {
  if (ensureInFlight) {
    return ensureInFlight;
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
      lastStatus = {
        ok: lastStatus.ok,
        lastError: message,
        lastSuccessAt: lastStatus.lastSuccessAt,
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
      ok: hasSession,
      lastError: reconnect?.authError ?? undefined,
      lastSuccessAt: hasSession ? Date.now() : lastStatus.lastSuccessAt,
      reconnect,
    };

    if (__DEV__ && lastStatus.ok) {
      console.warn('[supabase] Connection ensured');
    }

    return lastStatus;
  };

  ensureInFlight = Promise.race([
    runEnsure(),
    new Promise<ConnectionStatus>((resolve) =>
      setTimeout(() => {
        if (__DEV__) {
          console.warn('[supabase] ensureSupabaseConnection wall-clock cap reached');
        }
        resolve({
          ok: lastStatus.ok,
          lastError: 'Connection ensure timed out',
          lastSuccessAt: lastStatus.lastSuccessAt,
          reconnect: null,
        });
      }, ENSURE_WALL_CLOCK_MAX_MS)
    ),
  ]).finally(() => {
    ensureInFlight = null;
  });

  return ensureInFlight;
}

/** @deprecated Use ensureSupabaseConnection */
export async function warmConnection(): Promise<ConnectionStatus> {
  return ensureSupabaseConnection({ skipProbe: true });
}
