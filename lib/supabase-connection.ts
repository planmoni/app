import { supabase } from '@/lib/supabase';
import { reconnectSupabase, type ReconnectResult } from '@/lib/supabase-reconnect';
import { withTimeout } from '@/lib/with-timeout';

export const ENSURE_CONNECTION_MAX_MS = 6000;
export const PROBE_TIMEOUT_MS = 5000;

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

async function runHealthProbe(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
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

  ensureInFlight = (async () => {
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

    const { data: { session } } = await supabase.auth.getSession();
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
  })().finally(() => {
    ensureInFlight = null;
  });

  return ensureInFlight;
}

/** @deprecated Use ensureSupabaseConnection */
export async function warmConnection(): Promise<ConnectionStatus> {
  return ensureSupabaseConnection({ skipProbe: true });
}
