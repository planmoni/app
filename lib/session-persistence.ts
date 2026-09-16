import { Session } from '@supabase/supabase-js';
import { saveItem, getItem, deleteItem, AUTH_SESSION_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_ACCESS_TOKEN_KEY } from './secure-storage';

/**
 * Save session to secure storage.
 * Persists a single session blob (includes access + refresh tokens).
 * Best-effort cleanup removes legacy split token keys.
 */
export async function saveSession(session: Session | null): Promise<void> {
  try {
    if (!session) {
      await Promise.all([
        deleteItem(AUTH_SESSION_KEY),
        deleteItem(AUTH_REFRESH_TOKEN_KEY),
        deleteItem(AUTH_ACCESS_TOKEN_KEY),
      ]);
      return;
    }

    await saveItem(AUTH_SESSION_KEY, JSON.stringify(session));
    // Clean up legacy duplicated token keys without blocking on them.
    void Promise.all([
      deleteItem(AUTH_REFRESH_TOKEN_KEY),
      deleteItem(AUTH_ACCESS_TOKEN_KEY),
    ]).catch(() => undefined);
  } catch (error) {
    console.error('Error saving session to secure storage:', error);
    throw error;
  }
}

/**
 * Load session from secure storage
 */
export async function loadSession(): Promise<Session | null> {
  try {
    const sessionData = await getItem(AUTH_SESSION_KEY);
    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData) as Session;
  } catch (error) {
    console.error('Error loading session from secure storage:', error);
    return null;
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: Session | null): boolean {
  if (!session) return true;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;

  return now >= expiresAt;
}

/**
 * Clear all session data
 */
export async function clearSession(): Promise<void> {
  try {
    await Promise.all([
      deleteItem(AUTH_SESSION_KEY),
      deleteItem(AUTH_REFRESH_TOKEN_KEY),
      deleteItem(AUTH_ACCESS_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing session data:', error);
    throw error;
  }
}

/**
 * Restore session in Supabase auth state
 */
export async function restoreSessionInSupabase(session: Session): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');

    if (!session.access_token || !session.refresh_token) {
      return false;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (error) {
      console.error('Error restoring session in Supabase:', error);
      return false;
    }

    // Prefer the session returned by the client (may include refreshed tokens)
    return !!(data.session?.access_token || session.access_token);
  } catch (error) {
    console.error('Error restoring session in Supabase:', error);
    return false;
  }
}

/**
 * Attempt to refresh an expired session
 */
export async function refreshExpiredSession(session: Session): Promise<Session | null> {
  try {
    const { supabase } = await import('./supabase');

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });

    if (error) {
      console.error('Error refreshing session:', error);
      return null;
    }

    if (data.session) {
      await saveSession(data.session);
      return data.session;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return null;
  }
}

/**
 * Check if session can be refreshed (has valid refresh token)
 */
export function canRefreshSession(session: Session | null): boolean {
  if (!session?.refresh_token) return false;

  const refreshExpiresAt = (session as Session & { refresh_token_expires_at?: number })
    .refresh_token_expires_at;
  if (!refreshExpiresAt) return true;

  const now = Math.floor(Date.now() / 1000);
  return now < refreshExpiresAt;
}
