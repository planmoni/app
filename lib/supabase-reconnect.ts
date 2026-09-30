import { supabase } from '@/lib/supabase';
import { getSessionSerialized } from '@/lib/supabase-session';
import type { Session } from '@supabase/supabase-js';

const AUTH_EXPIRED_PATTERNS = [
  'refresh_token_not_found',
  'Invalid Refresh Token',
  'JWT expired',
  'Session expired',
  'session_not_found',
];

/** Only refresh when the stored access token is near expiry. */
const REFRESH_IF_EXPIRES_WITHIN_SEC = 60;
const REFRESH_SESSION_TIMEOUT_MS = 8000;

export type ReconnectResult = {
  channelsCleared: boolean;
  sessionRefreshed: boolean;
  authError: string | null;
  isAuthExpired: boolean;
};

let lastReconnectResult: ReconnectResult | null = null;
let authExpiredHandler: (() => void) | null = null;
let sessionRefreshedHandler: ((session: Session) => void) | null = null;
let refreshInFlight: Promise<{
  session: Session | null;
  error: string | null;
  timedOut: boolean;
}> | null = null;

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  authExpiredHandler = handler;
}

export function setSessionRefreshedHandler(
  handler: ((session: Session) => void) | null
): void {
  sessionRefreshedHandler = handler;
}

export function getLastReconnectResult(): ReconnectResult | null {
  return lastReconnectResult;
}

function isAuthExpiredError(message: string): boolean {
  const lower = message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some(
    (pattern) => lower.includes(pattern.toLowerCase())
  );
}

async function refreshSessionWithTimeout(): Promise<{
  session: Session | null;
  error: string | null;
  timedOut: boolean;
}> {
  try {
    const result = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('refreshSession timed out')), REFRESH_SESSION_TIMEOUT_MS)
      ),
    ]);

    if (result.error) {
      return { session: null, error: result.error.message, timedOut: false };
    }
    return { session: result.data.session ?? null, error: null, timedOut: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      session: null,
      error: message,
      timedOut: message.includes('timed out'),
    };
  }
}

/**
 * Refresh only when the stored access token is near expiry.
 * Skips network refresh when the token is still valid — avoids blocking data fetches.
 */
async function refreshSessionIfNeeded(): Promise<{
  session: Session | null;
  error: string | null;
  timedOut: boolean;
  skipped: boolean;
}> {
  const { data: { session } } = await getSessionSerialized();
  if (!session?.access_token) {
    return { session: null, error: null, timedOut: false, skipped: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  const secondsLeft = expiresAt - now;

  if (secondsLeft > REFRESH_IF_EXPIRES_WITHIN_SEC) {
    return { session, error: null, timedOut: false, skipped: true };
  }

  if (refreshInFlight) {
    const inFlight = await Promise.race([
      refreshInFlight,
      new Promise<{ session: Session | null; error: string | null; timedOut: boolean }>((resolve) =>
        setTimeout(
          () => resolve({ session, error: 'refreshSession timed out', timedOut: true }),
          REFRESH_SESSION_TIMEOUT_MS
        )
      ),
    ]);
    if (inFlight.session) return { ...inFlight, skipped: false };
    if (secondsLeft > 0) {
      return { session, error: inFlight.error, timedOut: inFlight.timedOut, skipped: false };
    }
    return { ...inFlight, skipped: false };
  }

  refreshInFlight = refreshSessionWithTimeout().finally(() => {
    refreshInFlight = null;
  });

  const refresh = await refreshInFlight;
  if ((refresh.error || refresh.timedOut) && secondsLeft > 0 && session) {
    return { session, error: refresh.error, timedOut: refresh.timedOut, skipped: false };
  }
  return { ...refresh, skipped: false };
}

/**
 * Lightweight path for background task — refresh only if near expiry.
 * Avoids clearing realtime channels (not meaningful when suspended).
 */
export async function refreshSessionIfNeededForBackground(): Promise<{
  refreshed: boolean;
  skipped: boolean;
  error: string | null;
}> {
  const refresh = await refreshSessionIfNeeded();
  if (refresh.error && !refresh.timedOut && isAuthExpiredError(refresh.error)) {
    authExpiredHandler?.();
  } else if (refresh.session && !refresh.skipped) {
    sessionRefreshedHandler?.(refresh.session);
  }
  return {
    refreshed: !!refresh.session && !refresh.skipped,
    skipped: refresh.skipped,
    error: refresh.error,
  };
}

/**
 * Lightweight reconnect: clear stale realtime channels, refresh auth only when needed.
 */
export async function reconnectSupabase(): Promise<ReconnectResult> {
  const result: ReconnectResult = {
    channelsCleared: false,
    sessionRefreshed: false,
    authError: null,
    isAuthExpired: false,
  };

  const refresh = await refreshSessionIfNeeded();
  if (refresh.skipped && __DEV__) {
    console.warn('[supabase] Session still valid, skipped refresh');
  }

  if (refresh.error) {
    result.authError = refresh.error;
    result.isAuthExpired = !refresh.timedOut && isAuthExpiredError(refresh.error);
    if (__DEV__) {
      console.warn('[supabase] refreshSession failed:', refresh.error);
    }
    if (result.isAuthExpired) {
      authExpiredHandler?.();
    }
  } else if (refresh.session && !refresh.skipped) {
    result.sessionRefreshed = true;
    sessionRefreshedHandler?.(refresh.session);
    if (__DEV__) {
      console.warn('[supabase] Session refreshed successfully');
    }
  }

  lastReconnectResult = result;
  return result;
}
