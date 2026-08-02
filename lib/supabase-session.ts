import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { withTimeout } from '@/lib/with-timeout';

const GET_SESSION_TIMEOUT_MS = 5000;
/** Short TTL so resume stampede shares one SecureStore read. */
const SESSION_CACHE_TTL_MS = 2500;
/** Longer window for timeout fallback — avoid hard-failing resume. */
const LAST_KNOWN_SESSION_TTL_MS = 5 * 60 * 1000;

type SessionResult = {
  data: { session: Session | null };
  error: Error | null;
};

let inFlight: Promise<SessionResult> | null = null;
let cached: { at: number; result: SessionResult } | null = null;
let lastKnown: { at: number; session: Session | null } | null = null;

async function loadSessionFromAuth(): Promise<SessionResult> {
  const result = await supabase.auth.getSession();
  return {
    data: { session: result.data.session ?? null },
    error: result.error ? new Error(result.error.message) : null,
  };
}

function remember(result: SessionResult): SessionResult {
  cached = { at: Date.now(), result };
  lastKnown = { at: Date.now(), session: result.data.session };
  return result;
}

function peekLastKnownSession(): Session | null {
  if (!lastKnown) return null;
  if (Date.now() - lastKnown.at >= LAST_KNOWN_SESSION_TTL_MS) return null;
  return lastKnown.session;
}

/**
 * Single-flight getSession with a brief memory cache.
 * Prevents SecureStore / auth-lock contention when many screens resume at once.
 * Timeouts resolve with last-known session (do not reject) so resume cannot crash.
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
      .then((normalized) => remember(normalized))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const fallback = peekLastKnownSession();
        return {
          data: { session: fallback },
          error: new Error(message),
        };
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    return await withTimeout(inFlight, timeoutMs, 'getSession');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = peekLastKnownSession() ?? cached?.result.data.session ?? null;
    if (__DEV__) {
      console.warn('[supabase] getSession timed out; using cached session if any');
    }
    return {
      data: { session: fallback },
      error: new Error(message),
    };
  }
}

/** Drop memory cache (e.g. after sign-out). */
export function clearSessionCache(): void {
  cached = null;
  lastKnown = null;
}

export function peekCachedSession(): Session | null {
  const fresh = cached;
  if (fresh && Date.now() - fresh.at < SESSION_CACHE_TTL_MS) {
    return fresh.result.data.session;
  }
  return peekLastKnownSession();
}
