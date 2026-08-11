import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { withTimeout } from '@/lib/with-timeout';

const GET_SESSION_TIMEOUT_MS = 5000;
/** Memory cache so resume / ensure stampedes share one storage read. */
const SESSION_CACHE_TTL_MS = 30_000;

type SessionResult = {
  data: { session: Session | null };
  error: Error | null;
};

let inFlight: Promise<SessionResult> | null = null;
let cached: { at: number; result: SessionResult } | null = null;

async function loadSessionFromAuth(): Promise<SessionResult> {
  const result = await supabase.auth.getSession();
  return {
    data: { session: result.data.session ?? null },
    error: result.error ? new Error(result.error.message) : null,
  };
}

/**
 * Single-flight getSession with a brief memory cache.
 * Prevents SecureStore / auth-lock contention when many screens resume at once.
 * Timeouts reject the waiter but do not start a second storage read until the
 * in-flight auth call actually settles.
 */
export async function getSessionSerialized(
  options: { bypassCache?: boolean; timeoutMs?: number } = {}
): Promise<SessionResult> {
  const timeoutMs = options.timeoutMs ?? GET_SESSION_TIMEOUT_MS;
  const now = Date.now();

  if (
    !options.bypassCache &&
    cached &&
    now - cached.at < SESSION_CACHE_TTL_MS
  ) {
    return cached.result;
  }

  if (!inFlight) {
    inFlight = loadSessionFromAuth()
      .then((normalized) => {
        cached = { at: Date.now(), result: normalized };
        return normalized;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    return await withTimeout(inFlight, timeoutMs, 'getSession');
  } catch (err) {
    // Prefer last known session over rejecting — avoids stampede failures when
    // SecureStore/keychain is slow or broken (Expo Go entitlement issues).
    if (cached?.result) {
      return cached.result;
    }
    throw err;
  }
}

/** Drop memory cache (e.g. after sign-out). */
export function clearSessionCache(): void {
  cached = null;
}

export function peekCachedSession(): Session | null {
  if (!cached) return null;
  // Allow slightly stale peeks for connection ensure during storage contention.
  if (Date.now() - cached.at >= SESSION_CACHE_TTL_MS * 2) return null;
  return cached.result.data.session;
}
