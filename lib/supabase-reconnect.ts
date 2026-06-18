import { supabase } from '@/lib/supabase';
import { abortAllSupabaseFetches } from '@/lib/supabase-http';
import type { Session } from '@supabase/supabase-js';

const AUTH_EXPIRED_PATTERNS = [
  'refresh_token_not_found',
  'Invalid Refresh Token',
  'JWT expired',
  'Session expired',
  'session_not_found',
];

export type ReconnectResult = {
  channelsCleared: boolean;
  sessionRefreshed: boolean;
  authError: string | null;
  isAuthExpired: boolean;
};

let lastReconnectResult: ReconnectResult | null = null;
let authExpiredHandler: (() => void) | null = null;
let sessionRefreshedHandler: ((session: Session) => void) | null = null;

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

/**
 * Perform an internal "hard restart" of the Supabase connection.
 */
export async function reconnectSupabase(): Promise<ReconnectResult> {
  const result: ReconnectResult = {
    channelsCleared: false,
    sessionRefreshed: false,
    authError: null,
    isAuthExpired: false,
  };

  // Abort zombie HTTP requests before tearing down channels.
  abortAllSupabaseFetches();

  try {
    await supabase.removeAllChannels();
    result.channelsCleared = true;
    if (__DEV__) {
      console.warn('[supabase] Realtime channels cleared');
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[supabase] removeAllChannels failed:', err);
    }
  }

  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      result.authError = error.message;
      result.isAuthExpired = isAuthExpiredError(error.message);
      if (__DEV__) {
        console.warn('[supabase] refreshSession failed:', error.message);
      }
      if (result.isAuthExpired) {
        authExpiredHandler?.();
      }
    } else if (data.session) {
      result.sessionRefreshed = true;
      sessionRefreshedHandler?.(data.session);
      if (__DEV__) {
        console.warn('[supabase] Session refreshed successfully');
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.authError = message;
    result.isAuthExpired = isAuthExpiredError(message);
    if (__DEV__) {
      console.warn('[supabase] refreshSession error:', message);
    }
    if (result.isAuthExpired) {
      authExpiredHandler?.();
    }
  }

  lastReconnectResult = result;
  return result;
}
