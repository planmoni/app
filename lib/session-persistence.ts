import { Session } from '@supabase/supabase-js';
import { getItem, deleteItem, AUTH_SESSION_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_ACCESS_TOKEN_KEY } from './secure-storage';

/**
 * Save session to secure storage.
 * Persists a single session blob (includes access + refresh tokens).
 * Best-effort cleanup removes legacy split token keys.
 */
async function sessionBlobStore(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null> {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

const SESSION_BLOB_KEY = 'auth_session_blob';

export async function saveSession(session: Session | null): Promise<void> {
  try {
    const blob = await sessionBlobStore();
    if (!session) {
      await blob?.removeItem(SESSION_BLOB_KEY);
      await Promise.all([
        deleteItem(AUTH_SESSION_KEY),
        deleteItem(AUTH_REFRESH_TOKEN_KEY),
        deleteItem(AUTH_ACCESS_TOKEN_KEY),
      ]);
      return;
    }

    // The full session is larger than SecureStore's 2048-byte limit.
    // AsyncStorage holds the backup copy. The Supabase client stores the live one.
    if (blob) {
      await blob.setItem(SESSION_BLOB_KEY, JSON.stringify(session));
    }
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
    const blob = await sessionBlobStore();
    const fromBlob = blob ? await blob.getItem(SESSION_BLOB_KEY) : null;
    if (fromBlob) {
      return JSON.parse(fromBlob) as Session;
    }

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
    const blob = await sessionBlobStore();
    await Promise.all([
      blob?.removeItem(SESSION_BLOB_KEY),
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
 * Refresh the saved session and wait until that call finishes.
 * Do not time this out and continue with the old token: the refresh would
 * still complete later and replace the session under in-flight requests.
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
