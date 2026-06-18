import { supabase } from '@/lib/supabase';
import { reconnectSupabase, type ReconnectResult } from '@/lib/supabase-reconnect';
import { withTimeout } from '@/lib/with-timeout';

export const ENSURE_CONNECTION_MAX_MS = 4000;
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
};

/**
 * Fully reconnect Supabase (channels + auth) then optionally probe REST API.
 * Unlike the old warmConnection 1.5s race, this awaits recovery before refetch.
 */
export async function ensureSupabaseConnection(
  options: EnsureConnectionOptions = {}
): Promise<ConnectionStatus> {
  if (ensureInFlight) {
    return ensureInFlight;
  }

  ensureInFlight = (async () => {
    const reconnect = await Promise.race([
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

    if (reconnect.isAuthExpired) {
      lastStatus = {
        ok: false,
        lastError: reconnect.authError ?? 'Session expired',
        lastSuccessAt: lastStatus.lastSuccessAt,
        reconnect,
      };
      return lastStatus;
    }

    if (!options.skipProbe) {
      try {
        await runHealthProbe();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        lastStatus = {
          ok: false,
          lastError: message,
          lastSuccessAt: lastStatus.lastSuccessAt,
          reconnect,
        };
        if (__DEV__) {
          console.warn('[supabase] Health probe failed:', message);
        }
        return lastStatus;
      }
    }

    lastStatus = {
      ok: true,
      lastSuccessAt: Date.now(),
      reconnect,
    };
    if (__DEV__) {
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
  return ensureSupabaseConnection();
}
