import { Session } from '@supabase/supabase-js';
import { saveItem, getItem, deleteItem, AUTH_SESSION_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_ACCESS_TOKEN_KEY } from './secure-storage';

/**
 * Save session to secure storage
 */
export async function saveSession(session: Session | null): Promise<void> {
  try {
    if (!session) {
      // Clear session data
      await deleteItem(AUTH_SESSION_KEY);
      await deleteItem(AUTH_REFRESH_TOKEN_KEY);
      await deleteItem(AUTH_ACCESS_TOKEN_KEY);
      console.log('🗑️ Cleared session from secure storage');
      return;
    }

    // Save session data
    await saveItem(AUTH_SESSION_KEY, JSON.stringify(session));
    await saveItem(AUTH_REFRESH_TOKEN_KEY, session.refresh_token);
    await saveItem(AUTH_ACCESS_TOKEN_KEY, session.access_token);
    console.log('💾 Saved session to secure storage');
  } catch (error) {
    console.error('❌ Error saving session to secure storage:', error);
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
      console.log('📭 No session found in secure storage');
      return null;
    }

    const session = JSON.parse(sessionData) as Session;
    console.log('📖 Loaded session from secure storage');
    return session;
  } catch (error) {
    console.error('❌ Error loading session from secure storage:', error);
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
    await deleteItem(AUTH_SESSION_KEY);
    await deleteItem(AUTH_REFRESH_TOKEN_KEY);
    await deleteItem(AUTH_ACCESS_TOKEN_KEY);
    console.log('🗑️ Cleared all session data from secure storage');
  } catch (error) {
    console.error('❌ Error clearing session data:', error);
    throw error;
  }
}

/**
 * Restore session in Supabase auth state
 */
export async function restoreSessionInSupabase(session: Session): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');
    
    // Set the session in Supabase's auth state
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    
    if (error) {
      console.error('❌ Error restoring session in Supabase:', error);
      return false;
    }
    
    console.log('✅ Session restored in Supabase auth state');
    return true;
  } catch (error) {
    console.error('❌ Error restoring session in Supabase:', error);
    return false;
  }
}

/**
 * Attempt to refresh an expired session
 */
export async function refreshExpiredSession(session: Session): Promise<Session | null> {
  try {
    const { supabase } = await import('./supabase');
    
    console.log('🔄 Attempting to refresh expired session...');
    
    // Try to refresh the session using the refresh token
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token
    });
    
    if (error) {
      console.error('❌ Error refreshing session:', error);
      return null;
    }
    
    if (data.session) {
      console.log('✅ Session refreshed successfully');
      // Save the new session
      await saveSession(data.session);
      return data.session;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error refreshing session:', error);
    return null;
  }
}

/**
 * Check if session can be refreshed (has valid refresh token)
 */
export function canRefreshSession(session: Session | null): boolean {
  if (!session) return false;
  
  // Check if refresh token exists and is not expired
  const now = Math.floor(Date.now() / 1000);
  const refreshExpiresAt = session.refresh_token_expires_at || 0;
  
  return !!session.refresh_token && now < refreshExpiresAt;
}
